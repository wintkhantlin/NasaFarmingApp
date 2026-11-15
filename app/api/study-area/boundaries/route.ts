import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { parseTownships } from "@/lib/geospatial-farmer/geospatial/townships";

const DEFAULT_DEV_PATH = "/private/tmp/field-shift-townships-local.geojson";

let cachedBody: string | null = null;
let cachedGzip: Uint8Array | null = null;
let cachedPath: string | null = null;

export async function GET(request: Request) {
  // No geometry is bundled or fetched externally. Deployment requires a rights-reviewed local file.
  const configured = process.env.FIELDSHIFT_TOWNSHIPS_PATH;
  const path = configured || (process.env.NODE_ENV !== "production" && existsSync(DEFAULT_DEV_PATH) ? DEFAULT_DEV_PATH : null);
  if (!path) return Response.json({ error: "Study-area boundaries are not configured. You can still mark your field." }, { status: 503 });
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
