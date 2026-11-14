import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Redis } from "@upstash/redis";
import { PROCESSING_VERSION } from "../lib/evidence/indicator";
import { powerCell, pointKey } from "../lib/geo/cells";
import { fetchPowerDaily, type DailyWeather } from "../lib/nasa/power";
import { fetchSoilGrids, type SoilProfile } from "../lib/soil/soilgrids";
import { cacheKey } from "../lib/server/cache";
import { weatherEnd, WEATHER_START } from "../lib/server/weather";

interface RegionHub {
  region: "ayeyarwady" | "magway" | "mandalay" | "shan" | "bago";
  name: string;
  lat: number;
  lng: number;
}

const HUBS: RegionHub[] = [
  // 1. Ayeyarwady Region
  { region: "ayeyarwady", name: "Pathein", lat: 16.78, lng: 94.73 },
  { region: "ayeyarwady", name: "Hinthada", lat: 17.65, lng: 95.45 },
  { region: "ayeyarwady", name: "Myaungmya", lat: 16.60, lng: 94.92 },
  { region: "ayeyarwady", name: "Maubin", lat: 16.73, lng: 95.65 },
  { region: "ayeyarwady", name: "Pyapon", lat: 16.30, lng: 95.68 },

  // 2. Magway Region (Dry Zone)
  { region: "magway", name: "Magway City", lat: 20.15, lng: 94.95 },
  { region: "magway", name: "Pakokku", lat: 21.33, lng: 95.08 },
  { region: "magway", name: "Minbu", lat: 20.18, lng: 94.87 },
  { region: "magway", name: "Taungdwingyi", lat: 20.00, lng: 95.54 },
  { region: "magway", name: "Thayet", lat: 19.32, lng: 95.18 },

  // 3. Mandalay Region (Dry Zone / Central Valley)
  { region: "mandalay", name: "Mandalay City", lat: 21.98, lng: 96.08 },
  { region: "mandalay", name: "Meiktila", lat: 20.88, lng: 95.87 },
  { region: "mandalay", name: "Myingyan", lat: 21.46, lng: 95.39 },
  { region: "mandalay", name: "Kyaukse", lat: 21.60, lng: 96.13 },
  { region: "mandalay", name: "Yamethin", lat: 20.43, lng: 96.15 },

  // 4. Shan State (Highlands)
  { region: "shan", name: "Taunggyi", lat: 20.78, lng: 97.03 },
  { region: "shan", name: "Heho-Kalaw", lat: 20.73, lng: 96.83 },
  { region: "shan", name: "Aungban", lat: 20.67, lng: 96.63 },
  { region: "shan", name: "Lashio", lat: 22.93, lng: 97.75 },
  { region: "shan", name: "Hsipaw", lat: 22.62, lng: 97.30 },

  // 5. Bago Region
  { region: "bago", name: "Bago City", lat: 17.33, lng: 96.48 },
  { region: "bago", name: "Pyay", lat: 18.82, lng: 95.22 },
  { region: "bago", name: "Taungoo", lat: 18.94, lng: 96.43 },
  { region: "bago", name: "Nattalin", lat: 18.43, lng: 95.50 },
  { region: "bago", name: "Daik-U", lat: 17.80, lng: 96.67 },
];

