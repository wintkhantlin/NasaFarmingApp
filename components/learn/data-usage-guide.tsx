"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { useLocaleStore } from "@/lib/store/locale-store";

interface BilingualText {
  en: string;
  my: string;
}

interface DataSourceCard {
  id: string;
  name: BilingualText;
  badge: BilingualText;
  icon: IconName;
  whatData: BilingualText;
  howUsed: BilingualText;
  sourceOrg: string;
  resolution: string;
}

const DATA_SOURCES: DataSourceCard[] = [
  {
    id: "nasa-power",
    name: {
      en: "NASA POWER Weather & Climate",
      my: "NASA POWER မိုးလေဝသနှင့် ရာသီဥတုဒေတာ",
    },
    badge: { en: "Daily weather", my: "နေ့စဉ် ရာသီဥတု" },
    icon: "conditions",
    whatData: {
      en: "Daily high and low air temperatures, solar radiation, relative humidity, wind speed, and FAO-56 reference evapotranspiration (ET₀) from 2016 through 2025.",
      my: "၂၀၁၆ မှ ၂၀၂၅ ခုနှစ်အထိ နေ့စဉ် အမြင့်ဆုံးနှင့် အနိမ့်ဆုံး အပူချိန်၊ နေရောင်ခြည်စွမ်းအင်၊ လေထုစိုထိုင်းဆ၊ လေတိုက်နှုန်းနှင့် FAO-56 ရည်ညွှန်းရေငွေ့ပျံနှုန်း (ET₀)။",
    },
    howUsed: {
      en: "Replays 10 complete past seasons against your planned crop calendar to detect frost, heat stress at flowering, and multi-day dry spells.",
      my: "သီးနှံပွင့်ချိန်တွင် အပူဒဏ်၊ အအေးဒဏ်နှင့် မိုးခေါင်သည့်ရက်များကို စစ်ဆေးရန် အတိတ် ၁၀ နှစ်၏ နေ့စဉ်ရာသီဥတုဖြင့် ပြန်လည်စမ်းသပ်တွက်ချက်သည်။",
    },
    sourceOrg: "NASA Langley Research Center",
    resolution: "0.5° × 0.625° (~50 km)",
  },
  {
    id: "gpm-imerg",
    name: {
      en: "GPM IMERG Satellite Rainfall",
      my: "GPM IMERG ဂြိုဟ်တုမိုးရေချိန်",
    },
    badge: { en: "Precipitation", my: "မိုးရေချိန်" },
    icon: "water",
    whatData: {
      en: "Daily precipitation estimates combining multiple international earth observation satellites with ground-gauge calibration.",
      my: "နိုင်ငံတကာဂြိုဟ်တုများနှင့် မြေပြင်မိုးတိုင်းတာချက်များကို ပေါင်းစပ်ထားသော နေ့စဉ် မိုးရေချိန် ခန့်မှန်းချက်များ။",
    },
    howUsed: {
      en: "Measures actual rainfall during your crop's growing window and calculates whether rain covers crop water demand or leaves a shortfall.",
      my: "သီးနှံစိုက်ပျိုးကာလအတွင်း ရွာသွန်းသော မိုးရေပမာဏကို တိုင်းတာပြီး သီးနှံရေလိုအပ်ချက် ပြည့်မီခြင်း ရှိမရှိ သို့မဟုတ် လိုငွေရှိမရှိ တွက်ချက်သည်။",
    },
    sourceOrg: "NASA / JAXA Global Precipitation Measurement",
    resolution: "0.1° (~10 km)",
  },
  {
    id: "isric-soilgrids",
    name: {
      en: "ISRIC SoilGrids v2 Soil Properties",
      my: "ISRIC SoilGrids v2 မြေဆီလွှာဂုဏ်သတ္တိ",
    },
    badge: { en: "Topsoil model", my: "မြေဆီလွှာမော်ဒယ်" },
    icon: "soil",
    whatData: {
      en: "Global modelled estimates of soil texture (clay, silt, sand fractions), soil acidity (pH), soil organic carbon (SOC), and bulk density from 0 to 30 cm depth.",
      my: "မြေမျက်နှာပြင်မှ ၃၀ စင်တီမီတာအထိ မြေသားဖွဲ့စည်းပုံ (ရွှံ့၊ နုန်း၊ သဲ ရာခိုင်နှုန်း)၊ မြေချဉ်ငန်ဓာတ် (pH)၊ မြေဆီဩဂဲနစ်ကာဗွန် (SOC) ခန့်မှန်းချက်များ။",
    },
    howUsed: {
      en: "Screens whether proposed crops fit your soil acidity and drainage. Your own lab soil test or observation replaces this estimate whenever you enter one.",
      my: "ရွေးချယ်ထားသော သီးနှံများသည် မြေချဉ်ငန်ဓာတ်နှင့် ရေစီးဆင်းမှုနှင့် ကိုက်ညီမှုရှိမရှိ စစ်ဆေးသည်။ တောင်သူကိုယ်တိုင် မြေစစ်ဆေးချက်ထည့်ပါက ဤခန့်မှန်းချက်ကို အစားထိုးသည်။",
    },
    sourceOrg: "ISRIC — World Soil Information (Global 250 m)",
    resolution: "250 m grid",
  },
  {
    id: "landsat-srtm",
    name: {
      en: "USGS Landsat & SRTM Elevation",
      my: "Landsat စိမ်းလန်းစိုပြေမှုနှင့် SRTM မြေမျက်နှာသွင်ပြင်",
    },
    badge: { en: "Terrain & vegetation", my: "မြေပြင်နှင့် အပင်ဖုံးလွှမ်းမှု" },
    icon: "clay",
    whatData: {
      en: "30 m ground elevation model from the Shuttle Radar Topography Mission, paired with clear-day surface reflectance (NDVI/NDMI) from Landsat 8 and 9.",
      my: "၃၀ မီတာ မြေပြင်အမြင့်ပေ မော်ဒယ်နှင့် Landsat 8/9 ဂြိုဟ်တုမှ ကြည်လင်သောနေ့များ၏ မျက်နှာပြင် စိမ်းလန်းစိုပြေမှု (NDVI/NDMI) အချက်အလက်များ။",
    },
    howUsed: {
      en: "Calculates field slope to assess runoff and soil erosion hazards, and verifies seasonal ground cover periods between rotations.",
      my: "မြေဆီလွှာ တိုက်စားခံရနိုင်ခြေကို ဆန်းစစ်ရန် ကုန်းစောက်နှုန်းကို တွက်ချက်ပြီး သီးလှည့်စိုက်ပျိုးမှုများအကြား မြေဖုံးလွှမ်းမှုကို စစ်ဆေးသည်။",
    },
    sourceOrg: "NASA / USGS / Microsoft Planetary Computer",
    resolution: "30 m optical & radar",
  },
  {
    id: "myanmar-agronomy",
    name: {
      en: "Myanmar Agronomic Benchmarks & Prices",
      my: "မြန်မာ့စိုက်ပျိုးရေးစံနှုန်းများနှင့် ဈေးကွက်ဒေတာ",
    },
    badge: { en: "Crop library & markets", my: "သီးနှံဒေတာနှင့် ဈေးကွက်" },
    icon: "price",
    whatData: {
      en: "Department of Agriculture indicative seasonal calendars, FAO-56 crop coefficient stages (Kc), sensitive temperature thresholds, and 2024–2026 indicative wholesale market prices (MMK/kg).",
      my: "စိုက်ပျိုးရေးဦးစီးဌာန၏ ရာသီအလိုက် သီးနှံပြက္ခဒိန်၊ FAO-56 သီးနှံကိန်းဂဏန်းများ (Kc)၊ ထိခိုက်လွယ်သော အပူချိန်သတ်မှတ်ချက်များနှင့် ၂၀၂၄–၂၀၂၆ ကုန်စည်ဒိုင် လက်ကားဈေးနှုန်းများ (ကျပ်/ကီလို)။",
    },
    howUsed: {
      en: "Determines realistic sowing windows, evaluates crop duration in days, flags shared pest lifecycles, and projects gross margin ranges and cash at risk.",
      my: "သင့်လျော်သော စိုက်ပျိုးချိန်ကို သတ်မှတ်ခြင်း၊ ပိုးမွှားသံသရာ ကူးစက်နိုင်ခြေကို သတိပေးခြင်းနှင့် ဝင်ငွေ/စိုက်ထုတ်ငွေ ခန့်မှန်းချက်များကို တွက်ချက်သည်။",
    },
    sourceOrg: "Myanmar DoA, MPBMSMA & Bayintnaung Wholesale",
    resolution: "Township & national benchmarks",
  },
  {
    id: "farmer-inputs",
    name: {
      en: "Your Farm Records (On-Device Private)",
      my: "သင့်စိုက်ခင်းမှတ်တမ်း (ဖုန်းထဲတွင်သာ သိမ်းဆည်းထားသည်)",
    },
    badge: { en: "Your knowledge", my: "တောင်သူ့အချက်အလက်" },
    icon: "fields",
    whatData: {
      en: "Your field boundaries, current crop sequence, sowing and harvest dates, irrigation access (rain-only, pump, canal), farm machinery, and local soil tests.",
      my: "သင့်စိုက်ခင်းနယ်နိမိတ်၊ လက်ရှိစိုက်ပျိုးသည့် သီးနှံများ၊ စိုက်ချိန်/ရိတ်ချိန်၊ ရေရရှိနိုင်မှု (မိုးရေ၊ စက်ရေ၊ မြောင်းရေ)၊ စက်ယန္တရားနှင့် မြေစမ်းသပ်ချက်များ။",
    },
    howUsed: {
      en: "Drives all comparisons and filters out impractical crops. Stays stored privately in this browser on your device and is never sent to remote servers.",
      my: "နှိုင်းယှဉ်ချက်အားလုံးကို မောင်းနှင်ပြီး လက်တွေ့မကျသော သီးနှံများကို ဖယ်ထုတ်ပေးသည်။ သင့်ဖုန်း/ဘရောက်ဆာထဲတွင်သာ လုံခြုံစွာ သိမ်းထားသည်။",
    },
    sourceOrg: "You (the farmer / field manager)",
    resolution: "Field-specific",
  },
];

