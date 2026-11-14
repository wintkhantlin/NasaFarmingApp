const raw = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "").trim();

/**
 * The browser only ever gets a public token (pk.). A secret token (sk.) in
 * this variable would be shipped to every visitor, so it is treated as unset.
 */
export const MAPBOX_TOKEN = raw.startsWith("pk.") ? raw : "";

export const MAPBOX_TOKEN_PROBLEM: "missing" | "secret" | null = MAPBOX_TOKEN
  ? null
  : raw.startsWith("sk.")
    ? "secret"
    : "missing";

export const MAPBOX_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";
