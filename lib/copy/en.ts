/**
 * Every string the app shows lives here, so the interface can be translated
 * later. Voice rules are in DESIGN.md and UX.md: plain, calm, verb first,
 * sentence case, units attached.
 */
export const copy = {
  app: {
    name: "Rotation planner",
    tagline: "Compare your crop rotation with other options, using NASA data.",
  },

  judgment: {
    short: "Suggestions to discuss, not instructions.",
    long: "You know your land. Check these suggestions with your extension officer or adviser before you change what you plant.",
  },

  steps: {
    location: "Location",
    rotation: "Your rotation",
    conditions: "Conditions",
    compare: "Compare",
  },

  stepState: {
    done: "Done",
    needsInput: "Needs your input",
    loading: "Loading data",
    notStarted: "Not started",
  },

  home: {
    title: "Your fields",
    emptyTitle: "Drop a pin on your first field",
    emptyBody:
      "Choose where your field is, tell us what you grow now, and see how it compares with other rotations.",
    addField: "Add a field",
    loading: "Loading your fields",
    loadError: "We couldn't read your saved fields.",
    retry: "Try again",
    storedLocally: "Your fields are saved in this browser only. Nothing is sent to an account.",
    area: (ha: number) => `${ha < 10 ? ha.toFixed(1) : Math.round(ha)} ha`,
    pinOnly: "Pin only, area not set",
  },

  irrigation: {
    none: "Rain only",
    supplemental: "Some irrigation",
    full: "Fully irrigated",
  },

  data: {
    satellitePending: "Satellite detail on its way, about 3 minutes.",
    cachedFrom: (when: string) => `Data from ${when}`,
    sourceNasaPower: "NASA POWER",
    sourceSoilGrids: "ISRIC SoilGrids, not NASA",
    rainfallNote: "Rainfall is from NASA POWER (MERRA-2, bias-corrected). Satellite rainfall from GPM IMERG is not connected yet.",
  },

  validation: {
    outlineCrosses: "The outline crosses itself. Redraw it so the lines don't cross.",
    nameRequired: "Give the field a name.",
    fieldTooLarge: "This field is very large. Check the outline is right.",
    noLand: "We couldn't find land data here. Move the pin onto farmland.",
  },
} as const;
