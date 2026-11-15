"use client";

import Link from "next/link";
import { useState, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Message } from "@/components/ui/message";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { getCropById } from "@/lib/data/crops";
import { getRealWorldCropEconomics, REAL_WORLD_CROP_ECONOMICS } from "@/lib/data/crops/real-world-economics";
import { REGIONS } from "@/lib/data/regions";
import {
  classifyRotationFeasibility,
  type FarmerDecisionInput,
  type FarmerTopPriority,
  type CandidateFeasibility,
  type FarmerWaterAccess,
  type FarmerLaborEquipment,
} from "@/lib/engine/farmer-decision";
import { calculateScenarioGrossMargin } from "@/lib/engine/economics";
import type { Field, Rotation, RotationSlot } from "@/lib/types";
import { MoistureClockRibbon } from "./moisture-clock-ribbon";
import { daysBetween, formatDay } from "@/lib/rotation-format";

export interface FarmerGuidedFlowProps {
  field: Field;
  currentSlots: RotationSlot[];
  cycleYears: 1 | 2 | 3 | 4;
  onApplyPlan: (slots: RotationSlot[], cycleYears: 1 | 2 | 3 | 4) => void | Promise<void>;
  onSwitchToAdvanced: () => void;
  className?: string;
}

type Step = 1 | 2 | 3;

const STEPS: Record<Step, { title: string; titleMy: string }> = {
  1: { title: "What matters most?", titleMy: "ဦးစားပေးရွေးချယ်မှု" },
  2: { title: "Compare options", titleMy: "သီးလှည့်အစီအစဉ် နှိုင်းယှဉ်ချက်" },
  3: { title: "Your plan", titleMy: "စိုက်ပျိုးမည့်အစီအစဉ်" },
};

/** 1 ha = 2.47105 acres, so a per-acre amount × 2.47105 is the per-hectare amount. */
const ACRES_PER_HA = 2.47105;

/** Cost ranges the budget check compares against (whole sequence, upper cost). */
const COST_DATA = Object.values(REAL_WORLD_CROP_ECONOMICS);

/**
 * The budget question has four honest answers plus "not answered yet".
 * Only a stated limit is checked; nothing else is ever read as "unlimited money".
 */
type BudgetAnswer = "unanswered" | "unsure" | "no_limit" | { perAcreMmk: number };

const BUDGET_OPTIONS: Array<{ value: BudgetAnswer; label: string; labelMy: string }> = [
  { value: { perAcreMmk: 600000 }, label: "Under 600,000 MMK per acre", labelMy: "တစ်ဧကလျှင် ကျပ် ၆ သိန်းအောက်" },
  { value: { perAcreMmk: 1000000 }, label: "Under 1,000,000 MMK per acre", labelMy: "တစ်ဧကလျှင် ကျပ် ၁၀ သိန်းအောက်" },
  { value: "no_limit", label: "No fixed limit", labelMy: "သတ်မှတ်ငွေပမာဏ မရှိ" },
  { value: "unsure", label: "Not sure yet", labelMy: "မသေချာသေးပါ" },
];

const WATER_OPTIONS: Array<{ id: FarmerWaterAccess; label: string; labelMy: string }> = [
  { id: "rainfed", label: "Rain only", labelMy: "မိုးရေသာ" },
  { id: "occasional_irrigation", label: "Water once or twice", labelMy: "ရေ ၁-၂ ကြိမ်သွင်းနိုင်" },
  { id: "reliable_irrigation", label: "Reliable irrigation", labelMy: "မြောင်းရေ/စက်ရေအပြည့်" },
  { id: "unknown", label: "Not sure", labelMy: "မသေချာပါ" },
];

const EQUIPMENT_OPTIONS: Array<{ id: FarmerLaborEquipment; label: string; labelMy: string }> = [
  { id: "tractor_tiller", label: "Tiller or tractor", labelMy: "ထွန်စက်/လက်တွန်းထွန်စက်" },
  { id: "seeder", label: "Seed drill", labelMy: "အစေ့ချကိရိယာ" },
  { id: "manual", label: "Hand labour only", labelMy: "လူအားသက်သက်" },
  { id: "unknown", label: "Not sure", labelMy: "မသေချာပါ" },
];

