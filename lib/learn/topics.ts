import { copy } from "@/lib/copy/en";
import type { Locale } from "@/lib/store/locale-store";

/**
 * Learn information architecture (TASK 09).
 * Topics are farmer questions. Dataset names and scientific terms are supporting
 * information. Definitions are not rewritten here: they reference the existing
 * glossary entries in lib/copy/en.ts by exact term, so nothing is removed or re-worded.
 */

export interface Bilingual {
  en: string;
  my: string;
}

export type ThemeId = "weather" | "water" | "soil" | "crops" | "satellite";

export interface LearnTheme {
  id: ThemeId;
  title: Bilingual;
  intro: Bilingual;
}

export interface LearnTopic {
  id: string;
  theme: ThemeId;
  /** The farmer's question, shown as the topic title. */
  question: Bilingual;
  /** Short introduction, two sentences at most. */
  intro: Bilingual;
  /** Exact `term` values from copy.glossary (both lists). Their definitions are shown expanded. */
  terms: string[];
  /** Dataset names, shown under supporting information only. */
  sources: string[];
  /** Comparison dimension ids (see lib/plan/results-model.ts) this topic explains. */
  indicators: string[];
}

export const THEMES: LearnTheme[] = [
  {
    id: "weather",
    title: { en: "Weather and climate", my: "ရာသီဥတုနှင့် ရာသီဥတုပုံစံ" },
    intro: { en: "What the air does to crops, and where the weather figures come from.", my: "လေထုက သီးနှံကို ဘယ်လိုသက်ရောက်သလဲ၊ ရာသီဥတုကိန်းဂဏန်းများ ဘယ်မှ လာသလဲ။" },
  },
  {
    id: "water",
    title: { en: "Water and irrigation", my: "ရေနှင့် ရေသွင်းခြင်း" },
    intro: { en: "How much water a crop uses, how much rain supplies, and when to check the field.", my: "သီးနှံ အသုံးပြုသောရေ၊ မိုးရေပေးသောပမာဏနှင့် စိုက်ခင်းကို စစ်ဆေးရမည့်အချိန်။" },
  },
  {
    id: "soil",
    title: { en: "Soil and nutrients", my: "မြေဆီလွှာနှင့် အာဟာရ" },
    intro: { en: "Soil cover, legumes, slope and drainage, and what each one tells you.", my: "မြေဖုံးအုပ်မှု၊ ပဲမျိုးသီးနှံ၊ ကုန်းစောက်မှုနှင့် ရေစီးဆင်းမှု၊ ၎င်းတို့ပြောပြသည့်အရာ။" },
  },
  {
    id: "crops",
    title: { en: "Crops and rotation", my: "သီးနှံနှင့် သီးလှည့်စိုက်ပျိုးမှု" },
    intro: { en: "Why the order of crops matters, and how to read the comparison.", my: "သီးနှံအစဉ်အလာ ဘာကြောင့်အရေးကြီးသလဲ၊ နှိုင်းယှဉ်ချက်ကို ဘယ်လိုဖတ်ရမလဲ။" },
  },
  {
    id: "satellite",
    title: { en: "Satellite observations", my: "ဂြိုဟ်တုစောင့်ကြည့်ချက်များ" },
    intro: {
      en: "Satellites and models give a wider picture. Your own soil test or rain gauge is more exact for your field.",
      my: "ဂြိုဟ်တုနှင့် မော်ဒယ်များက ပိုကျယ်သော ပုံစံကို ပေးသည်။ သင့်စိုက်ခင်းအတွက် သင့်ကိုယ်တိုင် မြေစမ်းသပ်ချက် သို့မဟုတ် မိုးတိုင်းကိရိယာက ပို တိကျသည်။",
    },
  },
];

