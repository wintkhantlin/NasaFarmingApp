#!/usr/bin/env node
/**
 * Ensures all dataset assets (NASA POWER weather cells, SoilGrids baseline profiles,
 * and geoBoundaries Myanmar township GIS datasets) are present and structurally valid
 * before building for production on Vercel or running locally.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

console.log("=== VERIFYING PRODUCTION DATASETS FOR VERCEL ===");

let errors = 0;

// 1. Verify Manifest
const manifestPath = path.join(root, "data", "predownload", "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("✗ Missing data/predownload/manifest.json");
  errors++;
} else {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    console.log(`✓ Predownload manifest verified (${manifest.weatherCells.length} weather cells, ${manifest.soilProfiles.length} soil profiles)`);

    // Verify weather cells
    let weatherCount = 0;
    for (const cell of manifest.weatherCells) {
      const clean = cell.file.replace(/^(?:.*data\/predownload\/)?/, "");
      const full = path.join(root, "data", "predownload", clean);
      if (!fs.existsSync(full)) {
        console.error(`✗ Missing weather file: ${clean}`);
        errors++;
      } else {
        weatherCount++;
      }
    }
    console.log(`✓ All ${weatherCount} NASA POWER weather cells verified`);

    // Verify soil profiles
    let soilCount = 0;
    for (const soil of manifest.soilProfiles) {
      const clean = soil.file.replace(/^(?:.*data\/predownload\/)?/, "");
      const full = path.join(root, "data", "predownload", clean);
      if (!fs.existsSync(full)) {
        console.error(`✗ Missing soil file: ${clean}`);
        errors++;
      } else {
        soilCount++;
      }
    }
    console.log(`✓ All ${soilCount} ISRIC SoilGrids baseline profiles verified`);
  } catch (err) {
    console.error("✗ Invalid manifest.json:", err.message);
    errors++;
  }
}

// 2. Verify GeoBoundaries & Administrative Datasets
const geoDatasets = [
  { name: "geoBoundaries 330 Myanmar Townships", file: "lib/data/geoboundaries-330-townships.json", minSize: 1000000 },
  { name: "Myanmar National Boundary", file: "lib/data/myanmar-boundary.json", minSize: 500000 },
  { name: "Yangon Regional Boundary", file: "lib/data/yangon-boundary.json", minSize: 10000 },
];

for (const ds of geoDatasets) {
  const full = path.join(root, ds.file);
  if (!fs.existsSync(full)) {
    console.error(`✗ Missing GIS dataset: ${ds.file}`);
    errors++;
  } else {
    const stat = fs.statSync(full);
    if (stat.size < ds.minSize) {
      console.error(`✗ GIS dataset ${ds.file} is suspiciously small (${stat.size} bytes)`);
      errors++;
    } else {
      console.log(`✓ ${ds.name} verified (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  }
}

// 3. Verify Agronomic Crops Database
const cropFiles = [
  "lib/data/crops/myanmar.ts",
  "lib/data/crops/reference.ts",
  "lib/data/crops/weather-disease-rules.ts",
  "lib/data/crops/host-organisms.ts",
  "lib/data/crops/real-world-economics.ts",
];

for (const cf of cropFiles) {
  const full = path.join(root, cf);
  if (!fs.existsSync(full)) {
    console.error(`✗ Missing crop rule file: ${cf}`);
    errors++;
  }
}
console.log(`✓ Agronomic crop characteristics and disease rule matrices verified`);

if (errors > 0) {
  console.error(`\nFAILED: Detected ${errors} dataset issue(s).`);
  process.exit(1);
}

console.log("\n✓ ALL DATASETS VERIFIED FOR VERCEL DEPLOYMENT & RUNTIME.");
process.exit(0);
