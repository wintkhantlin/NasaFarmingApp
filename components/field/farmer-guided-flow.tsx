"use client";

import Link from "next/link";
import { useState, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Message } from "@/components/ui/message";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { getCropById } from "@/lib/data/crops";
import { REGIONS } from "@/lib/data/regions";
import {
  classifyRotationFeasibility,
  type FarmerDecisionInput,
  type FarmerTopPriority,
  type CandidateFeasibility,
  type FarmerWaterAccess,
  type FarmerLaborEquipment,
} from "@/lib/engine/farmer-decision";
import { prioritiesSchema } from "@/lib/schemas/field";
import { useFieldsStore } from "@/lib/store/fields-store";
import type { Field, PriorityId, Rotation, RotationSlot } from "@/lib/types";
import { MoistureClockRibbon } from "./moisture-clock-ribbon";
import { PRIORITY_IDS, PRIORITY_INFO } from "./priority-order";
import { daysBetween, formatDay } from "@/lib/rotation-format";

export interface FarmerGuidedFlowProps {
  field: Field;
  currentSlots: RotationSlot[];
  cycleYears: 1 | 2 | 3 | 4;
  onApplyPlan: (slots: RotationSlot[], cycleYears: 1 | 2 | 3 | 4) => void | Promise<void>;
  onSwitchToAdvanced?: () => void;
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

/**
 * The five priorities are the same ids and English words as "What matters most" in the farm profile
 * (PRIORITY_IDS / PRIORITY_INFO), so what is picked here is what the engine reads.
 */
// TODO native review: Burmese wording for the five priorities
const PRIORITY_MY: Record<PriorityId, { title: string; help: string }> = {
  water: { title: "ရေချွေတာရန်", help: "မိုးရေက သီးနှံလိုအပ်သည့်ရေကို ပိုဖြည့်ပေးသော သီးနှံများကို ဦးစားပေးသည်။" },
  soil: { title: "မြေဆီလွှာ ပိုကောင်းစေရန်", help: "ပဲမျိုးများ ပိုစိုက်ပြီး မြေလွတ်ရက် နည်းသော အစီအစဉ်များကို ဦးစားပေးသည်။" },
  income: { title: "ဝင်ငွေပိုရရန်", help: "အမြတ်ပိုရသော သီးနှံများကို ဦးစားပေးသည်။" },
  forage: { title: "တိရစ္ဆာန်စာ ထောက်ပံ့ရန်", help: "တိရစ္ဆာန်စာ ရနိုင်သော သီးနှံပါသည့် အစီအစဉ်များကို ဦးစားပေးသည်။" },
  "lower-inputs": { title: "နိုက်ထရိုဂျင်ဓာတ်မြေဩဇာ လျှော့သုံးရန်", help: "နိုက်ထရိုဂျင် လိုအပ်ချက်နည်းသော သီးနှံများကို ဦးစားပေးသည်။" },
};

/** The feasibility check still speaks in its own words; "forage" has no matching word there. */
const TOP_PRIORITY_FOR: Partial<Record<PriorityId, FarmerTopPriority>> = {
  income: "profit",
  water: "low_water",
  soil: "soil_improvement",
  "lower-inputs": "low_cash",
};

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
  const update = useFieldsStore((st) => st.update);
  // Start from what the farm profile already holds, so the two screens never disagree.
  const [priorityOrder, setPriorityOrder] = useState<PriorityId[]>(() =>
    (field.priorities?.order ?? []).filter((id) => PRIORITY_IDS.includes(id)).slice(0, 2),
  );
  const [prioritiesSaved, setPrioritiesSaved] = useState<"idle" | "saved" | "failed">("idle");

  // Legacy fields often carry a top-level default; only the explicit constraint counts as an answer.
  const savedWater: FarmerWaterAccess =
    field.constraints?.irrigation?.access === "none"
      ? "rainfed"
      : field.constraints?.irrigation?.access === "full"
        ? "reliable_irrigation"
        : field.constraints?.irrigation?.access === "supplemental"
          ? "occasional_irrigation"
          : "unknown";