function sameBudget(a: BudgetAnswer, b: BudgetAnswer): boolean {
  if (typeof a === "string" || typeof b === "string") return a === b;
  return a.perAcreMmk === b.perAcreMmk;
}

/** Plain words for what a candidate still needs checked. */
function stillToCheck(feasibility: CandidateFeasibility, budget: BudgetAnswer): string[] {
  const items = new Set<string>();
  for (const f of feasibility.unconfirmedFactors) {
    if (f === "EQUIPMENT_UNCONFIRMED") items.add("machinery");
    else if (f.startsWith("WATER_ACCESS_UNCONFIRMED")) items.add("dry-season water");
    else if (f === "BUDGET_DATA_MISSING") items.add("crop costs");
  }
  if (budget === "unanswered" || budget === "unsure") items.add("your budget");
  return [...items];
}

const PRIORITY_OPTIONS: Array<{
  id: FarmerTopPriority;
  titleEn: string;
  titleMy: string;
  descEn: string;
  icon: IconName;
}> = [
  { id: "profit", titleEn: "Earn more", titleMy: "ဝင်ငွေပိုရရှိရန်", descEn: "Higher-value crops after rice", icon: "trends" },
  { id: "low_water", titleEn: "Use less water", titleMy: "ရေလိုအပ်ချက်နည်းရန်", descEn: "Crops that need little or no irrigation", icon: "water" },
  { id: "low_cash", titleEn: "Spend less upfront", titleMy: "စိုက်ထုတ်ငွေနည်းရန်", descEn: "Lower seed, fertiliser and tillage costs", icon: "cost" },
  { id: "reliable_harvest", titleEn: "Lower risk", titleMy: "ဆုံးရှုံးနိုင်ခြေနည်းရန်", descEn: "Familiar crops with steadier local yields", icon: "done" },
  { id: "soil_improvement", titleEn: "Keep soil healthy", titleMy: "မြေဆီလွှာကောင်းမွန်ရန်", descEn: "Pulses and soil cover between crops", icon: "rotation" },
];

/** English label with the Burmese translation as quieter help text beneath. */
function Bilingual({ en, my, className }: { en: ReactNode; my: string; className?: string }) {
  return (
    <span className={cn("flex min-w-0 flex-col", className)}>
      <span>{en}</span>
      <span lang="my" className="text-source font-normal text-ink-muted">{my}</span>
    </span>
  );
}

function ChoiceButton({
  selected,
  onClick,
  label,
  labelMy,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  labelMy: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-tap cursor-pointer flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors",
        selected ? "border-field bg-field-soft text-ink ring-2 ring-field/30" : "border-line bg-surface hover:bg-surface-sunken",
      )}
    >
      <Bilingual en={label} my={labelMy} className="text-body-sm font-semibold" />
    </button>
  );
}