export const TOPICS: LearnTopic[] = [
  {
    id: "frost-and-heat",
    theme: "weather",
    question: { en: "Will frost or heat hurt my crop?", my: "အအေးဒဏ် သို့မဟုတ် အပူဒဏ် ကျွန်ုပ်၏ သီးနှံကို ထိခိုက်မလား?" },
    intro: {
      en: "Some crops are damaged when the air gets too cold or too hot at a sensitive stage. The weather data covers a large area, so also check the low ground in your field.",
      my: "အချို့သီးနှံများသည် အရေးကြီးသော အဆင့်တွင် လေထု အလွန်အေးခြင်း သို့မဟုတ် အလွန်ပူခြင်းကြောင့် ပျက်စီးတတ်သည်။ ရာသီဥတုဒေတာသည် ဧရိယာကျယ်အတွက်ဖြစ်သဖြင့် သင့်စိုက်ခင်းရှိ နိမ့်သောမြေကိုလည်း စစ်ဆေးပါ။",
    },
    terms: ["A frost threshold and frost in your field"],
    sources: ["NASA POWER"],
    indicators: ["climate"],
  },
  {
    id: "where-weather-comes-from",
    theme: "weather",
    question: { en: "Where does my weather information come from?", my: "ကျွန်ုပ်၏ ရာသီဥတုအချက်အလက် ဘယ်မှ လာသလဲ?" },
    intro: {
      en: "Weather figures come from a model fitted to satellites and weather stations, on a grid cell about 50 km wide. They describe the region around your field, not each field.",
      my: "ရာသီဥတုကိန်းဂဏန်းများသည် ဂြိုဟ်တုနှင့် ရာသီဥတုတိုင်းတာရေးဌာနများနှင့် ကိုက်ညီအောင်ပြုလုပ်ထားသော မော်ဒယ်မှ ဖြစ်ပြီး ၅၀ km ခန့် ကျယ်သော ဇယားကွက်တစ်ခုပေါ် ရှိသည်။ ၎င်းတို့သည် စိုက်ခင်းတစ်ခုချင်းစီထက် ဒေသကို ဖော်ပြသည်။",
    },
    terms: ["NASA POWER"],
    sources: ["NASA POWER"],
    indicators: [],
  },
  {
    id: "rain-and-crop-rotation",
    theme: "weather",
    question: { en: "Why does rainfall affect which crops I should rotate?", my: "မိုးရေချိန်သည် ကျွန်ုပ် လှည့်ပျိုးသင့်သော သီးနှံကို အဘယ်ကြောင့် သက်ရောက်သနည်း?" },
    intro: {
      en: "The rotation comparison replays past seasons. A season counts as stressed when rain fell short or it was too hot at a sensitive stage, so a crop that copes with dry seasons can rank higher.",
      my: "သီးလှည့်နှိုင်းယှဉ်ချက်သည် ပြီးခဲ့သောရာသီများကို ပြန်ဖော်ပြသည်။ မိုးနည်းခြင်း သို့မဟုတ် အရေးကြီးအဆင့်တွင် အလွန်ပူခြင်းရှိပါက ထိုရာသီကို စိတ်ဖိစီးမှုရှိသည်ဟု ရေတွက်သဖြင့် ခြောက်သွေ့ရာသီကို ခံနိုင်သော သီးနှံသည် ပိုမြင့်စွာ နေရာရနိုင်သည်။",
    },
    terms: [],
    sources: ["NASA POWER"],
    indicators: ["climate", "water"],
  },
  {
    id: "why-crops-need-water",
    theme: "water",
    question: { en: "Why does my crop need water?", my: "ကျွန်ုပ်၏ သီးနှံသည် အဘယ်ကြောင့် ရေလိုအပ်သနည်း?" },
    intro: {
      en: "Crops lose water from their leaves and from the soil surface. The app estimates how much a healthy crop would use, which is the water the crop needs.",
      my: "သီးနှံများသည် အရွက်နှင့် မြေမျက်နှာပြင်မှ ရေဆုံးရှုံးသည်။ ထိုဆုံးရှုံးမှုကို evapotranspiration ဟု ခေါ်သည်။ အက်ပ်သည် ကျန်းမာသော သီးနှံ အသုံးပြုမည့် ရေပမာဏကို ခန့်မှန်းသည်။",
    },
    terms: ["ETo, ETc and actual evapotranspiration"],
    sources: ["NASA POWER"],
    indicators: ["water"],
  },
  {
    id: "is-rain-enough",
    theme: "water",
    question: { en: "Is the rain enough for my crop, or is water missing?", my: "မိုးရေသည် ကျွန်ုပ်၏ သီးနှံအတွက် လုံလောက်ပါသလား၊ ရေလိုနေပါသလား?" },
    intro: {
      en: "Compare what the crop would use with the rain that fell. The gap is a hint to check the field, not an amount to apply, because stored soil water, runoff and drainage are not counted.",
      my: "သီးနှံ အသုံးပြုမည့်ပမာဏနှင့် ရွာသွန်းသော မိုးရေကို နှိုင်းယှဉ်ပါ။ ကွာဟချက်သည် ရေဖြည့်ရမည့်ပမာဏမဟုတ်ဘဲ စိုက်ခင်းကို ပြန်စစ်ရန် အရိပ်အမြွက်သာ ဖြစ်သည်။ မြေအတွင်းသိမ်းထားသောရေ၊ စီးထွက်ရေနှင့် ရေစိမ့်ဆင်းမှုကို ထည့်မတွက်ထားပါ။",
    },
    terms: ["Rain shortfall and irrigation need"],
    sources: ["NASA POWER"],
    indicators: ["water"],
  },
  {
    id: "what-soil-moisture-means",
    theme: "water",
    question: { en: "What does soil moisture mean, and is it enough?", my: "မြေစိုထိုင်းဆ ဆိုသည်မှာ အဘယ်နည်း၊ လုံလောက်ပါသလား?" },
    intro: {
      en: "Soil moisture is the water held in the soil. A reading can be wetter than usual and still be too dry for a crop, so compare it with the normal for the time of year.",
      my: "မြေစိုထိုင်းဆသည် မြေထဲတွင် ကိုင်ဆောင်ထားသော ရေဖြစ်သည်။ ပုံမှန်ထက်စိုနေသော်လည်း သီးနှံအတွက် ခြောက်သွေ့နေနိုင်သည်။ ဂဏန်းတစ်ခုတည်းမဟုတ်ဘဲ ထိုအချိန်အတွက် ပုံမှန်တန်ဖိုးနှင့် နှိုင်းယှဉ်ပါ။",
    },
    terms: ["Soil moisture and a moisture anomaly"],
    sources: ["SMAP"],
    indicators: ["water"],
  },
  {
    id: "why-soil-washes-away",
    theme: "soil",
    question: { en: "Why does my soil wash away on slopes?", my: "ကျွန်ုပ်၏ မြေဆီလွှာ ကုန်းစောက်ရာတွင် အဘယ်ကြောင့် ဆုတ်ယုတ်သွားသနည်း?" },
    intro: {
      en: "Bare ground on a steep slope can lose soil when it rains. Slope alone does not say how much is lost, so the app flags the risk instead of measuring soil loss.",
      my: "ကုန်းစောက်သော မြေပေါ်ရှိ အဖုံးမပါသောမြေသည် မိုးရွာသောအခါ မြေဆီလွှာ ဆုံးရှုံးနိုင်သည်။ ကုန်းစောက်မှုတစ်ခုတည်းက ဆုံးရှုံးမှုပမာဏကို မပြနိုင်သဖြင့် အက်ပ်သည် အန္တရာယ်ကို အမှတ်အသားပြုသည်။",
    },
    terms: ["Slope and erosion"],
    sources: ["SRTM"],
    indicators: ["erosion"],
  },
  {
    id: "how-much-ground-is-covered",
    theme: "soil",
    question: { en: "How much of the year is my soil covered by a crop?", my: "တစ်နှစ်တွင် ကျွန်ုပ်၏ မြေကို သီးနှံဖုံးအုပ်ထားသော အချိန် ဘယ်လောက်လဲ?" },
    intro: {
      en: "Soil cover is the share of the cycle with a crop in the field. More covered days generally means less bare soil during rain. The figure comes from your plan, not from satellite greenness.",
      my: "မြေဖုံးအုပ်မှုဆိုသည်မှာ စိုက်ပျိုးစက်ဝန်းတွင် လယ်ထဲ သီးနှံရှိသော အချိန်အစိတ်အပိုင်းဖြစ်သည်။ ဖုံးအုပ်ထားသောရက် များလေ မိုးရွာချိန်တွင် မြေဗလာ နည်းလေဖြစ်သည်။ ဤတန်ဖိုးသည် သင့်အစီအစဉ်မှ ဖြစ်ပြီး ဂြိုဟ်တုစိမ်းလန်းမှုမှ မဟုတ်ပါ။",
    },
    terms: [],
    sources: [],
    indicators: ["soil", "cover"],
  },
  {
    id: "why-legumes-in-rotation",
    theme: "soil",
    question: { en: "Why do legumes matter in my rotation?", my: "ကျွန်ုပ်၏ သီးလှည့်တွင် ပဲမျိုးသီးနှံများ အဘယ်ကြောင့် အရေးကြီးသနည်း?" },
    intro: {
      en: "Some crops, legumes, can fix nitrogen themselves. The comparison sets what legumes fix against what the harvested grain removes. It is a partial budget, not a measured change in soil fertility.",
      my: "အချို့သီးနှံ ဖြစ်သော ပဲမျိုးများသည် နိုက်ထရိုဂျင်ကို ကိုယ်တိုင်ဖန်တီးနိုင်သည်။ နှိုင်းယှဉ်ချက်တွင် ပဲမျိုးက ဖန်တီးသောပမာဏနှင့် ရိတ်သိမ်းသောအစေ့က ယူသွားသောပမာဏကို နှိုင်းယှဉ်သည်။ ၎င်းသည် တိုင်းတာထားသော မြေဩဇာပြောင်းလဲမှု မဟုတ်ဘဲ တစ်စိတ်တစ်ပိုင်း တွက်ချက်မှုသာ ဖြစ်သည်။",
    },
    terms: [],
    sources: [],
    indicators: ["legume", "nitrogen", "nitrogen-budget"],
  },
  {
    id: "soil-drainage-and-residue",
    theme: "soil",
    question: { en: "Does my soil drain well enough for each crop?", my: "ကျွန်ုပ်၏ မြေသည် သီးနှံတစ်မျိုးစီအတွက် ရေစိမ့်ဆင်းမှု လုံလောက်ပါသလား?" },
    intro: {
      en: "Soil drainage is best determined through a direct field test or local observation of how water drains on your parcel. Crop residue benefits depend on your post-harvest residue management practices.",
      my: "ရေစိမ့်ဆင်းမှုကို သင့်စိုက်ခင်းမှ စောင့်ကြည့်ချက် သို့မဟုတ် မြေစမ်းသပ်ချက် လိုအပ်သည်။ အက်ပ်သည် ရေသည် သင့်မြေအတွင်း ဘယ်လိုစီးဆင်းသလဲ မမြင်နိုင်ပါ။ သီးနှံအကြွင်းအကျန် (residue) သည် ရိတ်သိမ်းပြီးနောက် ပင်စည်/အပင်ပစ္စည်းကို ဘာလုပ်သလဲပေါ် မူတည်သော်လည်း ထိုအချက်ကို မှတ်တမ်းမတင်ထားပါ။",
    },
    terms: [],
    sources: [],
    indicators: ["drainage", "residue"],
  },
  {
    id: "why-same-crop-family-risks",
    theme: "crops",
    question: { en: "Why can planting similar crops back to back cause disease?", my: "တူညီသော သီးနှံမျိုးစုများ ဆက်တိုက်စိုက်ပါက ရောဂါ အဘယ်ကြောင့် ဖြစ်နိုင်သနည်း?" },
    intro: {
      en: "Crops in the same botanical family can share soil-borne pests and pathogens. Rotating between different plant families disrupts pest life cycles. Field Shift evaluates biological host sequences alongside weather conditions favorable to disease development.",
      my: "တစ်မျိုးသားတူ သီးနှံများသည် မြေမှ ရောဂါ/ပိုးမွှားများကို မျှဝေနိုင်သည်။ ဆက်တိုက်စိုက်ပါက ပြဿနာကို နောက်ရာသီသို့ ယူသွားနိုင်သည်။ အက်ပ်သည် သီးနှံမျိုးစုစည်းမျဉ်းများကို အသုံးပြုပြီး ရာသီဥတုဖြင့် ရောဂါကို ခွဲခြားမသတ်မှတ်နိုင်ပါ။",
    },
    terms: [],
    sources: [],
    indicators: ["pest", "carryover"],
  },
  {
    id: "which-crops-fit-my-place",
    theme: "crops",
    question: { en: "Which crops fit my place and sowing dates?", my: "ကျွန်ုပ်၏ နေရာနှင့် စိုက်ချိန်များနှင့် ကိုက်ညီသော သီးနှံများ ဘာတွေလဲ?" },
    intro: {
      en: "Each crop is checked against your place, sowing dates and soil from the crop library. If a soil fact is unknown it stays unknown and never counts as a pass.",
      my: "သီးနှံတစ်ခုစီကို သင့်နေရာ၊ စိုက်ချိန်နှင့် မြေအခြေအနေတို့ဖြင့် သီးနှံစာကြည့်တိုက်မှ စစ်ဆေးသည်။ မသိသော မြေအချက်သည် မသိဆဲ ဖြစ်နေပြီး အောင်မြင်ခြင်းအဖြစ် ရေတွက်မည်မဟုတ်ပါ။",
    },
    terms: [],
    sources: [],
    indicators: ["suitability"],
  },
  {
    id: "reading-income-numbers",
    theme: "crops",
    question: { en: "How should I read the income numbers?", my: "ဝင်ငွေဂဏန်းများကို အဘယ်လို ဖတ်ရမလဲ?" },
    intro: {
      en: "Economic returns are estimated ranges based on user-entered costs and regional market price benchmarks. Use these figures to compare relative economic resilience across rotation options.",
      my: "ဝင်ငွေသည် သင်ထည့်ထားသော ကုန်ကျစရိတ်များ နှုတ်ပြီးနောက် ခန့်မှန်းထားသော အပိုင်းအခြားဖြစ်သည်။ စျေးနှုန်း၊ အထွက်နှုန်းနှင့် ကုန်ကျစရိတ်တို့ ပြောင်းလဲနိုင်သဖြင့် အာမခံထားသော ဝင်ငွေ မဟုတ်ပါ။ ရွေးချယ်စရာများကို နှိုင်းယှဉ်ရန်သာ အသုံးပြုပါ။",
    },
    terms: [],
    sources: [],
    indicators: ["economics"],
  },
  {
    id: "how-satellite-imagery-helps",
    theme: "satellite",
    question: { en: "How does satellite imagery help us?", my: "ဂြိုဟ်တုပုံရိပ်များက ကျွန်ုပ်တို့ကို အဘယ်လို ကူညီသနည်း?" },
    intro: {
      en: "Satellite images show how green the surface was on clear days, which can show crop growth over time. Clouds leave gaps, and a gap is not zero. Greenness alone does not prove a field is bare.",
      my: "ဂြိုဟ်တုပုံများသည် ကြည်လင်သောနေ့များတွင် မြေမျက်နှာပြင် မည်မျှစိမ်းလန်းသည်ကို ပြသသည်။ အချိန်ကြာလာသည်နှင့်အမျှ သီးနှံကြီးထွားမှုကို ပြနိုင်သည်။ တိမ်ကြောင့် ကွက်လပ်ကျန်နိုင်ပြီး ကွက်လပ်သည် သုညမဟုတ်ပါ။",
    },
    terms: ["NDVI and bare soil", "HLS and MODIS"],
    sources: ["HLS", "MODIS"],
    indicators: [],
  },
  {
    id: "satellite-rain-versus-my-gauge",
    theme: "satellite",
    question: { en: "Is satellite rainfall the same as my rain gauge?", my: "ဂြိုဟ်တုမိုးရေချိန်သည် ကျွန်ုပ်၏ မိုးတိုင်းကိရိယာနှင့် အတူတူလား?" },
    intro: {
      en: "Satellite rainfall is estimated from many satellites on a grid about 11 km wide. It does not see every shower on your field. A rain gauge on your field is more exact, and the app shows your measurements first.",
      my: "ဂြိုဟ်တုမိုးရေချိန်ကို ဂြိုဟ်တုများစွာမှ ခန့်မှန်းထားသော ၁၁ km ခန့် ဇယားကွက်ဖြစ်သည်။ သင့်စိုက်ခင်းရှိ မိုးရွာသမျှကို မမြင်နိုင်ပါ။ သင့်စိုက်ခင်းရှိ မိုးတိုင်းကိရိယာသည် ပို၍ တိကျပြီး အက်ပ်သည် သင့်တိုင်းတာချက်ကို ဦးစွာပြသသည်။",
    },
    terms: ["GPM IMERG", "Your measurements"],
    sources: ["GPM IMERG"],
    indicators: [],
  },
  {
    id: "satellite-soil-moisture",
    theme: "satellite",
    question: { en: "Does satellite soil moisture describe my field?", my: "ဂြိုဟ်တုမြေစိုထိုင်းဆက ကျွန်ုပ်၏ စိုက်ခင်းကို ဖော်ပြပါသလား?" },
    intro: {
      en: "SMAP soil moisture comes from a model that uses satellite measurements, about 9 km wide. It describes the region, not your field.",
      my: "SMAP မြေစိုထိုင်းဆသည် ဂြိုဟ်တုတိုင်းတာချက်ကို အသုံးပြုသော ၉ km ခန့် ကျယ်သည့် မော်ဒယ်မှ ဖြစ်သည်။ ၎င်းသည် ဒေသကို ဖော်ပြပြီး သင့်စိုက်ခင်းကို မဖော်ပြပါ။",
    },
    terms: ["SMAP"],
    sources: ["SMAP"],
    indicators: [],
  },
  {
    id: "surface-temperature-from-space",
    theme: "satellite",
    question: { en: "Why is the satellite temperature different from the air temperature?", my: "ဂြိုဟ်တုအပူချိန်သည် လေထုအပူချိန်နှင့် အဘယ်ကြောင့် ကွာခြားသနည်း?" },
    intro: {
      en: "ECOSTRESS measures surface temperature on dates when the satellite passed over. Surface temperature is not air temperature, and it is only available on those passes.",
      my: "ECOSTRESS သည် ဂြိုဟ်တုဖြတ်သန်းသွားသည့်ရက်များတွင် မြေမျက်နှာပြင် အပူချိန်ကို တိုင်းတာသည်။ မြေမျက်နှာပြင် အပူချိန်သည် လေထုအပူချိန် မဟုတ်ပါ၊ ထိုဖြတ်သန်းချိန်များတွင်သာ ရရှိနိုင်သည်။",
    },
    terms: ["ECOSTRESS"],
    sources: ["ECOSTRESS"],
    indicators: [],
  },
  {
    id: "terrain-and-slope",
    theme: "satellite",
    question: { en: "Where does the slope of my field come from?", my: "ကျွန်ုပ်၏ စိုက်ခင်း ကုန်းစောက်မှု ဘယ်မှ ရလာသနည်း?" },
    intro: {
      en: "Ground height from SRTM, measured in February 2000, is used to work out slope. It does not show changes since then, or drains in the field.",
      my: "၂၀၀၀ ခုနှစ် ဖေဖော်ဝါရီလတွင် တိုင်းတာထားသော SRTM မြေမျက်နှာပြင်အမြင့်ကို ကုန်းစောက်မှု တွက်ချက်ရန် အသုံးပြုသည်။ ထိုနောက်ပိုင်း ပြောင်းလဲမှုများ သို့မဟုတ် စိုက်ခင်းရှိ ရေမြောင်းများကို မပြပါ။",
    },
    terms: ["SRTM"],
    sources: ["SRTM"],
    indicators: ["erosion"],
  },
];