  const [farmerInputs, setFarmerInputs] = useState<FarmerDecisionInput>({
    topPriorities: [],
    availableWater: savedWater,
    equipment: "unknown",
    budgetMaxMmkHa: null,
    canSellCropIds: [],
    avoidCropIds: [],
    farmerObservedDrainage: "unknown",
  });

  const budgetMaxMmkHa = typeof budget === "object" ? budget.perAcreMmk * ACRES_PER_HA : null;
  const decisionInputs = useMemo(
    () => ({ ...farmerInputs, topPriorities: priorityOrder.flatMap((id) => TOP_PRIORITY_FOR[id] ?? []), budgetMaxMmkHa }),
    [farmerInputs, priorityOrder, budgetMaxMmkHa],
  );

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [dateEdits, setDateEdits] = useState<Record<string, { plantDate?: string; harvestDate?: string }>>({});

  const areaDisplay = useMemo(() => {
    if (!field.areaHa) return null;
    return unit === "acre"
      ? `${(field.areaHa * ACRES_PER_HA).toFixed(1)} acres`
      : `${field.areaHa.toFixed(1)} ha`;
  }, [field.areaHa, unit]);

  const regionName =
    field.region && field.region !== "unsupported" ? (REGIONS[field.region]?.name ?? field.region) : "Region not set";
  const confirmedWater = field.constraints?.irrigation?.access;
  const waterSummary =
    confirmedWater === "none" ? "Rain-fed" : confirmedWater === "full" ? "Irrigation available" : confirmedWater === "supplemental" ? "Rain and irrigation" : "Water not confirmed";