export function FarmerGuidedFlow({
  field,
  currentSlots,
  cycleYears,
  onApplyPlan,
  onSwitchToAdvanced,
  className,
}: FarmerGuidedFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [savingPlan, setSavingPlan] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [unit, setUnit] = useState<"acre" | "ha">("acre");
  const [budget, setBudget] = useState<BudgetAnswer>("unanswered");
  const [refineOpen, setRefineOpen] = useState(false);

  // Water access comes from the saved field when it is known; nothing else is assumed.
  const savedWater: FarmerWaterAccess =
    field.irrigation === "none" ? "rainfed" : field.irrigation === "full" ? "reliable_irrigation" : "unknown";

  const [farmerInputs, setFarmerInputs] = useState<FarmerDecisionInput>({
    topPriorities: ["profit", "low_water"],
    availableWater: savedWater,
    equipment: "unknown",
    budgetMaxMmkHa: null,
    canSellCropIds: [],
    avoidCropIds: [],
    farmerObservedDrainage: "adequate",
  });

  const budgetMaxMmkHa = typeof budget === "object" ? budget.perAcreMmk * ACRES_PER_HA : null;
  const decisionInputs = useMemo(
    () => ({ ...farmerInputs, budgetMaxMmkHa }),
    [farmerInputs, budgetMaxMmkHa],
  );

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("plan-pulse");

  const areaDisplay = useMemo(() => {
    if (!field.areaHa) return null;
    return unit === "acre"
      ? `${(field.areaHa * ACRES_PER_HA).toFixed(1)} acres`
      : `${field.areaHa.toFixed(1)} ha`;
  }, [field.areaHa, unit]);

  const regionName =
    field.region && field.region !== "unsupported" ? (REGIONS[field.region]?.name ?? field.region) : "Region not set";
  const waterSummary =
    field.irrigation === "none" ? "Rain-fed" : field.irrigation === "full" ? "Fully irrigated" : field.irrigation === "supplemental" ? "Some irrigation" : "Water not set";

  const refinementsAnswered =
    (farmerInputs.availableWater !== "unknown" ? 1 : 0) +
    (farmerInputs.equipment !== "unknown" ? 1 : 0) +
    (budget !== "unanswered" && budget !== "unsure" ? 1 : 0);

  // Three candidate sequences to compare
  const candidates: Array<{
    id: string;
    title: string;
    titleMy: string;
    rotation: Rotation;
    feasibility: CandidateFeasibility;
    estimatedMarginMmkHa: [number, number];
    committedCashMmkHa: number;
    waterRisk: string;
    whyThisOption: string;
    mainRisk: string;
    localCheck: string;
    isCurrent: boolean;
  }> = useMemo(() => {
    const baseYear = new Date().getFullYear();

    // Option 1: Monsoon Rice -> Post-monsoon Black Gram (Matpe)
    const ricePulseRot: Rotation = {
      id: "plan-pulse",
      fieldId: field.id,
      label: "Rice -> Black Gram (မိုးစပါး - မတ်ပဲ)",
      cycleYears: 1,
      source: "strategy",
      slots: [
        {
          id: "s1",
          kind: "crop",
          cropId: "rice",
          plantDate: `${baseYear}-06-15`,
          harvestDate: `${baseYear}-10-25`,
          dateConfidence: "typical",
          irrigated: false,
          establishmentMode: "tillage",
        },
        {
          id: "s2",
          kind: "crop",
          cropId: "black-gram",
          plantDate: `${baseYear}-11-05`,
          harvestDate: `${baseYear + 1}-02-15`,
          dateConfidence: "typical",
          irrigated: false,
          establishmentMode: "zero_till",
        },
      ],
    };

    // Option 2: Monsoon Rice -> Post-monsoon Sesame (မိုးစပါး - နှမ်း)
    const riceSesameRot: Rotation = {
      id: "plan-sesame",
      fieldId: field.id,
      label: "Rice -> Sesame (မိုးစပါး - နှမ်း)",
      cycleYears: 1,
      source: "strategy",
      slots: [
        {
          id: "s1",
          kind: "crop",
          cropId: "rice",
          plantDate: `${baseYear}-06-15`,
          harvestDate: `${baseYear}-10-25`,
          dateConfidence: "typical",
          irrigated: false,
          establishmentMode: "tillage",
        },
        {
          id: "s2",
          kind: "crop",
          cropId: "sesame",
          plantDate: `${baseYear}-11-12`,
          harvestDate: `${baseYear + 1}-02-20`,
          dateConfidence: "typical",
          irrigated: false,
          establishmentMode: "tillage",
        },
      ],
    };

    // Option 3: Monsoon Rice -> Irrigated Summer Rice / Double Rice
    const doubleRiceRot: Rotation = {
      id: "plan-double-rice",
      fieldId: field.id,
      label: "Rice -> Summer Rice (မိုးစပါး - နွေစပါး)",
      cycleYears: 1,
      source: "strategy",
      slots: [
        {
          id: "s1",
          kind: "crop",
          cropId: "rice",
          plantDate: `${baseYear}-06-15`,
          harvestDate: `${baseYear}-10-25`,
          dateConfidence: "typical",
          irrigated: false,
          establishmentMode: "tillage",
        },
        {
          id: "s2",
          kind: "crop",
          cropId: "rice",
          plantDate: `${baseYear + 1}-01-15`,
          harvestDate: `${baseYear + 1}-05-15`,
          dateConfidence: "typical",
          irrigated: true,
          establishmentMode: "tillage",
        },
      ],
    };

    const pulseFeas = classifyRotationFeasibility(ricePulseRot, decisionInputs, COST_DATA);
    const sesameFeas = classifyRotationFeasibility(riceSesameRot, decisionInputs, COST_DATA);
    const doubleRiceFeas = classifyRotationFeasibility(doubleRiceRot, decisionInputs, COST_DATA);

    // Sourced real-world economics
    const riceEcon = getRealWorldCropEconomics("rice");
    const pulseEcon = getRealWorldCropEconomics("black-gram");
    const sesameEcon = getRealWorldCropEconomics("sesame");

    const pulseMargin = calculateScenarioGrossMargin({
      yieldKgHa: pulseEcon?.yieldKgHa ?? [1000, 1600],
      priceMmkPerKg: pulseEcon?.priceMmkPerKg ?? [3200, 3850],
      costPartition: { fixedMmkHa: 600000, variableMmkPerKg: 350 },
    });

    const sesameMargin = calculateScenarioGrossMargin({
      yieldKgHa: sesameEcon?.yieldKgHa ?? [500, 800],
      priceMmkPerKg: sesameEcon?.priceMmkPerKg ?? [4500, 6000],
      costPartition: { fixedMmkHa: 500000, variableMmkPerKg: 400 },
    });

    const summerRiceMargin = calculateScenarioGrossMargin({
      yieldKgHa: riceEcon?.yieldKgHa ?? [3500, 5000],
      priceMmkPerKg: riceEcon?.priceMmkPerKg ?? [1000, 1300],
      costPartition: { fixedMmkHa: 1100000, variableMmkPerKg: 200, irrigationMmkHa: 250000 },
    });

    return [
      {
        id: "plan-pulse",
        title: "Rice → Black Gram",
        titleMy: "မိုးစပါး - မတ်ပဲ",
        rotation: ricePulseRot,
        feasibility: pulseFeas,
        estimatedMarginMmkHa: pulseMargin.grossMarginMmkHa,
        committedCashMmkHa: pulseMargin.committedCashAtRiskMmkHa,
        waterRisk: "Low: pulse establishes on residual monsoon moisture; zero supplemental irrigation required.",
        whyThisOption: "A pulse after rice may use moisture left in the soil. The benefit depends on your soil, drainage and crop management.",
        mainRisk: "Standing water or rain during flowering can damage the crop.",
        localCheck: "Check whether the soil is moist and drains well. Ask a local adviser about sowing time and seed.",
        isCurrent: currentSlots.some((s) => s.cropId === "black-gram"),
      },
      {
        id: "plan-sesame",
        title: "Rice → Sesame",
        titleMy: "မိုးစပါး - နှမ်း",
        rotation: riceSesameRot,
        feasibility: sesameFeas,
        estimatedMarginMmkHa: sesameMargin.grossMarginMmkHa,
        committedCashMmkHa: sesameMargin.committedCashAtRiskMmkHa,
        waterRisk: "Low to Moderate: deep taproot tolerates dry spell but requires friable tilth for germination.",
        whyThisOption: "Sesame offers a different crop after rice. Check whether the soil and local selling price make it practical.",
        mainRisk: "Sesame may not establish well in wet, compacted soil.",
        localCheck: "Check that water has drained and the topsoil breaks apart easily before sowing.",
        isCurrent: currentSlots.some((s) => s.cropId === "sesame"),
      },
      {
        id: "plan-double-rice",
        title: "Rice → Summer Rice",
        titleMy: "မိုးစပါး - နွေစပါး",
        rotation: doubleRiceRot,
        feasibility: doubleRiceFeas,
        estimatedMarginMmkHa: summerRiceMargin.grossMarginMmkHa,
        committedCashMmkHa: summerRiceMargin.committedCashAtRiskMmkHa,
        waterRisk: "High: requires 900–1,200 mm continuous irrigation through hot dry months.",
        whyThisOption: "A second rice crop is an option to discuss where dry-season water is reliable.",
        mainRisk: "The crop can fail if irrigation stops. Pumping costs may also reduce the return.",
        localCheck: "Confirm the water schedule, pump access and fuel budget before choosing this option.",
        isCurrent: currentSlots.filter((s) => s.cropId === "rice").length > 1,
      },
    ];
  }, [field.id, decisionInputs, currentSlots]);

  const togglePriority = (pId: FarmerTopPriority) => {
    setFarmerInputs((prev) => {
      const exists = prev.topPriorities.includes(pId);
      if (exists) {
        if (prev.topPriorities.length === 1) return prev; // keep at least 1
        return { ...prev, topPriorities: prev.topPriorities.filter((x) => x !== pId) };
      }
      if (prev.topPriorities.length >= 2) {
        return { ...prev, topPriorities: [prev.topPriorities[1], pId] };
      }
      return { ...prev, topPriorities: [...prev.topPriorities, pId] };
    });
  };

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0];

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Step header */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-pill bg-field font-mono text-source font-semibold text-on-field">
              {step}
            </span>
            <div className="min-w-0">
              <p className="m-0 text-source text-ink-muted">Step {step} of 3</p>
              <Bilingual en={STEPS[step].title} my={STEPS[step].titleMy} className="text-headline font-semibold text-ink" />
            </div>
          </div>
          <Button variant="quiet" onClick={onSwitchToAdvanced} className="text-body-sm font-medium text-field">
            Edit dates myself
          </Button>
        </div>
        <div className="flex h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunken" aria-hidden>
          {[1, 2, 3].map((s) => (
            <div key={s} className={cn("flex-1 border-r border-surface transition-colors", s <= step ? "bg-field" : "bg-transparent")} />
          ))}
        </div>
      </div>

      {/* Compact field summary: shown, not asked again */}
      {step !== 3 ? (
        <section
          aria-label="Field details used"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-line bg-surface-sunken px-4 py-3"
        >
          <dl className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Field</dt>
              <Icon name="fields" size={16} className="text-ink-muted" />
              <dd className="m-0 font-semibold text-ink">{field.name}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Region</dt>
              <Icon name="location" size={16} className="text-ink-muted" />
              <dd className="m-0 text-ink">{regionName}</dd>
            </div>
            {areaDisplay ? (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Size</dt>
                <dd className="m-0 text-ink">
                  <button
                    type="button"
                    onClick={() => setUnit(unit === "acre" ? "ha" : "acre")}
                    className="cursor-pointer rounded-sm text-ink underline decoration-dotted underline-offset-2"
                    aria-label={`${areaDisplay}. Show in ${unit === "acre" ? "hectares" : "acres"}`}
                  >
                    {areaDisplay}
                  </button>
                </dd>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Water</dt>
              <Icon name="water" size={16} className="text-ink-muted" />
              <dd className="m-0 text-ink">{waterSummary}</dd>
            </div>
          </dl>
          <Link href={`/fields/${field.id}/profile`} className="text-label font-medium text-field">
            Edit field
          </Link>
        </section>
      ) : null}

      {/* STEP 1: Priorities */}
      {step === 1 && (
        <Panel as="section" className="flex flex-col gap-5 p-4 sm:p-6">
          <p className="m-0 text-body-sm text-ink-muted">
            Choose one or two. Options are ordered to match. You can add water, machinery and budget details on the next screen.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {PRIORITY_OPTIONS.map((opt) => {
              const selected = farmerInputs.topPriorities.includes(opt.id);
              const rankNum = farmerInputs.topPriorities.indexOf(opt.id) + 1;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => togglePriority(opt.id)}
                  className={cn(
                    "flex min-h-tap cursor-pointer flex-col gap-1 rounded-xl border p-4 text-left shadow-xs transition-all",
                    selected
                      ? "border-field bg-field-soft text-ink ring-2 ring-field/40"
                      : "border-line bg-surface hover:border-line-strong hover:bg-surface-sunken",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex items-start gap-2 text-label font-semibold text-ink">
                      <Icon name={opt.icon} size={20} className="mt-0.5 shrink-0 text-field" />
                      <Bilingual en={opt.titleEn} my={opt.titleMy} />
                    </span>
                    {selected ? (
                      <span className="grid size-6 shrink-0 place-items-center rounded-pill bg-field font-mono text-source font-bold text-on-field">
                        {rankNum}
                      </span>
                    ) : null}
                  </span>
                  <span className="pl-7 text-source text-ink-muted">{opt.descEn}</span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end border-t border-line pt-4">
            <Button variant="primary" size="lg" iconEnd="next" onClick={() => setStep(2)} className="min-h-tap w-full sm:w-auto">
              Show options
            </Button>
          </div>
        </Panel>
      )}

      {/* STEP 2: Compare, with optional refinements */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <Message
            tone="success"
            role="status"
            title="Options ready from your priorities and saved field"
            action={
              <Button
                variant="secondary"
                onClick={() => setRefineOpen((o) => !o)}
                aria-expanded={refineOpen}
                aria-controls="guided-refine"
                className="min-h-tap"
              >
                <Icon name="priorities" size={16} />
                {refineOpen ? "Hide farm details" : "Add farm details (optional)"}
              </Button>
            }
          >
            {refinementsAnswered === 3
              ? "Water, machinery and budget are included in the checks below."
              : `Optional: ${refinementsAnswered} of 3 farm details added. Adding water, machinery and budget makes the checks below more specific.`}
          </Message>

          {refineOpen ? (
            <Panel as="section" id="guided-refine" aria-label="Optional farm details" className="flex flex-col gap-5 p-4 sm:p-5">
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-label font-semibold text-ink">
                  <Bilingual en="Dry-season water" my="နွေရာသီရေရရှိနိုင်မှု" />
                </legend>
                <div className="grid gap-2 sm:grid-cols-4">
                  {WATER_OPTIONS.map((opt) => (
                    <ChoiceButton
                      key={opt.id}
                      selected={farmerInputs.availableWater === opt.id}
                      onClick={() => setFarmerInputs({ ...farmerInputs, availableWater: opt.id })}
                      label={opt.label}
                      labelMy={opt.labelMy}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-label font-semibold text-ink">
                  <Bilingual en="Machinery and labour" my="စက်ယန္တရားနှင့် လုပ်သား" />
                </legend>
                <div className="grid gap-2 sm:grid-cols-4">
                  {EQUIPMENT_OPTIONS.map((opt) => (
                    <ChoiceButton
                      key={opt.id}
                      selected={farmerInputs.equipment === opt.id}
                      onClick={() => setFarmerInputs({ ...farmerInputs, equipment: opt.id })}
                      label={opt.label}
                      labelMy={opt.labelMy}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-label font-semibold text-ink">
                  <Bilingual en="Cash you can spend before harvest" my="စိုက်ထုတ်ငွေကန့်သတ်ချက်" />
                </legend>
                <div className="grid gap-2 sm:grid-cols-4">
                  {BUDGET_OPTIONS.map((opt) => (
                    <ChoiceButton
                      key={opt.label}
                      selected={sameBudget(budget, opt.value)}
                      onClick={() => setBudget(opt.value)}
                      label={opt.label}
                      labelMy={opt.labelMy}
                    />
                  ))}
                </div>
                <p className="m-0 text-source text-ink-muted">
                  {budget === "unanswered"
                    ? "Not answered yet, so upfront costs are not checked against a budget."
                    : budget === "unsure"
                      ? "Upfront costs are shown but not checked against a budget."
                      : budget === "no_limit"
                        ? "Upfront costs are shown but no limit is applied."
                        : "Options that may cost more than this are marked."}
                </p>
              </fieldset>
            </Panel>
          ) : null}

          <MoistureClockRibbon
            hasConfirmedSoil={Boolean(field.soilOverride?.texture || field.soilObservations?.length)}
            hasConfirmedDrainageDate={true}
            awcMmPerM={140}
            thetaSat={0.48}
            thetaFc={0.34}
            pondAtDrainageMm={25}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            {candidates.map((cand, idx) => {
              const isSelected = cand.id === selectedCandidateId;
              const status = cand.feasibility.status;
              const toCheck = stillToCheck(cand.feasibility, budget);

              return (
                <Panel
                  as="article"
                  key={cand.id}
                  className={cn(
                    "flex flex-col justify-between gap-4 rounded-xl border p-5 shadow-xs transition-all",
                    isSelected ? "border-field bg-surface ring-2 ring-field/50" : "border-line bg-surface hover:border-line-strong",
                  )}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-pill bg-field-soft px-2.5 py-0.5 text-source font-semibold text-field">
                        Option {idx + 1}
                      </span>
                      {status === "feasible" ? (
                        <span className="flex items-center gap-1 text-source font-medium text-healthy">
                          <Icon name="done" size={14} /> Passes your answers
                        </span>
                      ) : status === "needs_review" ? (
                        <span className="flex items-center gap-1 text-source font-medium text-drought">
                          <Icon name="conditions" size={14} /> Needs a check
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-source font-medium text-heat">
                          <Icon name="close" size={14} /> Ruled out by your answers
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="m-0 text-headline font-bold text-ink">{cand.title}</h3>
                      <p lang="my" className="m-0 mt-0.5 text-source font-medium text-ink-muted">{cand.titleMy}</p>
                    </div>

                    <div className="rounded-lg bg-surface-sunken p-3">
                      <span className="text-source text-ink-muted">Estimated return after listed costs, MMK per hectare</span>
                      <p className="m-0 text-headline font-bold text-ink">
                        {Math.round(cand.estimatedMarginMmkHa[0]).toLocaleString()} – {Math.round(cand.estimatedMarginMmkHa[1]).toLocaleString()} MMK
                      </p>
                      <span className="text-source text-ink-muted">
                        Example upfront spending: {Math.round(cand.committedCashMmkHa).toLocaleString()} MMK per hectare
                      </span>
                      <p className="mt-2 text-source text-ink-muted">Uses 2024–2026 benchmark prices and listed costs for the crop after rice. Add your own prices, yields and costs for a field-specific view.</p>
                    </div>

                    {cand.feasibility.hardConstraintVetoes.includes("BUDGET_EXCEEDED") ? (
                      <Message tone="problem" compact title="May cost more than your budget">
                        The whole sequence is checked against the limit you set.
                      </Message>
                    ) : null}
                    {cand.feasibility.hardConstraintVetoes.some((v) => v.startsWith("WATER_UNAVAILABLE")) ? (
                      <Message tone="problem" compact title="Needs dry-season irrigation">
                        You told us this field has rain only.
                      </Message>
                    ) : null}
                    {toCheck.length > 0 ? (
                      <Message tone="needs" compact title={`Add to check: ${toCheck.join(", ")}`} />
                    ) : null}

                    <div className="flex flex-col gap-2 text-body-sm">
                      <div>
                        <strong className="text-ink">Why consider it? </strong>
                        <span className="text-ink-muted">{cand.whyThisOption}</span>
                      </div>
                      <Message tone="caution" compact title="What could go wrong">
                        {cand.mainRisk}
                      </Message>
                      <Message tone="needs" compact title="Before you decide">
                        {cand.localCheck}
                      </Message>
                    </div>
                  </div>

                  <Button
                    disabled={status === "infeasible"}
                    variant={isSelected ? "primary" : "secondary"}
                    onClick={() => setSelectedCandidateId(cand.id)}
                    aria-pressed={isSelected}
                    className="mt-2 w-full min-h-tap"
                  >
                    {isSelected ? (
                      <>
                        <Icon name="done" size={16} /> Selected
                      </>
                    ) : (
                      "Choose this option"
                    )}
                  </Button>
                </Panel>
              );
            })}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setStep(1)} className="min-h-tap w-full sm:w-auto">
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              iconEnd="next"
              disabled={selectedCandidate.feasibility.status === "infeasible"}
              onClick={() => setStep(3)}
              className="min-h-tap w-full sm:w-auto"
            >
              Continue with {selectedCandidate.title}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Plan & checklist */}
      {step === 3 && (
        <Panel as="section" className="flex flex-col gap-6 p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-headline font-semibold text-ink">{selectedCandidate.title}</h2>
            <p className="m-0 text-body-sm text-ink-muted">
              Dates are suggested from the usual season in your region. Change them to your own dates after saving.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-label font-semibold text-ink">Crop sequence</span>
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {selectedCandidate.rotation.slots.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-pill bg-field font-mono text-source font-bold text-on-field">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 text-label font-semibold text-ink">
                        {getCropById(s.cropId ?? "")?.names.common ?? s.cropId}
                      </p>
                      <p className="m-0 text-source text-ink-muted">
                        Suggested: sow around {formatDay(s.plantDate)}, harvest around {formatDay(s.harvestDate)} (about {daysBetween(s.plantDate, s.harvestDate)} days)
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-pill border border-dashed border-line-strong px-2.5 py-1 text-source font-medium text-ink-muted">
                    Suggested dates
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-field/30 bg-field-soft/20 p-4">
            <div className="flex items-start gap-2">
              <Icon name="done" size={18} className="mt-0.5 shrink-0 text-field" />
              <Bilingual en="Before planting" my="စိုက်ပျိုးမီ လက်တွေ့စစ်ဆေးရမည့်အချက်များ" className="text-label font-semibold text-ink" />
            </div>
            <ul className="m-0 flex flex-col gap-1.5 pl-5 text-body-sm text-ink">
              <li>Test seed germination with a wet cloth 7 days before sowing.</li>
              <li>Clear drainage ditches so water does not stand after the monsoon.</li>
              <li>Check local buying prices before you spend on seed.</li>
              {stillToCheck(selectedCandidate.feasibility, budget).length > 0 ? (
                <li>Confirm what was not checked: {stillToCheck(selectedCandidate.feasibility, budget).join(", ")}.</li>
              ) : null}
              <li>
                <strong>Important:</strong> This tool supports your decision. Check the field yourself and ask a local extension adviser where unsure.
              </li>
            </ul>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setStep(2)} className="min-h-tap w-full sm:w-auto">
              Back to options
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={savingPlan || selectedCandidate.feasibility.status === "infeasible"}
              onClick={async () => {
                setSavingPlan(true);
                setSaveMessage("");
                try {
                  await onApplyPlan(selectedCandidate.rotation.slots, selectedCandidate.rotation.cycleYears ?? cycleYears);
                  setSaveFailed(false);
                  setSaveMessage("Plan saved in this browser. Its suggested dates still need your review.");
                } catch {
                  setSaveFailed(true);
                  setSaveMessage("Could not save the plan. Check browser storage and try again.");
                } finally {
                  setSavingPlan(false);
                }
              }}
              className="min-h-tap w-full sm:w-auto"
            >
              {savingPlan ? "Saving plan…" : "Save this plan"}
            </Button>
            {saveMessage ? (
              <Message
                className="w-full"
                role="status"
                tone={saveFailed ? "problem" : "success"}
                title={saveFailed ? "Plan save failed" : "Plan saved in this browser"}
              >
                {saveFailed ? "Check browser storage and try again." : "Its suggested dates still need your review."}
              </Message>
            ) : null}
          </div>
        </Panel>
      )}
    </div>
  );
}
