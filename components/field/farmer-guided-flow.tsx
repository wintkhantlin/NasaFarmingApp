"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { getCropById } from "@/lib/data/crops";
import { getRealWorldCropEconomics } from "@/lib/data/crops/real-world-economics";
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
import { daysBetween } from "@/lib/rotation-format";

export interface FarmerGuidedFlowProps {
  field: Field;
  currentSlots: RotationSlot[];
  cycleYears: 1 | 2 | 3 | 4;
  onApplyPlan: (slots: RotationSlot[], cycleYears: 1 | 2 | 3 | 4) => void;
  onSwitchToAdvanced: () => void;
  className?: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

const PRIORITY_OPTIONS: Array<{
  id: FarmerTopPriority;
  titleEn: string;
  titleMy: string;
  descEn: string;
  descMy: string;
  icon: string;
}> = [
  {
    id: "profit",
    titleEn: "Earn more",
    titleMy: "ဝင်ငွေပိုရရှိရန်",
    descEn: "Maximize seasonal gross margin with high-value crops",
    descMy: "စျေးကွက်ဝင်သီးနှံများဖြင့် ဝင်ငွေအများဆုံးရရှိစေရန်",
    icon: "trends",
  },
  {
    id: "low_water",
    titleEn: "Use less water",
    titleMy: "ရေလိုအပ်ချက်နည်းရန်",
    descEn: "Target drought-tolerant crops requiring minimal irrigation",
    descMy: "ရေသွင်းနည်းသော မိုးခေါင်ဒဏ်ခံသီးနှံများ စိုက်ပျိုးရန်",
    icon: "water",
  },
  {
    id: "low_cash",
    titleEn: "Spend less upfront",
    titleMy: "စိုက်ထုတ်ငွေနည်းရန်",
    descEn: "Keep seed, fertilizer, and tractor costs low",
    descMy: "မျိုးစေ့၊ မြေသြဇာနှင့် လုပ်အားခကုန်ကျစရိတ် ချွေတာရန်",
    icon: "cost",
  },
  {
    id: "reliable_harvest",
    titleEn: "Lower risk / reliable",
    titleMy: "ဆုံးရှုံးနိုင်ခြေနည်းရန်",
    descEn: "Proven staple varieties with predictable local yields",
    descMy: "ရာသီဥတုဖောက်ပြန်မှုဒဏ်ခံနိုင်ပြီး အထွက်နှုန်းတည်ငြိမ်စေရန်",
    icon: "done",
  },
  {
    id: "soil_improvement",
    titleEn: "Keep soil healthy",
    titleMy: "မြေဆီလွှာကောင်းမွန်ရန်",
    descEn: "Rotate nitrogen-fixing legumes and maintain soil cover",
    descMy: "နိုက်ထရိုဂျင်ဖြည့်ပေးသော ပဲမျိုးစုံဖြင့် မြေဆီလွှာထိန်းသိမ်းရန်",
    icon: "rotation",
  },
];

export function FarmerGuidedFlow({
  field,
  currentSlots,
  cycleYears,
  onApplyPlan,
  onSwitchToAdvanced,
  className,
}: FarmerGuidedFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [unit, setUnit] = useState<"acre" | "ha">("acre");

  // Farmer Decision Inputs State
  const [farmerInputs, setFarmerInputs] = useState<FarmerDecisionInput>({
    topPriorities: ["profit", "low_water"],
    availableWater: field.irrigation === "none" ? "rainfed" : field.irrigation === "full" ? "reliable_irrigation" : "unknown",
    equipment: "tractor_tiller",
    budgetMaxMmkHa: null,
    canSellCropIds: [],
    avoidCropIds: [],
    farmerObservedDrainage: "adequate",
  });

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("plan-pulse");

  // Area conversion: 1 ha = 2.47105 acres
  const areaDisplay = useMemo(() => {
    if (!field.areaHa) return null;
    if (unit === "acre") {
      return `${(field.areaHa * 2.47105).toFixed(1)} acres (${field.areaHa.toFixed(1)} ha)`;
    }
    return `${field.areaHa.toFixed(1)} ha (${(field.areaHa * 2.47105).toFixed(1)} acres)`;
  }, [field.areaHa, unit]);

  // Generate 3 Real Candidate Sequences for comparison
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

    const pulseFeas = classifyRotationFeasibility(ricePulseRot, farmerInputs);
    const sesameFeas = classifyRotationFeasibility(riceSesameRot, farmerInputs);
    const doubleRiceFeas = classifyRotationFeasibility(doubleRiceRot, farmerInputs);

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
        title: "Rice → Black Gram (မိုးစပါး - မတ်ပဲ)",
        titleMy: "မိုးစပါး - မတ်ပဲ သီးလှည့်စိုက်ပျိုးနည်း",
        rotation: ricePulseRot,
        feasibility: pulseFeas,
        estimatedMarginMmkHa: pulseMargin.grossMarginMmkHa,
        committedCashMmkHa: pulseMargin.committedCashAtRiskMmkHa,
        waterRisk: "Low: pulse establishes on residual monsoon moisture; zero supplemental irrigation required.",
        whyThisOption: "Matches residual moisture in clay/clay-loam soils; fixes biological nitrogen for the next season.",
        mainRisk: "Unseasonal flowering rainfall (>10 mm) or waterlogging if field drainage is slow.",
        localCheck: "Check subsoil moisture at 20 cm and ensure surface drainage ditches are cleared.",
        isCurrent: currentSlots.some((s) => s.cropId === "black-gram"),
      },
      {
        id: "plan-sesame",
        title: "Rice → Sesame (မိုးစပါး - နှမ်း)",
        titleMy: "မိုးစပါး - နှမ်း သီးလှည့်စိုက်ပျိုးနည်း",
        rotation: riceSesameRot,
        feasibility: sesameFeas,
        estimatedMarginMmkHa: sesameMargin.grossMarginMmkHa,
        committedCashMmkHa: sesameMargin.committedCashAtRiskMmkHa,
        waterRisk: "Low to Moderate: deep taproot tolerates dry spell but requires friable tilth for germination.",
        whyThisOption: "High unit market price; acts as a non-host break crop against legume soil pathogens.",
        mainRisk: "Sensitive to standing water; poor germination in heavy puddled clay without seedbed tillage.",
        localCheck: "Verify topsoil friability and ensure soil is not waterlogged at sowing.",
        isCurrent: currentSlots.some((s) => s.cropId === "sesame"),
      },
      {
        id: "plan-double-rice",
        title: "Rice → Summer Rice (မိုးစပါး - နွေစပါး)",
        titleMy: "မိုးစပါး - နွေစပါး သီးထပ်စိုက်ပျိုးနည်း",
        rotation: doubleRiceRot,
        feasibility: doubleRiceFeas,
        estimatedMarginMmkHa: summerRiceMargin.grossMarginMmkHa,
        committedCashMmkHa: summerRiceMargin.committedCashAtRiskMmkHa,
        waterRisk: "High: requires 900–1,200 mm continuous irrigation through hot dry months.",
        whyThisOption: "High volume grain yield for farms with confirmed canal or tube-well irrigation access.",
        mainRisk: "Severe crop failure if canal water runs dry or pumping fuel costs spike.",
        localCheck: "Verify pump fuel supply and guaranteed canal water schedule with local irrigation officer.",
        isCurrent: currentSlots.filter((s) => s.cropId === "rice").length > 1,
      },
    ];
  }, [field.id, farmerInputs, currentSlots]);

  const togglePriority = (pId: FarmerTopPriority) => {
    setFarmerInputs((prev) => {
      const exists = prev.topPriorities.includes(pId);
      if (exists) {
        if (prev.topPriorities.length === 1) return prev; // keep at least 1
        return { ...prev, topPriorities: prev.topPriorities.filter((x) => x !== pId) };
      }
      if (prev.topPriorities.length >= 2) {
        // Keep max 2
        return { ...prev, topPriorities: [prev.topPriorities[1], pId] };
      }
      return { ...prev, topPriorities: [...prev.topPriorities, pId] };
    });
  };

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0];

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Step Indicator Header */}
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-pill bg-field text-on-field font-mono text-source font-semibold">
              {step}
            </span>
            <span className="text-headline text-ink font-semibold">
              {step === 1 && "Step 1: Your Field (လယ်မြေအချက်အလက်)"}
              {step === 2 && "Step 2: Tell Us About Your Farm (စိုက်ပျိုးရေးအခြေအနေ)"}
              {step === 3 && "Step 3: What's Most Important? (ဦးစားပေးရွေးချယ်မှု)"}
              {step === 4 && "Step 4: Compare Rotations (သီးလှည့်အစီအစဉ်များ နှိုင်းယှဉ်ချက်)"}
              {step === 5 && "Step 5: My Plan & Field Checklist (စိုက်ပျိုးမည့်အစီအစဉ်)"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="quiet"
              onClick={onSwitchToAdvanced}
              className="text-field font-medium text-body-sm"
            >
              🔬 Advanced Timeline
            </Button>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="flex h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunken">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={cn(
                "flex-1 border-r border-surface transition-colors",
                s <= step ? "bg-field" : "bg-transparent",
              )}
            />
          ))}
        </div>
      </div>

      {/* STEP 1: Field Confirmation */}
      {step === 1 && (
        <Panel as="section" className="flex flex-col gap-5 p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-headline text-ink font-semibold">
              Confirm your field details (လယ်မြေစစ်ဆေးခြင်း)
            </h2>
            <p className="m-0 text-body-sm text-ink-muted">
              We tailor crop dates and water availability to your field location and soil.
            </p>
          </div>

          <div className="grid gap-3 rounded-lg border border-line bg-surface-sunken p-4 sm:grid-cols-2">
            <div>
              <span className="text-source text-ink-muted">Field Name</span>
              <p className="m-0 text-label font-semibold text-ink">{field.name}</p>
            </div>
            <div>
              <span className="text-source text-ink-muted">Region</span>
              <p className="m-0 text-label font-semibold text-ink capitalize">
                {field.region ?? "Ayeyarwady Delta (ဧရာဝတီတိုင်း)"}
              </p>
            </div>
            <div>
              <span className="text-source text-ink-muted">Field Size (ယူနစ်)</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-label font-semibold text-ink">
                  {areaDisplay ?? "Unspecified"}
                </span>
                <button
                  type="button"
                  onClick={() => setUnit(unit === "acre" ? "ha" : "acre")}
                  className="rounded-md border border-line bg-surface px-2 py-0.5 text-source text-field font-medium cursor-pointer"
                >
                  Switch to {unit === "acre" ? "Hectares" : "Acres"}
                </button>
              </div>
            </div>
            <div>
              <span className="text-source text-ink-muted">Coordinates</span>
              <p className="m-0 font-mono text-source text-ink">
                {field.centroid[1].toFixed(4)}°N, {field.centroid[0].toFixed(4)}°E
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="lg"
              iconEnd="next"
              onClick={() => setStep(2)}
              className="min-h-tap w-full sm:w-auto"
            >
              Continue to Farm Conditions
            </Button>
          </div>
        </Panel>
      )}

      {/* STEP 2: Farming Constraints */}
      {step === 2 && (
        <Panel as="section" className="flex flex-col gap-6 p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-headline text-ink font-semibold">
              Tell us about your farm (စိုက်ပျိုးရေးအခြေအနေ)
            </h2>
            <p className="m-0 text-body-sm text-ink-muted">
              Pre-filled from your field profile. Change anything or choose &apos;Unknown&apos;.
            </p>
          </div>

          {/* Water Access */}
          <div className="flex flex-col gap-2">
            <p className="text-label font-semibold text-ink">
              1. Dry season water access (နွေရာသီရေရရှိနိုင်မှု)
            </p>
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { id: "rainfed", label: "Rainfed only", sub: "မိုးကောင်းသောက် (ရေမသွင်းနိုင်)" },
                { id: "occasional_irrigation", label: "Occasional irrigation", sub: "ရေ ၁-၂ ကြိမ်သွင်းနိုင်" },
                { id: "reliable_irrigation", label: "Reliable irrigation", sub: "မြောင်းရေ/စက်ရေအပြည့်" },
                { id: "unknown", label: "Unknown / Not sure", sub: "မသေချာပါ" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFarmerInputs({ ...farmerInputs, availableWater: opt.id as FarmerWaterAccess })}
                  className={cn(
                    "flex min-h-tap flex-col items-start rounded-lg border p-3 text-left transition-colors cursor-pointer",
                    farmerInputs.availableWater === opt.id
                      ? "border-field bg-field-soft text-ink ring-2 ring-field/30"
                      : "border-line bg-surface hover:bg-surface-sunken",
                  )}
                >
                  <span className="text-body-sm font-semibold">{opt.label}</span>
                  <span className="text-source text-ink-muted mt-0.5">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Equipment & Labor */}
          <div className="flex flex-col gap-2">
            <label className="text-label font-semibold text-ink">
              2. Available machinery / labor (စက်ယန္တရားနှင့် လုပ်သား)
            </label>
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { id: "tractor_tiller", label: "Power tiller / tractor", sub: "ထွန်စက်/လက်တွန်းထွန်စက်" },
                { id: "manual", label: "Manual labor only", sub: "လူအားသက်သက်" },
                { id: "seeder", label: "Direct seeder / drill", sub: "အစေ့ချကိရိယာ" },
                { id: "unknown", label: "Unknown / Other", sub: "အခြား / မသေချာ" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFarmerInputs({ ...farmerInputs, equipment: opt.id as FarmerLaborEquipment })}
                  className={cn(
                    "flex min-h-tap flex-col items-start rounded-lg border p-3 text-left transition-colors cursor-pointer",
                    farmerInputs.equipment === opt.id
                      ? "border-field bg-field-soft text-ink ring-2 ring-field/30"
                      : "border-line bg-surface hover:bg-surface-sunken",
                  )}
                >
                  <span className="text-body-sm font-semibold">{opt.label}</span>
                  <span className="text-source text-ink-muted mt-0.5">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Budget Limit (Optional) */}
          <div className="flex flex-col gap-2">
            <label className="text-label font-semibold text-ink">
              3. Cash budget limit per acre (စိုက်ထုတ်ငွေကန့်သတ်ချက် - ထည့်သွင်းရန် မလိုပါ)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {[
                { val: null, label: "No strict limit (ကန့်သတ်ချက်မရှိ)" },
                { val: 600000, label: "Under 600,000 MMK/acre" },
                { val: 1000000, label: "Under 1,000,000 MMK/acre" },
              ].map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFarmerInputs({ ...farmerInputs, budgetMaxMmkHa: opt.val })}
                  className={cn(
                    "min-h-tap rounded-pill border px-4 py-2 text-label font-medium transition-colors cursor-pointer",
                    farmerInputs.budgetMaxMmkHa === opt.val
                      ? "border-field bg-field text-on-field"
                      : "border-line bg-surface text-ink hover:border-line-strong",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-line">
            <Button variant="secondary" onClick={() => setStep(1)} className="min-h-tap">
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              iconEnd="next"
              onClick={() => setStep(3)}
              className="min-h-tap"
            >
              Continue to Priorities
            </Button>
          </div>
        </Panel>
      )}

      {/* STEP 3: Priorities Picker */}
      {step === 3 && (
        <Panel as="section" className="flex flex-col gap-6 p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-headline text-ink font-semibold">
              What&apos;s most important to you? (သင့်အတွက် အရေးကြီးဆုံးအချက်များ)
            </h2>
            <p className="m-0 text-body-sm text-ink-muted">
              Choose your top 1 or 2 priorities. We reorder the best rotations to match.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PRIORITY_OPTIONS.map((opt) => {
              const selected = farmerInputs.topPriorities.includes(opt.id);
              const rankNum = farmerInputs.topPriorities.indexOf(opt.id) + 1;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => togglePriority(opt.id)}
                  className={cn(
                    "flex min-h-tap flex-col gap-2 rounded-xl border p-4 text-left transition-all cursor-pointer shadow-xs",
                    selected
                      ? "border-field bg-field-soft text-ink ring-2 ring-field/40"
                      : "border-line bg-surface hover:border-line-strong hover:bg-surface-sunken",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-headline font-semibold text-ink flex items-center gap-2">
                      <Icon name={opt.icon as IconName} size={20} className="text-field" />
                      {opt.titleEn}
                    </span>
                    {selected ? (
                      <span className="grid size-6 place-items-center rounded-pill bg-field text-on-field font-mono text-source font-bold">
                        #{rankNum}
                      </span>
                    ) : null}
                  </div>
                  <p className="m-0 text-body-sm text-ink font-medium">{opt.titleMy}</p>
                  <p className="m-0 text-source text-ink-muted">{opt.descEn}</p>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between pt-4 border-t border-line">
            <Button variant="secondary" onClick={() => setStep(2)} className="min-h-tap">
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              iconEnd="next"
              onClick={() => setStep(4)}
              className="min-h-tap"
            >
              Compare Recommended Rotations
            </Button>
          </div>
        </Panel>
      )}

      {/* STEP 4: Compare Rotations */}
      {step === 4 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-headline text-ink font-semibold">
              Compare 3 Candidate Rotations (သီးလှည့်အစီအစဉ်များ နှိုင်းယှဉ်ချက်)
            </h2>
            <p className="m-0 text-body-sm text-ink-muted">
              Evaluated using verified crop physiology, local market economics, and satellite climate context.
            </p>
          </div>

          {/* Moisture Clock Ribbon (U-03) */}
          <MoistureClockRibbon
            hasConfirmedSoil={Boolean(field.soilOverride?.texture || field.soilObservations?.length)}
            hasConfirmedDrainageDate={true}
            awcMmPerM={140}
            thetaSat={0.48}
            thetaFc={0.34}
            pondAtDrainageMm={25}
          />

          {/* Candidate Cards Grid */}
          <div className="grid gap-4 lg:grid-cols-3">
            {candidates.map((cand, idx) => {
              const isSelected = cand.id === selectedCandidateId;
              const isFeasible = cand.feasibility.status === "feasible";
              const isNeedsReview = cand.feasibility.status === "needs_review";

              return (
                <Panel
                  as="article"
                  key={cand.id}
                  className={cn(
                    "flex flex-col justify-between gap-4 p-5 rounded-xl border transition-all shadow-xs",
                    isSelected
                      ? "border-field bg-surface ring-2 ring-field/50"
                      : "border-line bg-surface hover:border-line-strong",
                  )}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-pill bg-field-soft px-2.5 py-0.5 text-source font-semibold text-field">
                        Option #{idx + 1}
                      </span>
                      {isFeasible ? (
                        <span className="flex items-center gap-1 text-source font-medium text-healthy">
                          <Icon name="done" size={14} /> Feasible (စိုက်နိုင်)
                        </span>
                      ) : isNeedsReview ? (
                        <span className="flex items-center gap-1 text-source font-medium text-drought">
                          ⚠️ Needs Check
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-source font-medium text-heat">
                          ❌ Excluded by constraint
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="m-0 text-headline font-bold text-ink">{cand.title}</h3>
                      <p className="m-0 mt-0.5 text-source text-ink-muted font-medium">{cand.titleMy}</p>
                    </div>

                    {/* Financial Range */}
                    <div className="rounded-lg bg-surface-sunken p-3">
                      <span className="text-source text-ink-muted">Est. Gross Margin per ha</span>
                      <p className="m-0 text-headline font-bold text-ink">
                        {Math.round(cand.estimatedMarginMmkHa[0] / 100000).toLocaleString()}L – {Math.round(cand.estimatedMarginMmkHa[1] / 100000).toLocaleString()}L MMK
                      </p>
                      <span className="text-source text-ink-muted">
                        Cash committed: ~{Math.round(cand.committedCashMmkHa).toLocaleString()} MMK/ha
                      </span>
                    </div>

                    {/* Explanations */}
                    <div className="flex flex-col gap-2 text-body-sm">
                      <div>
                        <strong className="text-ink">Why this option: </strong>
                        <span className="text-ink-muted">{cand.whyThisOption}</span>
                      </div>
                      <div>
                        <strong className="text-heat">Main risk: </strong>
                        <span className="text-ink-muted">{cand.mainRisk}</span>
                      </div>
                      <div className="rounded-md bg-field-soft/40 p-2 text-source">
                        <strong className="text-field">Check locally: </strong>
                        <span className="text-ink">{cand.localCheck}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant={isSelected ? "primary" : "secondary"}
                    onClick={() => setSelectedCandidateId(cand.id)}
                    className="w-full mt-2 min-h-tap"
                  >
                    {isSelected ? "✓ Selected Plan" : "Choose this rotation"}
                  </Button>
                </Panel>
              );
            })}
          </div>

          <div className="flex justify-between pt-4 border-t border-line">
            <Button variant="secondary" onClick={() => setStep(3)} className="min-h-tap">
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              iconEnd="next"
              onClick={() => setStep(5)}
              className="min-h-tap"
            >
              Continue with {selectedCandidate.title}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: My Plan & Pre-Plant Field Checklist */}
      {step === 5 && (
        <Panel as="section" className="flex flex-col gap-6 p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-headline text-ink font-semibold">
              My Plan: {selectedCandidate.title}
            </h2>
            <p className="m-0 text-body-sm text-ink-muted">
              Monthly crop sequence and practical pre-planting checks.
            </p>
          </div>

          {/* Sequence Timeline */}
          <div className="flex flex-col gap-3">
            <span className="text-label font-semibold text-ink">Crop Sequence by Month</span>
            <div className="flex flex-col gap-2">
              {selectedCandidate.rotation.slots.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-6 place-items-center rounded-pill bg-field text-on-field font-mono text-source font-bold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="m-0 text-label font-semibold text-ink">
                        {getCropById(s.cropId ?? "")?.names.common ?? s.cropId}
                      </p>
                      <p className="m-0 text-source text-ink-muted">
                        Sowing: {s.plantDate} → Harvest: {s.harvestDate} ({daysBetween(s.plantDate, s.harvestDate)}d)
                      </p>
                    </div>
                  </div>
                  <span className="rounded-pill bg-surface-sunken px-2.5 py-1 text-source font-medium text-ink capitalize">
                    {s.establishmentMode?.replace("_", " ") ?? "Standard"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Field Checklist Card */}
          <div className="flex flex-col gap-3 rounded-lg border border-field/30 bg-field-soft/20 p-4">
            <div className="flex items-center gap-2">
              <Icon name="done" size={18} className="text-field" />
              <span className="text-label font-semibold text-ink">
                Pre-Planting Field Checklist (စိုက်ပျိုးမီ လက်တွေ့စစ်ဆေးရမည့်အချက်များ)
              </span>
            </div>
            <ul className="m-0 flex flex-col gap-1.5 pl-5 text-body-sm text-ink">
              <li>Check seed germination rate with a wet cloth test 7 days before sowing.</li>
              <li>Verify soil drainage ditches to prevent water stagnation after monsoon rains.</li>
              <li>Inspect local wholesale depot price trends before committing seed budget.</li>
              <li>
                <strong>Important:</strong> This tool supports your decision; inspect actual field moisture and seek local agricultural extension advice where uncertain.
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-line">
            <Button variant="secondary" onClick={() => setStep(4)} className="min-h-tap">
              Back to Compare
            </Button>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={onSwitchToAdvanced}
                className="min-h-tap"
              >
                Inspect Advanced Timeline
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  onApplyPlan(selectedCandidate.rotation.slots, selectedCandidate.rotation.cycleYears ?? cycleYears);
                }}
                className="min-h-tap"
              >
                Save This Plan (သိမ်းဆည်းမည်)
              </Button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
