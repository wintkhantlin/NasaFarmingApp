# Moderated Farmer Usability Testing Protocol (Pending Field Tests)

> **Status Notice:** PENDING FIELD TESTS  
> This protocol specifies five realistic, moderated field usability evaluation tasks for smallholder farmers and agricultural extension officers in Myanmar (Ayeyarwady Delta and Central Dry Zone). No simulated or fabricated farmer results are claimed; empirical findings are pending on-site execution.

---

## Evaluation Goals & Setup

- **Target Participants:** 10–15 smallholder farmers and village extension workers in Lower Myanmar (Danubyu, Hinthada, Maubin townships) cultivating 2 to 10 acres of lowland rice with post-monsoon pulse rotations.
- **Device Environment:** Entry-to-mid range Android smartphones (~360px viewport width, low-bandwidth 3G/4G or offline cached mode).
- **Languages:** Burmese primary interface with English bilingual subtitles.
- **Facilitation Method:** Moderated think-aloud protocol in Burmese, recorded with participant consent.

---

## Usability Tasks & Success Measures

### Task 1: Assess Post-Harvest Soil Workability & Sowing Timing
- **Scenario:** The farmer has completed harvesting monsoon rice and wants to know when the soil will be ready to sow black gram without seed rot or hard crusting.
- **Farmer Prompt:** *"မိုးစပါးရိတ်သိမ်းပြီးနောက် မတ်ပဲစိုက်ပျိုးရန် မြေအစိုဓာတ် အခြေအနေကို စစ်ဆေးပါ။"*
- **Success Criteria:**
  - Participant locates the **Moisture Clock Ribbon** (`components/field/moisture-clock-ribbon.tsx`).
  - Participant correctly interprets the advisory *"Check topsoil moisture and drainage before sowing (စိုက်ပျိုးခြင်းမပြုမီ မြေပြင်အစိုဓာတ်နှင့် ရေနုတ်မြောင်းများကို လက်တွေ့စစ်ဆေးပါ)"* rather than looking for an automatic countdown when soil data is unconfirmed.
  - Participant understands that a manual hand-feel test in the field is required before buying or broadcasting seed.
- **Target Completion Rate:** $\ge 80\%$ without facilitator intervention.

---

### Task 2: Plan a Pre-Harvest Relay Broadcast (*Ye-pyan*) Sowing
- **Scenario:** The farmer wants to practice traditional *Ye-pyan* (broadcasting black gram seed into standing monsoon rice 7 to 10 days before field drainage/harvest) to utilize residual soil moisture.
- **Farmer Prompt:** *"မိုးစပါး မရိတ်မီ ၇ ရက်အလိုတွင် မတ်ပဲကို သမရိုးကျ အကြိုကြဲပက် (ရည်ပျံ) စိုက်ပျိုးရန် ပြက္ခဒိန်တွင် ထည့်သွင်းပါ။"*
- **Success Criteria:**
  - Participant selects **Black Gram** following **Rice** in the rotation editor.
  - In Advanced View or Guided Flow, participant selects **Relay Broadcast (Ye-pyan)** establishment mode.
  - Participant notices and confirms the **Emerald Relay Badge** (`🌱 Relay Broadcast (Ye-pyan)`) indicating valid biological overlap, rather than an error collision.
  - Participant successfully uses the 1-click **Snap to Relay (-7d)** button if dates were initially misaligned.
- **Target Completion Rate:** $\ge 75\%$.

---

### Task 3: Screen Feasible Rotations Under Rainfed & Manual Labor Constraints
- **Scenario:** The farmer does not have diesel pump irrigation access for the dry season and relies on household manual labor rather than hired 4-wheel tractors.
- **Farmer Prompt:** *"နွေရာသီတွင် ရေသွင်းရန် မဖြစ်နိုင်ဘဲ လက်မှုလုပ်အားသာ သုံးနိုင်သည့်အတွက် မိမိလယ်နှင့် အဆင်ပြေမည့် သီးလှည့်ကို ရွေးချယ်ပါ။"*
- **Success Criteria:**
  - In Guided Flow Step 2 (Constraints), participant selects **Rainfed (မိုးရေသောက် / ရေမသွင်းနိုင်)** and **Manual labor only (လူအားသက်သက်)**.
  - In Step 4 (Compare), participant observes that water-intensive summer crops (e.g. irrigated summer paddy) are flagged with clear constraint reasons (`WATER_UNAVAILABLE:rice`).
  - Participant confirms that low-water pulse or sesame rotations are recommended as **Feasible (စိုက်နိုင်)**.
- **Target Completion Rate:** $\ge 85\%$.

---

### Task 4: Compare Cash Investment & Commercial Cash-at-Risk
- **Scenario:** The farmer has a limited pre-harvest operating budget (under 800,000 MMK/ha) and wants to compare potential profits while avoiding crops with high seed and fertilizer cash risk.
- **Farmer Prompt:** *"စိုက်ထုတ်ငွေ အနည်းဆုံးဖြင့် အကျိုးအမြတ်ရရှိနိုင်မည့် သီးလှည့်ကို နှိုင်းယှဉ်ပြီး စိုက်ပျိုးစရိတ်နှင့် ဆုံးရှုံးနိုင်ခြေကို ကြည့်ပါ။"*
- **Success Criteria:**
  - Participant navigates to Step 4 (Compare 3 Candidate Rotations).
  - Participant identifies the **Committed Cash-at-Risk (ကြိုတင်စိုက်ထုတ်ရမည့်ငွေ)** badge on each card.
  - Participant toggles between Acre and Hectare units and checks the estimated net gross margin envelope.
  - Participant understands that price estimates are regional township averages and may fluctuate.
- **Target Completion Rate:** $\ge 70\%$.

---

### Task 5: View Plan Checklist & Toggle Experience Modes
- **Scenario:** The farmer wants to review their finalized seasonal plan checklist before leaving the village tea shop, and an extension officer asks to view the full technical calendar timeline.
- **Farmer Prompt:** *"ရွေးချယ်ထားသော အစီအစဉ်၏ စစ်ဆေးရမည့်အချက်များကို ကြည့်ရှုပြီး အသေးစိတ် ပြက္ခဒိန်ဇယား (Advanced Timeline) သို့ ပြောင်းလဲကြည့်ပါ။"*
- **Success Criteria:**
  - Participant advances to Step 5 (My Plan & Field Checklist) and reads the 4 practical field action items.
  - Participant clicks **Save This Plan (ဤအစီအစဉ်ကို သိမ်းဆည်းမည်)**.
  - Participant clicks the toggle button **🔬 Advanced Timeline** to inspect the multi-month color-coded calendar ribbon, then easily returns to **🌾 Guided Farmer View**.
- **Target Completion Rate:** $\ge 90\%$.

---

## Usability Metrics & Reporting Template

| Metric | Target Goal | Recorded Finding (Pending Field Trials) |
| :--- | :--- | :--- |
| **Task Completion Rate** | $\ge 80\%$ average across all 5 tasks | *Pending moderated field trials* |
| **Time on Task (Guided Flow)** | $\le 4\text{ minutes}$ for Steps 1–5 | *Pending moderated field trials* |
| **Language Clarity Score** | $\ge 4.0 / 5.0$ on Likert comprehension scale | *Pending moderated field trials* |
| **Misinterpretation Rate of Satellite Data** | $0\%$ claiming satellite data measured plot moisture directly | *Pending moderated field trials* |
| **Single-Handed Mobile Usability** | $\ge 44\text{ px}$ tap targets accessible without pinch-zoom | *Verified in codebase / layout audits* |
