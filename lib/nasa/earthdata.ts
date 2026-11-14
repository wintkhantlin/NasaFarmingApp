/**
 * NASA Earthdata Login settings. Server only: never import this from a client component.
 *
 *  - AppEEARS (SMAP, HLS, SRTM, MODIS, ECOSTRESS) logs in with EARTHDATA_USERNAME and EARTHDATA_PASSWORD.
 *  - IMERG downloads from GES DISC accept an Earthdata user token in EARTHDATA_TOKEN.
 *
 * Without them the sources report `source-unconfigured` and the app falls back or shows unknown.
 */

/** Environment variables as a plain map, so tests can pass a few keys without NODE_ENV. */
export type Env = Record<string, string | undefined>;

export type EarthdataService = "appeears" | "imerg";

export function earthdataConfigured(service: EarthdataService, env: Env = process.env): boolean {
  if (service === "appeears") return Boolean(env.EARTHDATA_USERNAME && env.EARTHDATA_PASSWORD);
  return Boolean(env.EARTHDATA_TOKEN);
}

export function appeearsCredentials(env: Env = process.env): { username: string; password: string } | null {
  const username = env.EARTHDATA_USERNAME;
  const password = env.EARTHDATA_PASSWORD;
  return username && password ? { username, password } : null;
}

export function imergToken(env: Env = process.env): string | null {
  return env.EARTHDATA_TOKEN || null;
}

export class SourceUnconfiguredError extends Error {
  constructor(service: EarthdataService) {
    super(
      service === "appeears"
        ? "AppEEARS needs EARTHDATA_USERNAME and EARTHDATA_PASSWORD on the server."
        : "IMERG downloads need EARTHDATA_TOKEN on the server.",
    );
    this.name = "SourceUnconfiguredError";
  }
}