async function main() {
  console.log("=== STARTING PRE-DOWNLOAD: 5 REGIONS, 10-YEAR MAX (2016-2026) ===");
  console.log(`Regions: Ayeyarwady, Magway, Mandalay, Shan, Bago (${HUBS.length} agricultural hubs)`);

  const outDir = join(process.cwd(), "data", "predownload");
  const weatherDir = join(outDir, "weather");
  const soilDir = join(outDir, "soil");

  await mkdir(weatherDir, { recursive: true });
  await mkdir(soilDir, { recursive: true });

  // Initialize Upstash Redis if configured
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  let redis: Redis | null = null;
  if (redisUrl && redisToken) {
    redis = new Redis({ url: redisUrl, token: redisToken });
    console.log("✓ Connected to Upstash Redis for server cache seeding");
  } else {
    console.log("ℹ Upstash Redis not configured in env, saving to local disk only");
  }

  const end = weatherEnd();
  console.log(`Weather Window: ${WEATHER_START} to ${end} (10 Years)`);

  // Map unique NASA POWER cells to avoid duplicate downloads
  const uniqueCells = new Map<string, { lat: number; lon: number; hubs: RegionHub[] }>();
  for (const hub of HUBS) {
    const cell = powerCell(hub.lat, hub.lng);
    if (!uniqueCells.has(cell.key)) {
      uniqueCells.set(cell.key, { lat: cell.lat, lon: cell.lon, hubs: [hub] });
    } else {
      uniqueCells.get(cell.key)!.hubs.push(hub);
    }
  }

  console.log(`\nIdentified ${uniqueCells.size} unique NASA POWER cells across the 5 regions.`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    window: { start: WEATHER_START, end },
    regions: ["ayeyarwady", "magway", "mandalay", "shan", "bago"],
    weatherCells: [] as any[],
    soilProfiles: [] as any[],
  };

  // 1. Download NASA POWER Daily Weather
  console.log("\n[1/2] Downloading NASA POWER 10-Year Weather Data...");
  let cellIndex = 0;
  for (const [cellKey, info] of uniqueCells.entries()) {
    cellIndex++;
    console.log(`  (${cellIndex}/${uniqueCells.size}) Cell ${cellKey} for [${info.hubs.map((h) => h.name).join(", ")}]...`);
    try {
      const weather = await fetchPowerDaily({
        lat: info.lat,
        lon: info.lon,
        start: WEATHER_START,
        end,
        timeStandard: "UTC",
      });

      const safeKey = cellKey.replace(/:/g, "_");
      const filePath = join(weatherDir, `${safeKey}.json`);
      const payload = { cellKey, lat: info.lat, lon: info.lon, hubs: info.hubs, weather };
      await writeFile(filePath, JSON.stringify(payload));

      const retrievedAt = new Date().toISOString();
      // Seed Redis for all hubs in this cell
      if (redis) {
        for (const hub of info.hubs) {
          const rKey = cacheKey("power-daily", PROCESSING_VERSION, pointKey("pt", hub.lat, hub.lng, 3), WEATHER_START, end);
          await redis.set(rKey, { weather, retrievedAt }, { ex: 60 * 60 * 24 * 30 }); // 30 days
        }
      }

      manifest.weatherCells.push({
        cellKey,
        coordinates: [info.lat, info.lon],
        hubs: info.hubs.map((h) => h.name),
        recordsCount: weather.dates.length,
        file: filePath,
      });

      // Small throttle to stay well below NASA POWER rate limits (30 req/min)
      await new Promise((r) => setTimeout(r, 800));
    } catch (err: any) {
      console.error(`    ✗ Error downloading cell ${cellKey}:`, err.message);
    }
  }

  // 2. Download ISRIC SoilGrids Profiles
  console.log("\n[2/2] Downloading ISRIC SoilGrids Baseline Profiles...");
  for (let i = 0; i < HUBS.length; i++) {
    const hub = HUBS[i];
    console.log(`  (${i + 1}/${HUBS.length}) SoilGrids for ${hub.name} (${hub.region}) [${hub.lat}, ${hub.lng}]...`);
    try {
      const profile = await fetchSoilGrids(hub.lat, hub.lng);
      const safeKey = `soil_${hub.region}_${hub.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const filePath = join(soilDir, `${safeKey}.json`);
      await writeFile(filePath, JSON.stringify({ hub, profile }));

      const retrievedAt = new Date().toISOString();
      if (redis) {
        const sKey = cacheKey("soilgrids", PROCESSING_VERSION, pointKey("soil", hub.lat, hub.lng, 3));
        await redis.set(sKey, { soil: profile, retrievedAt }, { ex: 60 * 60 * 24 * 30 });
      }

      manifest.soilProfiles.push({
        hub: hub.name,
        region: hub.region,
        coordinates: [hub.lat, hub.lng],
        ph: profile?.ph ?? null,
        texture: profile?.texture ?? null,
        file: filePath,
      });

      // Small throttle for SoilGrids
      await new Promise((r) => setTimeout(r, 500));
    } catch (err: any) {
      console.error(`    ✗ Error downloading SoilGrids for ${hub.name}:`, err.message);
    }
  }

  // Save manifest
  await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("\n=== PRE-DOWNLOAD COMPLETE! ===");
  console.log(`Manifest written to: ${join(outDir, "manifest.json")}`);
  console.log(`Total Weather Cells Downloaded: ${manifest.weatherCells.length}`);
  console.log(`Total Soil Profiles Downloaded: ${manifest.soilProfiles.length}`);
}

main().catch((e) => {
  console.error("Fatal predownload error:", e);
  process.exit(1);
});
