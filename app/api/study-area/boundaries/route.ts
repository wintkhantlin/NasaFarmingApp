import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseTownships } from "@/lib/geospatial-farmer/geospatial/townships";

const PRODUCTION_DATA_PATH = join(process.cwd(), "lib/data/geoboundaries-330-townships.json");
const LOCAL_MIMU_DEV_PATH = "/private/tmp/field-shift-townships-local.geojson";

let cachedBody: string | null = null;
let cachedGzip: Uint8Array | null = null;
let cachedPath: string | null = null;

export async function GET(request: Request) {
  // Priority:
  // 1. Explicit FIELDSHIFT_TOWNSHIPS_PATH override (for authorized offline/local MIMU research)
  // 2. Openly licensed production geoBoundaries gbOpen 330 townships dataset (CC BY 4.0)
  // 3. Local development fallback path if present
  const configured = process.env.FIELDSHIFT_TOWNSHIPS_PATH;
  const path = (configured && existsSync(configured))
    ? configured
    : existsSync(PRODUCTION_DATA_PATH)
      ? PRODUCTION_DATA_PATH
      : (process.env.NODE_ENV !== "production" && existsSync(LOCAL_MIMU_DEV_PATH))
        ? LOCAL_MIMU_DEV_PATH
        : null;

  if (!path) {
    return Response.json(
      { error: "Study-area boundaries are not configured. You can still mark your field." },
      { status: 503 }
    );
  }
  try {
    if (!cachedBody || cachedPath !== path) {
      const data = parseTownships(JSON.parse(await readFile(path, "utf8")));
      const minified = JSON.stringify(data);
      cachedBody = minified;
      cachedGzip = new Uint8Array(gzipSync(minified));
      cachedPath = path;
    }
    const headers = {
      "Content-Type": "application/geo+json",
      "Cache-Control": "public, max-age=3600",
      Vary: "Accept-Encoding",
    };
    if (request.headers.get("accept-encoding")?.includes("gzip") && cachedGzip) {
      return new Response(cachedGzip as unknown as BodyInit, { headers: { ...headers, "Content-Encoding": "gzip" } });
    }
    return new Response(cachedBody, { headers });
  } catch {
    return Response.json({ error: "Study-area boundaries are unavailable. You can still mark your field." }, { status: 503 });
  }
}