interface MethodologyStep {
  step: number;
  title: BilingualText;
  summary: BilingualText;
  dataInputs: string;
  scientificMethod: BilingualText;
  farmerBenefit: BilingualText;
  icon: IconName;
}

const METHODOLOGY_STEPS: MethodologyStep[] = [
  {
    step: 1,
    title: {
      en: "Replaying 10 Years of Historical Weather",
      my: "အတိတ် ၁၀ နှစ် ရာသီဥတုဖြင့် ပြန်လည်စစ်ဆေးခြင်း",
    },
    summary: {
      en: "We test your planned crop schedule across 10 complete past seasons of NASA daily observations.",
      my: "တောင်သူစိုက်ပျိုးမည့် သီးနှံပြက္ခဒိန်ကို အတိတ် ၁၀ နှစ်၏ တကယ့် NASA နေ့စဉ် ရာသီဥတုဖြင့် စမ်းသပ်စစ်ဆေးသည်။",
    },
    dataInputs: "NASA POWER daily air temperature, solar radiation, and GPM IMERG rainfall (2016–2025).",
    scientificMethod: {
      en: "Instead of relying on single long-term averages that hide seasonal extremes, the engine aligns your crop window against daily historical records. It counts how many seasons experienced water deficit, heat spikes exceeding crop physiological limits during flowering, or excessive late rains.",
      my: "ရာသီဥတုပြင်းထန်မှုများကို ဖုံးကွယ်တတ်သည့် ပျမ်းမျှကိန်းဂဏန်းတစ်ခုတည်းအပေါ် အခြေမခံဘဲ သီးနှံစိုက်ပျိုးချိန်ကို နေ့စဉ်ရာသီဥတုမှတ်တမ်းများနှင့် တိုက်ဆိုင်စစ်ဆေးသည်။ ပန်းပွင့်ချိန်တွင် အပူဒဏ်လွန်ကဲခြင်း သို့မဟုတ် မိုးခေါင်ခြင်း ကြုံတွေ့ခဲ့ရသည့် ရာသီအရေအတွက်ကို တိကျစွာ ရေတွက်သည်။",
    },
    farmerBenefit: {
      en: "Tells you honestly how frequently a crop copes with real local droughts and heatwaves, without guessing next year's forecast.",
      my: "ရှေ့နှစ် မိုးလေဝသကို မခန့်မှန်းဘဲ ဒေသတွင်း မိုးခေါင်မှုနှင့် အပူဒဏ်ကို ဤသီးနှံ မည်မျှခံနိုင်ရည်ရှိခဲ့သည်ကို အမှန်အတိုင်း ပြသပေးသည်။",
    },
    icon: "calendar",
  },
  {
    step: 2,
    title: {
      en: "Calculating Crop Water Demand & Rainfall Shortfall",
      my: "သီးနှံ ရေလိုအပ်ချက်နှင့် လိုငွေကို တွက်ချက်ခြင်း",
    },
    summary: {
      en: "We compute daily crop evapotranspiration (ETc) and compare it against satellite rainfall.",
      my: "သီးနှံ၏ နေ့စဉ်ရေလိုအပ်ချက် (ETc) ကို တွက်ချက်ပြီး ရွာသွန်းသော ဂြိုဟ်တုမိုးရေချိန်နှင့် နှိုင်းယှဉ်သည်။",
    },
    dataInputs: "FAO-56 single-crop coefficients (Kc) across growth stages + NASA POWER ET₀ + GPM IMERG rainfall.",
    scientificMethod: {
      en: "Using the international standard FAO-56 Penman-Monteith methodology, crop water demand is computed as ETc = Kc × ET₀ for initial, vegetative, mid-season flowering, and maturity stages. Daily shortfall equals max(0, ETc − Rain).",
      my: "နိုင်ငံတကာစံနှုန်း FAO-56 Penman-Monteith နည်းလမ်းအရ သီးနှံစိုက်ချိန်၊ ကြီးထွားချိန်၊ ပန်းပွင့်ချိန်နှင့် ရင့်မှည့်ချိန်တို့အတွက် သီးနှံရေလိုအပ်ချက်ကို ETc = Kc × ET₀ ဖြင့် တွက်သည်။ နေ့စဉ်ရေလိုငွေကို ETc − မိုးရေချိန် ဖြင့် တွက်ချက်သည်။",
    },
    farmerBenefit: {
      en: "Shows whether residual monsoon moisture will finish a winter pulse (like black gram or chickpea), or if supplemental irrigation is required to avoid yield loss.",
      my: "မိုးစပါးအပြီး မတ်ပဲ/ကုလားပဲ စိုက်ပျိုးရာတွင် မိုးကြွင်းစိုထိုင်းဆ လုံလောက်မှု ရှိမရှိ သို့မဟုတ် ရေသွင်းရန် လိုအပ်မလိုအပ် ရှင်းလင်းစွာ သိရှိနိုင်သည်။",
    },
    icon: "water",
  },
  {
    step: 3,
    title: {
      en: "Matching Soil Properties & Land Slope Suitability",
      my: "မြေဆီလွှာနှင့် ကုန်းစောက် ကိုက်ညီမှု စစ်ဆေးခြင်း",
    },
    summary: {
      en: "We check soil acidity (pH), texture, salinity, and drainage against crop tolerance limits.",
      my: "မြေချဉ်ငန်ဓာတ် (pH)၊ မြေသား၊ ဆားငန်ဓာတ်နှင့် ရေစီးဆင်းမှုတို့ကို သီးနှံခံနိုင်ရည်နှင့် တိုက်ဆိုင်စစ်ဆေးသည်။",
    },
    dataInputs: "ISRIC SoilGrids v2 (250 m) or farmer's entered soil test + SRTM 30 m slope elevation.",
    scientificMethod: {
      en: "Each crop species has defined agronomic thresholds for optimal, tolerated, and critical soil pH, salinity (ECe dS/m), waterlogging tolerance, and slope limit. Where heavy clay or high bunds trap water after monsoon rice, post-rice legumes are flagged for waterlogging risk.",
      my: "သီးနှံတိုင်းတွင် သင့်လျော်သော မြေချဉ်ငန်ဓာတ် (pH)၊ ဆားငန်နှုန်း၊ ရေဝပ်ခံနိုင်ရည်နှင့် ကုန်းစောက်သတ်မှတ်ချက်များ ရှိသည်။ မိုးစပါးအပြီး ရေဝပ်နိုင်သော ရွှံ့စေးမြေများတွင် ပဲမျိုးစုံအတွက် ရေဝပ်ပျက်စီးနိုင်ခြေကို ကြိုတင်သတိပေးသည်။",
    },
    farmerBenefit: {
      en: "Avoids planting crops that will fail in salty, overly acidic, or waterlogged fields, and highlights where a lab test is needed.",
      my: "ချဉ်လွန်းသောမြေ၊ ဆားငန်မြေ သို့မဟုတ် ရေဝပ်မြေများတွင် မစိုက်သင့်သော သီးနှံများကို ရှောင်ရှားနိုင်စေသည်။",
    },
    icon: "soil",
  },
  {
    step: 4,
    title: {
      en: "Screening Pests & Soil-Borne Disease Carryover",
      my: "ပိုးမွှားနှင့် မြေဆောင်ရောဂါ သံသရာ ကူးစက်မှု စစ်ဆေးခြင်း",
    },
    summary: {
      en: "We evaluate whether consecutive crops share common pathogens or if climate favors disease outbreaks.",
      my: "ဆက်တိုက်စိုက်ပျိုးသော သီးနှံများအကြား ရောဂါပိုး ကူးစက်နိုင်ခြေနှင့် ရာသီဥတုက ရောဂါဖြစ်ပွားမှုကို အားပေးခြင်း ရှိမရှိ စစ်ဆေးသည်။",
    },
    dataInputs: "Crop host-pathogen matrix + historical humidity and temperature records from NASA POWER.",
    scientificMethod: {
      en: "Analyzes rotation sequence pairings to detect soil-borne fungal persistence (e.g. Macrophomina phaseolina charcoal rot or Fusarium wilt) that survive in soil between identical crop families. Evaluates return intervals to encourage disease-breaking legume-cereal rotations.",
      my: "တူညီသော သီးနှံမျိုးရင်းများ ဆက်တိုက်စိုက်ခြင်းကြောင့် မြေတွင်းခိုအောင်းနေနိုင်သည့် မှိုရောဂါများ (ဥပမာ မတ်ပဲ/နှမ်း ပင်ညှိုးရောဂါ) ကို ဆန်းစစ်သည်။ ရောဂါသံသရာပြတ်စေမည့် သီးလှည့်စိုက်ပျိုးမှုကို အကြံပြုသည်။",
    },
    farmerBenefit: {
      en: "Protects soil health by recommending crops that break fungal pest cycles, reducing pesticide expenses.",
      my: "ပိုးမွှားနှင့် ရောဂါသံသရာ ပြတ်စေသော သီးလှည့်စိုက်ပျိုးမှုကို အသုံးပြုခြင်းဖြင့် ပိုးသတ်ဆေးစရိတ် လျှော့ချပြီး မြေဆီလွှာကျန်းမာရေးကို ထိန်းသိမ်းသည်။",
    },
    icon: "pest",
  },
  {
    step: 5,
    title: {
      en: "Modeling Economic Margins & Cash at Risk",
      my: "ဝင်ငွေအမြတ်အစွန်းနှင့် စိုက်ထုတ်ငွေ ခန့်မှန်းခြင်း",
    },
    summary: {
      en: "We compute low-to-high gross margin scenarios and upfront seasonal investment per hectare.",
      my: "တစ်ဟက်တာ (သို့မဟုတ် တစ်ဧက) လျှင် ရရှိနိုင်သော အမြတ်အစွန်းနှင့် ရိတ်သိမ်းချိန်မတိုင်မီ စိုက်ထုတ်ရမည့်ငွေကို ခန့်မှန်းသည်။",
    },
    dataInputs: "Myanmar Department of Agriculture indicative yields, variable costs, and wholesale commodity benchmarks.",
    scientificMethod: {
      en: "Calculates gross margin ranges as [Lowest Yield × Lowest Price − Highest Variable Cost] to [Highest Yield × Highest Price − Lowest Variable Cost]. Also quantifies committed cash-at-risk (seeds, land prep, fuel, inputs) before revenue is realized.",
      my: "အနိမ့်ဆုံးနှင့် အမြင့်ဆုံး အကျိုးအမြတ်ကို [အနိမ့်ဆုံးအထွက် × အနိမ့်ဆုံးဈေး − အမြင့်ဆုံးကုန်ကျစရိတ်] မှ [အမြင့်ဆုံးအထွက် × အမြင့်ဆုံးဈေး − အနိမ့်ဆုံးကုန်ကျစရိတ်] အထိ တွက်ချက်သည်။ ရိတ်သိမ်းချိန်မတိုင်မီ ကြိုတင်စိုက်ထုတ်ရမည့် စရိတ်ကို တွက်ပြသည်။",
    },
    farmerBenefit: {
      en: "Provides realistic financial scenarios without promising guaranteed profit, so you can budget seed, fuel, and fertilizer safely.",
      my: "မဖြစ်နိုင်သော အမြတ်ငွေကတိများ မပေးဘဲ ဖြစ်နိုင်ခြေရှိသော ငွေကြေးအခြေအနေကို ပြသသဖြင့် မျိုးစေ့၊ စက်သုံးဆီနှင့် မြေဩဇာစရိတ်ကို မှန်ကန်စွာ စီမံနိုင်သည်။",
    },
    icon: "trends",
  },
  {
    step: 6,
    title: {
      en: "Tailoring Rotation Rankings to Your Stated Priorities",
      my: "တောင်သူ့ဦးစားပေး ရွေးချယ်မှုအလိုက် အစီအစဉ်ချခြင်း",
    },
    summary: {
      en: "We rank rotation options to match what matters most to you, preparing evidence for discussion with your adviser.",
      my: "တောင်သူ အလေးထားဆုံးအချက် (ရေ၊ မြေ၊ ငွေ၊ သို့မဟုတ် စရိတ်သက်သာရေး) အလိုက် သီးလှည့်အစီအစဉ်များကို ဦးစားပေး စီစဉ်ပေးသည်။",
    },
    dataInputs: "Farmer's priority order (water, soil, income, forage, lower-inputs) + Multi-Criteria Decision Analysis (MCDA).",
    scientificMethod: {
      en: "Applies multi-criteria scoring where criteria weights are strictly governed by the farmer's ranked priorities. High priority goals receive dominant mathematical weight, but hard constraints (such as zero water access or exceeding budget limits) act as decisive vetoes.",
      my: "တောင်သူရွေးချယ်ထားသော ဦးစားပေးအချက်များအပေါ် အခြေခံ၍ Multi-Criteria Decision Analysis (MCDA) ဖြင့် အမှတ်ပေးတွက်ချက်သည်။ သို့သော် ရေလုံးဝမရှိခြင်း သို့မဟုတ် ငွေကြေးမလုံလောက်ခြင်းစသည့် ကန့်သတ်ချက်များရှိပါက ထိုသီးနှံကို ဖယ်ထုတ်သည်။",
    },
    farmerBenefit: {
      en: "Delivers balanced, evidence-backed options to discuss with township agricultural officers, never treating an app as a replacement for farmer judgment.",
      my: "စိုက်ပျိုးရေးဦးစီးဌာန တာဝန်ရှိသူများနှင့် တွေ့ဆုံဆွေးနွေးနိုင်ရန် ခိုင်လုံသော အထောက်အထားများ ပြင်ဆင်ပေးပြီး တောင်သူ့ဆုံးဖြတ်ချက်ကို အပြည့်အဝ လေးစားသည်။",
    },
    icon: "compare",
  },
];

