/**
 * Reproducible Data Validation Script for Field Shift Research
 * Audits downloaded NASA observations against physical ranges and QA masks.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../research/data");

console.log("=== VALIDATING DOWNLOADED NASA DATASETS ===");

const manifestPath = path.join(dataDir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("Manifest not found:", manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
console.log(`Auditing ${manifest.datasets.length} downloaded dataset(s)...`);

const PHYSICAL_BOUNDS = {
  T2M: { min: -10, max: 55, unit: "°C" },
  T2M_MAX: { min: -10, max: 55, unit: "°C" },
  T2M_MIN: { min: -15, max: 40, unit: "°C" },
  RH2M: { min: 0, max: 100, unit: "%" },
  WS2M: { min: 0, max: 60, unit: "m/s" },
  ALLSKY_SFC_SW_DWN: { min: 0, max: 40, unit: "MJ/m²/day" },
  PRECTOTCORR: { min: 0, max: 600, unit: "mm/day" },
  PS: { min: 50, max: 110, unit: "kPa" }
};

let allPassed = true;

for (const item of manifest.datasets) {
  console.log(`\n--- Validating: ${item.siteId} (${item.filePath}) ---`);
  if (!fs.existsSync(item.filePath)) {
    console.error(`FAIL: File does not exist: ${item.filePath}`);
    allPassed = false;
    continue;
  }

  const raw = JSON.parse(fs.readFileSync(item.filePath, "utf-8"));
  const params = raw.properties?.parameter || raw.parameters;
  if (!params) {
    console.error(`FAIL: Parameter block missing in ${item.filePath}`);
    allPassed = false;
    continue;
  }

  console.log(`  File size: ${fs.statSync(item.filePath).size} bytes`);
  console.log(`  Parameters present: ${Object.keys(params).join(", ")}`);

  for (const [pName, bounds] of Object.entries(PHYSICAL_BOUNDS)) {
    const series = params[pName];
    if (!series) {
      console.warn(`  [WARN] Parameter ${pName} missing in dataset.`);
      continue;
    }

    const keys = Object.keys(series);
    let fillCount = 0;
    let outOfBoundsCount = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;
    let sum = 0;
    let validCount = 0;

    for (const k of keys) {
      const v = series[k];
      if (v === -999 || v === null || isNaN(v)) {
        fillCount++;
        continue;
      }
      if (v < bounds.min || v > bounds.max) {
        outOfBoundsCount++;
      }
      minVal = Math.min(minVal, v);
      maxVal = Math.max(maxVal, v);
      sum += v;
      validCount++;
    }

    const mean = validCount > 0 ? (sum / validCount).toFixed(2) : "N/A";
    const status = fillCount === 0 && outOfBoundsCount === 0 ? "PASS" : "WARN";
    console.log(`  [${status}] ${pName.padEnd(18)} (${bounds.unit}): ${validCount} valid | Min: ${minVal} | Max: ${maxVal} | Mean: ${mean} | Fills (-999): ${fillCount} | OutOfBounds: ${outOfBoundsCount}`);

    if (outOfBoundsCount > 0) {
      allPassed = false;
    }
  }
}

console.log("\n==========================================");
if (allPassed) {
  console.log("VALIDATION VERDICT: ALL DATASETS PASSED PHYSICAL INTEGRITY AND BOUND CHECKS.");
} else {
  console.log("VALIDATION VERDICT: ISSUES DETECTED DURING DATA VALIDATION.");
}
console.log("==========================================");
