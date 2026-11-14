# P7 translation review

P7 adds bilingual, farmer-facing labels in Welcome, Settings and Crop Guide. The UI remains usable in written English without audio.

Before release, a Myanmar agricultural-language reviewer should check:

- The new bilingual privacy headings in `components/home/welcome.tsx`.
- The Settings headings and the two language choices in `components/settings/settings-view.tsx`.
- Crop names from `lib/data/crops/myanmar.ts` shown in `app/(app)/about/crops/page.tsx`; keep them consistent with Plan and Compare.
- Whether “field-informed”, “regional example”, “backup”, “restore”, and “check locally” have understandable farmer wording in Burmese.

No Burmese audio was added. Any future narration must repeat the written claim and remain opt-in; it must not add agronomic advice.

The report and data screens intentionally retain precise source names in English (NASA POWER, ISRIC SoilGrids, GPM IMERG, Microsoft Planetary Computer) so provenance remains traceable. A reviewer should decide whether short Burmese explanatory labels are needed alongside those names.