export function DataUsageGuide() {
  const locale = useLocaleStore((s) => s.locale);
  const [activeTab, setActiveTab] = useState<"all" | "what" | "how">("all");

  const isBurmese = locale === "my";

  return (
    <div className="flex flex-col gap-6">
      {/* Lead Section */}
      <Panel tone="field" radius="lg" className="flex flex-col gap-3 p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="text-source font-semibold uppercase tracking-wider text-field">
            {isBurmese ? "ဒေတာနှင့် သိပ္ပံဆိုင်ရာ ရှင်းလင်းချက်" : "Data & Methodology"}
          </span>
          <h2 className="text-title text-ink">
            {isBurmese
              ? "Field Shift တွင် ဒေတာများကို မည်သို့အသုံးပြုသနည်း၊ မည်သည့်ဒေတာများ ပါဝင်သနည်း"
              : "What Data is Used and How It Powers Field Shift"}
          </h2>
          <p className="m-0 max-w-measure text-body text-ink-muted">
            {isBurmese
              ? "Field Shift သည် NASA ဂြိုဟ်တုဒေတာ၊ နိုင်ငံတကာ မြေဆီလွှာမော်ဒယ်များ၊ မြန်မာ့စိုက်ပျိုးရေး စံနှုန်းများနှင့် တောင်သူ့စိုက်ခင်းအချက်အလက်များကို ပေါင်းစပ်၍ သီးလှည့်စိုက်ပျိုးမှုဆိုင်ရာ ဆုံးဖြတ်ချက်များကို ပံ့ပိုးပေးပါသည်။"
              : "Field Shift combines satellite earth observations from NASA, global soil models, Myanmar agronomic benchmarks, and your own private farm knowledge to evaluate and compare multi-year crop rotations."}
          </p>
        </div>

        {/* View Filter Switcher */}
        <div className="pt-2">
          <Segmented
            legend={isBurmese ? "ကြည့်ရှုလိုသည့် အပိုင်း ရွေးပါ" : "Select section"}
            value={activeTab}
            onChange={(val) => setActiveTab(val as "all" | "what" | "how")}
            options={[
              { value: "all", label: isBurmese ? "အားလုံး (All)" : "All Overview" },
              { value: "what", label: isBurmese ? "၁။ အသုံးပြုသော ဒေတာများ" : "1. What Data is Used" },
              { value: "how", label: isBurmese ? "၂။ ဒေတာ အသုံးပြုပုံ" : "2. How Data is Used" },
            ]}
          />
        </div>
      </Panel>

      {/* SECTION 1: What Data is Used */}
      {(activeTab === "all" || activeTab === "what") && (
        <section id="what-data-used" aria-labelledby="what-data-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
            <div>
              <h3 id="what-data-title" className="m-0 text-title text-ink">
                {isBurmese ? "အသုံးပြုထားသော ဒေတာရင်းမြစ်များ" : "What Data is Used"}
              </h3>
              <p className="m-0 text-body-sm text-ink-muted">
                {isBurmese
                  ? "ဂြိုဟ်တုတိုင်းတာချက်များ၊ မြေဆီလွှာမြေပုံများနှင့် တောင်သူ့စိုက်ခင်းမှတ်တမ်းများ"
                  : "Transparent satellite measurements, soil databases, market records, and on-device farm inputs."}
              </p>
            </div>
            <Link
              href="/about/data"
              className="inline-flex min-h-tap items-center gap-1 text-label text-field hover:underline"
            >
              <span>{isBurmese ? "နည်းပညာပိုင်းဆိုင်ရာ အခြေအနေ ကြည့်ရန်" : "API adapter connection status"}</span>
              <Icon name="next" size={16} />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DATA_SOURCES.map((ds) => (
              <Panel key={ds.id} as="article" className="flex flex-col justify-between gap-3 p-4 sm:p-5">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-field-soft text-field">
                      <Icon name={ds.icon} size={20} />
                    </span>
                    <span className="rounded-pill border border-line bg-surface-sunken px-2 py-0.5 text-source font-medium text-ink-muted">
                      {isBurmese ? ds.badge.my : ds.badge.en}
                    </span>
                  </div>

                  <div>
                    <h4 className="m-0 text-label font-semibold text-ink">
                      {isBurmese ? ds.name.my : ds.name.en}
                    </h4>
                    <span className="text-source text-ink-muted font-mono">{ds.resolution}</span>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-line/60 pt-2 text-body-sm">
                    <span className="text-source font-semibold text-ink">
                      {isBurmese ? "ပါဝင်သော အချက်အလက်များ:" : "What it provides:"}
                    </span>
                    <p className="m-0 text-ink-muted">{isBurmese ? ds.whatData.my : ds.whatData.en}</p>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-line/60 pt-2 text-body-sm">
                    <span className="text-source font-semibold text-field">
                      {isBurmese ? "Field Shift တွင် အသုံးပြုပုံ:" : "How Field Shift uses it:"}
                    </span>
                    <p className="m-0 text-ink">{isBurmese ? ds.howUsed.my : ds.howUsed.en}</p>
                  </div>
                </div>

                <div className="border-t border-line pt-2 text-source text-ink-muted">
                  <span>{ds.sourceOrg}</span>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 2: How Data is Used */}
      {(activeTab === "all" || activeTab === "how") && (
        <section id="how-data-used" aria-labelledby="how-data-title" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 border-b border-line pb-2">
            <h3 id="how-data-title" className="m-0 text-title text-ink">
              {isBurmese ? "ဒေတာများကို မည်သို့ အသုံးပြုတွက်ချက်သနည်း" : "How Data is Used"}
            </h3>
            <p className="m-0 max-w-measure text-body-sm text-ink-muted">
              {isBurmese
                ? "အကြံဉာဏ်များကို မှန်းဆချက်ဖြင့် မပေးဘဲ အောက်ပါ သိပ္ပံနည်းကျ အဆင့် ၆ ဆင့်ဖြင့် တိကျစွာ တွက်ချက်စစ်ဆေးပါသည်:"
                : "Six transparent computational steps that convert satellite records and agronomic rules into personalized rotation advice:"}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {METHODOLOGY_STEPS.map((m) => (
              <Panel key={m.step} as="article" className="flex flex-col gap-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-pill bg-field font-mono text-source font-bold text-on-field">
                      {m.step}
                    </span>
                    <h4 className="m-0 text-headline font-semibold text-ink">
                      {isBurmese ? m.title.my : m.title.en}
                    </h4>
                  </div>
                  <span className="flex items-center gap-1.5 text-source text-field font-medium">
                    <Icon name={m.icon} size={16} />
                    <span>Step {m.step}</span>
                  </span>
                </div>

                <p className="m-0 text-body font-medium text-ink">
                  {isBurmese ? m.summary.my : m.summary.en}
                </p>

                <div className="grid gap-3 rounded-md bg-surface-sunken p-3.5 sm:grid-cols-2 text-body-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-source font-semibold text-ink-muted uppercase tracking-wide">
                      {isBurmese ? "အသုံးပြုသော ဒေတာ" : "Data inputs used"}
                    </span>
                    <span className="font-mono text-ink text-source">{m.dataInputs}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-source font-semibold text-field uppercase tracking-wide">
                      {isBurmese ? "တောင်သူအတွက် အကျိုးကျေးဇူး" : "Farmer benefit"}
                    </span>
                    <span className="text-ink font-medium">{isBurmese ? m.farmerBenefit.my : m.farmerBenefit.en}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-body-sm">
                  <span className="text-source font-semibold text-ink-muted">
                    {isBurmese ? "သိပ္ပံနည်းကျ တွက်ချက်မှု အသေးစိတ်:" : "Scientific method in detail:"}
                  </span>
                  <p className="m-0 text-ink-muted leading-relaxed">
                    {isBurmese ? m.scientificMethod.my : m.scientificMethod.en}
                  </p>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      )}

      {/* Trust & Verification Note */}
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 sm:p-5 text-body-sm text-ink-muted">
        <div className="flex items-center gap-2 text-label font-semibold text-ink">
          <Icon name="info" size={18} className="text-field" />
          <span>{isBurmese ? "ဒေတာအသုံးပြုမှုဆိုင်ရာ အခြေခံမူများ" : "Core Principles of Data Use"}</span>
        </div>
        <ul className="m-0 flex flex-col gap-1.5 pl-5 text-source text-ink-muted">
          <li>
            <strong>{isBurmese ? "အတိတ်အချက်အလက်ကိုသာ စစ်ဆေးသည် (ကြိုတင်မခန့်မှန်းပါ):" : "Historical replay, not forecasting:"}</strong>{" "}
            {isBurmese
              ? "ရှေ့လာမည့်နှစ် မိုးလေဝသကို မခန့်မှန်းနိုင်သော်လည်း လွန်ခဲ့သော ၁၀ နှစ်တာ တကယ့် ရာသီဥတုတွင် မည်သို့ဖြစ်ပျက်ခဲ့သည်ကို အမှန်အတိုင်း ပြသသည်။"
              : "We never invent unverified long-range weather predictions. We replay real past daily seasons so you can evaluate resilience against known historical weather extremes."}
          </li>
          <li>
            <strong>{isBurmese ? "တောင်သူ့မြေပြင်လက်တွေ့ကို မကျော်လွန်ပါ:" : "Satellite data never overrules local ground truth:"}</strong>{" "}
            {isBurmese
              ? "ဂြိုဟ်တုနှင့် မြေပုံများသည် ဧရိယာကျယ်အတွက် ဖြစ်သဖြင့် သင့်စိုက်ခင်းမြေစစ်ဆေးချက်နှင့် တောင်သူ့အတွေ့အကြုံက အမြဲတမ်း ပိုမိုမှန်ကန်ပါသည်။"
              : "Regional satellite pixels (~50 km weather, 250 m soil) provide context. A field soil test or your direct observation always supersedes a map estimate."}
          </li>
          <li>
            <strong>{isBurmese ? "လုံခြုံမှုနှင့် လျှို့ဝှက်ချက်:" : "Privacy and on-device storage:"}</strong>{" "}
            {isBurmese
              ? "သင့်စိုက်ခင်းအမည်၊ နယ်နိမိတ်နှင့် မှတ်တမ်းများကို ဗဟိုဆာဗာများသို့ မပို့ဘဲ သင့်ဖုန်းထဲတွင်သာ လုံခြုံစွာ သိမ်းဆည်းထားသည်။"
              : "Your field names, boundary polygons, crop calendars, and financial limits remain stored in this browser on your device."}
          </li>
        </ul>
      </div>
    </div>
  );
}
