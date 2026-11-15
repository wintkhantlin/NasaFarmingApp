/**
 * Reproducible Data Downloader for Field Shift Research
 * Retrieves bounded NASA POWER daily observations for target agricultural fields in Myanmar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, "../../research/data");

fs.mkdirSync(outDir, { recursive: true });

const TARGET_SITES = [
  {
    id: "mawlamyinegyun_delta",
    name: "Mawlamyinegyun (Ayeyarwady Delta Paddy-Pulse)",
    lat: 16.385,
    lon: 95.265,
    start: "20230101",
    end: "20241231"
  },
  {
    id: "hinthada_apex",
    name: "Hinthada (Ayeyarwady Delta Apex / Levee)",
    lat: 17.650,
    lon: 95.450,
    start: "20230101",
    end: "20241231"
  },
  {
    id: "magway_dryzone",
    name: "Magway (Central Dry Zone)",
    lat: 20.150,
    lon: 94.950,
    start: "20230101",
    end: "20241231"
  }
];

const PARAMETERS = [
  "T2M",
  "T2M_MAX",
  "T2M_MIN",
  "RH2M",
  "WS2M",
  "ALLSKY_SFC_SW_DWN",
  "PRECTOTCORR",
  "PS"
].join(",");

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function downloadSite(site) {
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${PARAMETERS}&community=AG&longitude=${site.lon}&latitude=${site.lat}&start=${site.start}&end=${site.end}&format=JSON`;
  console.log(`[Downloading] ${site.name} (${site.lat}°N, ${site.lon}°E)...`);

  const destFile = path.join(outDir, `power_${site.id}_${site.start}_${site.end}.json`);

  try {
    const res = await fetchWithTimeout(url, {}, 20000);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    fs.writeFileSync(destFile, JSON.stringify(data, null, 2));
    const stats = fs.statSync(destFile);
    console.log(`[Success] Saved to ${destFile} (${stats.size} bytes)`);
    return {
      siteId: site.id,
      status: "success",
      filePath: destFile,
      bytes: stats.size,
      url
    };
  } catch (err) {
    console.warn(`[Network/Timeout Notice] Direct fetch failed for ${site.name}: ${err.message}`);
    // Safe offline fallback: Extract bounded subset from predownload cache
    console.log(`[Fallback] Extracting from local verified predownload cache...`);
    const cacheCell = site.lat < 17 ? "power_16.5_95.625.json" : site.lat < 19 ? "power_17.5_95.625.json" : "power_20.0_95.000.json";
    const cachePath = path.resolve(__dirname, "../../data/predownload/weather", cacheCell);
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      // Filter dates
      const indices = [];
      const dates = [];
      for (let i = 0; i < cached.weather.dates.length; i++) {
        const d = cached.weather.dates[i];
        const num = d.replace(/-/g, "");
        if (num >= site.start && num <= site.end) {
          indices.push(i);
          dates.push(d);
        }
      }
      const subset = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [site.lon, site.lat, cached.weather.elevationM] },
        properties: {
          parameter: {}
        },
        header: {
          title: "NASA POWER Daily (Research Offline Extract)",
          source: cached.weather.source,
          dates
        }
      };
      for (const param of Object.keys(cached.weather.series)) {
        subset.properties.parameter[param] = {};
        for (let idx = 0; idx < indices.length; idx++) {
          const origIdx = indices[idx];
          const dKey = dates[idx].replace(/-/g, "");
          subset.properties.parameter[param][dKey] = cached.weather.series[param][origIdx];
        }
      }
      fs.writeFileSync(destFile, JSON.stringify(subset, null, 2));
      const stats = fs.statSync(destFile);
      console.log(`[Fallback Extracted] Saved to ${destFile} (${stats.size} bytes)`);
      return {
        siteId: site.id,
        status: "extracted_from_cache",
        filePath: destFile,
        bytes: stats.size,
        source: cacheCell
      };
    } else {
      throw new Error(`Cache file not found: ${cachePath}`);
    }
  }
}

async function run() {
  console.log("=== STARTING NASA POWER DATA DOWNLOAD ===");
  const results = [];
  for (const site of TARGET_SITES) {
    const res = await downloadSite(site);
    results.push(res);
  }

  // Create manifest entry
  const manifestPath = path.join(outDir, "manifest.json");
  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: "scripts/research/download_data.mjs",
    datasets: results
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[Manifest] Updated ${manifestPath}`);
  console.log("=== DOWNLOAD PIPELINE COMPLETE ===");
}

run().catch(console.error);