  // Three candidate sequences to compare
  const candidates: Array<{
    id: string;
    title: string;
    titleMy: string;
    rotation: Rotation;
    feasibility: CandidateFeasibility;
    waterRisk: string;
    whyThisOption: string;
    mainRisk: string;
    localCheck: string;
    isCurrent: boolean;
  }> = useMemo(() => {
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
          plantDate: "",
          harvestDate: "",
          dateConfidence: "typical",
          irrigated: false,
          establishmentMode: "tillage",
        },
        {
          id: "s2",
          kind: "crop",
          cropId: "black-gram",
          plantDate: "",
          harvestDate: "",
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
          plantDate: "",
          harvestDate: "",
          dateConfidence: "typical",
          irrigated: false,
          establishmentMode: "tillage",
        },
        {
          id: "s2",
          kind: "crop",
          cropId: "sesame",
          plantDate: "",
          harvestDate: "",
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
          plantDate: "",
          harvestDate: "",
          dateConfidence: "typical",
          irrigated: false,
          establishmentMode: "tillage",
        },
        {
          id: "s2",
          kind: "crop",
          cropId: "rice",
          plantDate: "",
          harvestDate: "",
          dateConfidence: "typical",
          irrigated: true,
          establishmentMode: "tillage",
        },
      ],
    };

    const pulseFeas = classifyRotationFeasibility(ricePulseRot, decisionInputs, field.economics);
    const sesameFeas = classifyRotationFeasibility(riceSesameRot, decisionInputs, field.economics);
    const doubleRiceFeas = classifyRotationFeasibility(doubleRiceRot, decisionInputs, field.economics);

    return [
      {
        id: "plan-pulse",
        title: "Rice → Black Gram",
        titleMy: "မိုးစပါး - မတ်ပဲ",
        rotation: ricePulseRot,
        feasibility: pulseFeas,
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
        waterRisk: "High: requires 900–1,200 mm continuous irrigation through hot dry months.",
        whyThisOption: "A second rice crop is an option to discuss where dry-season water is reliable.",
        mainRisk: "The crop can fail if irrigation stops. Pumping costs may also reduce the return.",
        localCheck: "Confirm the water schedule, pump access and fuel budget before choosing this option.",
        isCurrent: currentSlots.filter((s) => s.cropId === "rice").length > 1,
      },
    ];
  }, [field.id, field.economics, decisionInputs, currentSlots]);

  const togglePriority = (id: PriorityId) => {
    setPriorityOrder((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return prev.length >= 2 ? [prev[1], id] : [...prev, id];
    });
  };

  /** Writes the choice into the field's priorities (the same list the profile edits). Runs in the background. */
  const savePriorities = async () => {
    const saved = field.priorities?.order ?? [];
    const unchanged = priorityOrder.length === Math.min(saved.length, 2) && priorityOrder.every((id, i) => saved[i] === id);
    if (unchanged) {
      setPrioritiesSaved("idle");
      return;
    }
    try {
      const priorities = prioritiesSchema.parse({
        order: priorityOrder,
        weights: {},
        soil: priorityOrder.includes("soil") ? field.priorities?.soil : undefined,
        income: priorityOrder.includes("income") ? field.priorities?.income : undefined,
      });
      await update(field.id, { priorities });
      setPrioritiesSaved("saved");
    } catch {
      setPrioritiesSaved("failed");
    }
  };

  const baseSelectedCandidate = candidates.find((c) => c.id === selectedCandidateId);
  const selectedCandidate = baseSelectedCandidate
    ? {
        ...baseSelectedCandidate,
        rotation: {
          ...baseSelectedCandidate.rotation,
          slots: baseSelectedCandidate.rotation.slots.map((slot) => ({
            ...slot,
            ...dateEdits[`${baseSelectedCandidate.id}:${slot.id}`],
            dateConfidence: "exact" as const,
          })),
        },
      }
    : undefined;
  const dateError = selectedCandidate
    ? selectedCandidate.rotation.slots.some((slot, index, slots) => {
        if (!slot.plantDate || !slot.harvestDate || slot.harvestDate <= slot.plantDate) return true;
        if (slot.plantDate < new Date().toISOString().slice(0, 10)) return true;
        return index > 0 && slot.plantDate < slots[index - 1].harvestDate;
      })
    : false;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Back lives at the top, where the page bar's Back lives, never beside the main action */}
      {step > 1 ? (
        <button
          type="button"
          onClick={() => setStep(step === 3 ? 2 : 1)}
          aria-label={step === 3 ? "Back to options" : "Back"}
          className="-mb-2 -ml-2 inline-flex min-h-tap w-fit cursor-pointer items-center gap-0.5 rounded-md pr-3 pl-1 text-label text-field hover:bg-field-soft active:bg-field-soft"
        >
          <Icon name="back" size={22} />
          {step === 3 ? <Bilingual en="Back to options" my="ရွေးချယ်စရာများသို့ ပြန်သွားမည်" /> : <Bilingual en="Back" my="ရှေ့သို့ ပြန်သွားမည်" />}
        </button>
      ) : null}

      {/* Step header */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-pill bg-field font-mono text-source font-semibold text-on-field">
            {step}
          </span>
          <div className="min-w-0">
            <p className="m-0 text-source text-ink-muted">Step {step} of 3</p>
            <Bilingual en={STEPS[step].title} my={STEPS[step].titleMy} className="text-headline font-semibold text-ink" />
          </div>
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
          {priorityOrder.length === 0 ? (
            <>
              <p className="m-0 text-body-sm text-ink-muted">
                Choose one or two priorities. No priority is preselected.
              </p>
              <p lang="my" className="m-0 text-body-sm text-ink-muted">အရေးကြီးဆုံးအချက် တစ်ခု သို့မဟုတ် နှစ်ခုကို ရွေးပါ။ ကြိုတင်ရွေးထားခြင်း မရှိပါ။</p>
            </>
          ) : (
            <p className="m-0 text-body-sm text-ink-muted">
              Choose one or two. We keep your choice in your farm profile, so it is the same everywhere.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {PRIORITY_IDS.map((id) => {
              const info = PRIORITY_INFO[id];
              const my = PRIORITY_MY[id];
              const selected = priorityOrder.includes(id);
              const rankNum = priorityOrder.indexOf(id) + 1;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => togglePriority(id)}
                  className={cn(
                    "flex min-h-tap cursor-pointer flex-col gap-1 rounded-xl border p-4 text-left shadow-xs transition-all",
                    selected
                      ? "border-field bg-field-soft text-ink ring-2 ring-field/40"
                      : "border-line bg-surface hover:border-line-strong hover:bg-surface-sunken",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex items-start gap-2 text-label font-semibold text-ink">
                      <Icon name={info.icon} size={20} className="mt-0.5 shrink-0 text-field" />
                      <Bilingual en={info.label} my={my.title} />
                    </span>
                    {selected ? (
                      <span className="grid size-6 shrink-0 place-items-center rounded-pill bg-field font-mono text-source font-bold text-on-field">
                        {rankNum}
                      </span>
                    ) : null}
                  </span>
                  <span className="pl-7 text-source text-ink-muted">
                    <Bilingual en={info.help} my={my.help} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end border-t border-line pt-4">
            {priorityOrder.length === 0 ? <p className="m-0 text-body-sm text-ink-muted">Choose at least one priority to continue. / ဆက်လုပ်ရန် ဦးစားပေးတစ်ခု အနည်းဆုံးရွေးပါ။</p> : null}
            <Button
              variant="primary"
              size="lg"
              iconEnd="next"
              disabled={priorityOrder.length === 0}
              onClick={() => {
                void savePriorities();
                setStep(2);
              }}
              className="min-h-tap w-full sm:w-auto"
            >
              Show options
            </Button>
          </div>
        </Panel>
      )}

      {/* STEP 2: Compare, with optional refinements */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          {prioritiesSaved === "saved" ? (
            <p role="status" className="m-0 flex items-center gap-1.5 text-body-sm font-medium text-field">
              <Icon name="done" size={16} aria-hidden /> Saved to your farm profile. You can change it there too.
            </p>
          ) : prioritiesSaved === "failed" ? (
            <Message tone="caution" compact title="Your priorities were not saved">
              You can still compare options. Set them again in your farm profile.
            </Message>
          ) : null}
          <Message
            tone="info"
            role="status"
            title="Planning examples — not a ranked recommendation"
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
            {field.region === "yangon"
              ? "We don't have enough trusted data to rank options for Yangon Region yet. These examples are not a local recommendation. / ရန်ကုန်တိုင်းအတွက် အစီအစဉ်များကို အဆင့်သတ်မှတ်ရန် ယုံကြည်စိတ်ချရသော ဒေတာ မလုံလောက်သေးပါ။ ဤဥပမာများသည် ဒေသအလိုက် အကြံပြုချက်မဟုတ်ပါ။"
              : "These examples are not ranked. Compare saved crops and field evidence before treating an option as suitable. / ဤဥပမာများကို အဆင့်မသတ်မှတ်ထားပါ။ သင့်သီးနှံမှတ်တမ်းနှင့် စိုက်ခင်းအချက်အလက်များကို စစ်ဆေးပြီးမှ သင့်တော်မှုကို ဆုံးဖြတ်ပါ။"}
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
            hasConfirmedSoil={false}
            hasConfirmedDrainageDate={false}
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
                        Example sequence
                      </span>
                      {status === "feasible" ? (
                        <span className="flex items-center gap-1 text-source font-medium text-healthy">
                          <Icon name="done" size={14} /> No conflict found
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

                    {cand.feasibility.hardConstraintVetoes.includes("BUDGET_EXCEEDED") ? (
                      <Message tone="problem" compact title="May cost more than your budget">
                        The whole sequence is checked against the limit you set.
                      </Message>
                    ) : null}
                    {cand.feasibility.hardConstraintVetoes.some((v) => v.startsWith("WATER_UNAVAILABLE")) ? (
                      <Message tone="problem" compact title="Needs dry-season irrigation">
                      You confirmed that this field has rain only.
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
                    aria-label={isSelected ? "Your choice" : "Choose this option"}
                    className="mt-2 w-full min-h-tap"
                  >
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="done" size={16} />
                        <Bilingual en="Your choice" my="သင့်ရွေးချယ်မှု" />
                      </span>
                    ) : (
                      <Bilingual en="Choose this option" my="ဤအစီအစဉ်ကို ရွေးမည်" />
                    )}
                  </Button>
                </Panel>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 border-t border-line pt-4">
            <Button
              variant="primary"
              size="lg"
              iconEnd="next"
              disabled={!selectedCandidate || selectedCandidate.feasibility.status === "infeasible"}
              onClick={() => setStep(3)}
              aria-label={selectedCandidate ? `Continue with ${selectedCandidate.title}` : "Choose an option to continue"}
              className="min-h-tap w-full sm:w-auto"
            >
              {selectedCandidate ? (
                <Bilingual en={`Continue with ${selectedCandidate.title}`} my={`${selectedCandidate.titleMy} ဖြင့် ဆက်လုပ်မည်`} />
              ) : (
                <Bilingual en="Choose an option to continue" my="ဆက်လုပ်ရန် ရွေးချယ်စရာတစ်ခု ရွေးပါ" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Plan & checklist */}
      {step === 3 && selectedCandidate && (
        <Panel as="section" className="flex flex-col gap-6 p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-headline font-semibold text-ink">{selectedCandidate.title}</h2>
            <p className="m-0 text-body-sm text-ink-muted">
              Enter the dates you plan to use. No dates are preselected; check the local planting calendar before saving.
            </p>
            <p lang="my" className="m-0 text-body-sm text-ink-muted">စိုက်ပျိုးရန် စီစဉ်ထားသော ရက်များကို ထည့်ပါ။ ကြိုတင်ရက်သတ်မှတ်ထားခြင်း မရှိပါ။ မသိမ်းမီ ဒေသ၏ စိုက်ပျိုးချိန်ကို စစ်ဆေးပါ။</p>
          </div>

          <div className="flex flex-col gap-3">
            <Bilingual en="Crop sequence" my="သီးနှံအစီအစဉ်" className="text-label font-semibold text-ink" />
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
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-source text-ink-muted">
                          <Bilingual en="Sow date (DD/MM/YYYY)" my="စိုက်ပျိုးမည့်ရက် (ရက်/လ/ခုနှစ်)" />
                          <input
                            type="date"
                            required
                            value={s.plantDate}
                            onChange={(event) => setDateEdits((prev) => ({
                              ...prev,
                              [`${selectedCandidate.id}:${s.id}`]: {
                                ...prev[`${selectedCandidate.id}:${s.id}`],
                                plantDate: event.target.value,
                              },
                            }))}
                            className="min-h-tap rounded-sm border border-line-strong bg-surface px-2 text-body text-ink"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-source text-ink-muted">
                          <Bilingual en="Harvest date (DD/MM/YYYY)" my="ရိတ်သိမ်းမည့်ရက် (ရက်/လ/ခုနှစ်)" />
                          <input
                            type="date"
                            required
                            value={s.harvestDate}
                            onChange={(event) => setDateEdits((prev) => ({
                              ...prev,
                              [`${selectedCandidate.id}:${s.id}`]: {
                                ...prev[`${selectedCandidate.id}:${s.id}`],
                                harvestDate: event.target.value,
                              },
                            }))}
                            className="min-h-tap rounded-sm border border-line-strong bg-surface px-2 text-body text-ink"
                          />
                        </label>
                      </div>
                      <p className="m-0 text-source text-ink-muted">
                        {s.plantDate && s.harvestDate
                          ? `Your dates: ${formatDay(s.plantDate)} to ${formatDay(s.harvestDate)} (${daysBetween(s.plantDate, s.harvestDate)} days).`
                          : "Enter both dates; check the sowing window with a local adviser."}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-pill border border-dashed border-line-strong px-2.5 py-1 text-source font-medium text-ink-muted">
                    Dates to enter
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
              <li><Bilingual en="Test seed germination with a wet cloth 7 days before sowing." my="မစိုက်မီ ၇ ရက်အလိုတွင် မျိုးစေ့ကို စိုသောအဝတ်ဖြင့် အပင်ပေါက်နှုန်း စမ်းသပ်ပါ။" /></li>
              <li><Bilingual en="Clear drainage ditches so water does not stand after the monsoon." my="မိုးရာသီနောက်တွင် ရေမတင်စေရန် ရေနုတ်မြောင်းများ ရှင်းလင်းပါ။" /></li>
              <li><Bilingual en="Check local buying prices before you spend on seed." my="မျိုးစေ့ဝယ်ယူစရိတ် မသုံးမီ ဒေသဈေးနှုန်းကို စစ်ဆေးပါ။" /></li>
              {stillToCheck(selectedCandidate.feasibility, budget).length > 0 ? (
                <li>Confirm what was not checked: {stillToCheck(selectedCandidate.feasibility, budget).join(", ")}.</li>
              ) : null}
              <li><Bilingual en={<><strong>Important:</strong> This tool supports your decision. Check the field yourself and ask a local extension adviser where unsure.</>} my="အရေးကြီးသည်။ ဤကိရိယာသည် သင့်ဆုံးဖြတ်ချက်ကို ကူညီရန်သာဖြစ်သည်။ သင့်စိုက်ခင်းကို ကိုယ်တိုင်စစ်ဆေးပြီး မသေချာပါက ဒေသစိုက်ပျိုးရေးပညာရှင်နှင့် တိုင်ပင်ပါ။" /></li>
            </ul>
          </div>

          {dateError ? (
            <Message tone="needs" role="alert" title="Check the dates before saving">
              Enter both dates for every crop. Harvest must follow sowing, the next crop must follow the prior harvest, and sowing dates must not be in the past.
            </Message>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="primary"
              size="lg"
              disabled={savingPlan || selectedCandidate.feasibility.status === "infeasible" || dateError}
              aria-label={savingPlan ? "Saving plan…" : "Save this plan"}
              onClick={async () => {
                setSavingPlan(true);
                setSaveMessage("");
                try {
                  await onApplyPlan(selectedCandidate.rotation.slots, selectedCandidate.rotation.cycleYears ?? cycleYears);
                  setSaveFailed(false);
                  setSaveMessage("Plan saved on this phone. Its suggested dates still need your review.");
                } catch {
                  setSaveFailed(true);
                  setSaveMessage("Could not save the plan. Check that this phone allows saving, then try again.");
                } finally {
                  setSavingPlan(false);
                }
              }}
              className="min-h-tap w-full sm:w-auto"
            >
              <Bilingual en={savingPlan ? "Saving plan…" : "Save this plan"} my={savingPlan ? "သိမ်းဆည်းနေပါသည်…" : "ဤအစီအစဉ်ကို သိမ်းမည်"} />
            </Button>
            {saveMessage ? (
              <Message
                className="w-full"
                role="status"
                tone={saveFailed ? "problem" : "success"}
                title={saveFailed ? "Plan save failed" : "Plan saved on this phone"}
              >
                {saveFailed ? "Check that this phone allows saving, then try again." : "Its suggested dates still need your review."}
              </Message>
            ) : null}
          </div>
        </Panel>
      )}
    </div>
  );
}