/** Labels for comparison dimension ids, as the comparison screen shows them (English). */
export const INDICATOR_LABELS: Record<string, string> = {
  suitability: "Crop suitability",
  water: "Water requirements",
  climate: "Climate exposure",
  soil: "Soil health",
  nitrogen: "Nitrogen",
  pest: "Pest and disease risk",
  erosion: "Erosion exposure",
  economics: "Economic performance",
  cover: "Soil cover",
  legume: "Legume contribution",
  "nitrogen-budget": "Partial nitrogen budget",
  residue: "Crop residue",
  drainage: "Soil drainage",
  carryover: "Disease carryover",
};

/** All glossary entries, in their original order. Definitions stay in lib/copy/en.ts. */
export function allGlossaryEntries(): ReadonlyArray<{ term: string; body: string }> {
  return [...copy.glossary.items, ...copy.glossary.satelliteVsGround.items];
}

export function getTopic(id: string): LearnTopic | undefined {
  return TOPICS.find((t) => t.id === id);
}

export function getTheme(id: ThemeId): LearnTheme {
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) throw new Error(`Unknown learn theme: ${id}`);
  return theme;
}

export function topicsInTheme(theme: ThemeId): LearnTopic[] {
  return TOPICS.filter((t) => t.theme === theme);
}

/** Topics that explain a comparison dimension, for links from the comparison screen. */
export function topicsForIndicator(dimensionId: string): LearnTopic[] {
  return TOPICS.filter((t) => t.indicators.includes(dimensionId));
}

export function pick(text: Bilingual, locale: Locale): string {
  return locale === "my" ? text.my : text.en;
}

/** Definition text for a glossary term. Burmese definitions are not yet written, so the English text is used. */
export function glossaryBody(term: string): string | undefined {
  return allGlossaryEntries().find((e) => e.term === term)?.body;
}

/** Search across the farmer question, intro, definitions and dataset names (case-insensitive). */
export function searchTopics(query: string): LearnTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return TOPICS;
  return TOPICS.filter((t) => {
    const haystack = [
      t.question.en,
      t.question.my,
      t.intro.en,
      t.intro.my,
      ...t.terms,
      ...t.terms.map((term) => glossaryBody(term) ?? ""),
      ...t.sources,
      ...t.indicators.map((i) => INDICATOR_LABELS[i] ?? i),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
