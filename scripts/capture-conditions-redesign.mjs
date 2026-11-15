/**
 * Before/after screenshots for the Field Conditions + risk explorer redesign.
 * Usage: node scripts/capture-conditions-redesign.mjs [port]
 *
 * The data APIs are intercepted with FIXTURES (deterministic 1981–2025 series). They exist only so the
 * screens have something to draw offline; nothing here is real NASA data and none of it reaches the app code.
 * The Mapbox basemap itself is live when NEXT_PUBLIC_MAPBOX_TOKEN is set.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const PORT = process.argv[2] ?? "3001";
const BASE = `http://localhost:${PORT}`;
const OUT = "docs/screenshots/conditions-redesign";
const stamp = new Date().toISOString();

const field4 = {
  id: "field-4",
  name: "Field 4",
  geometry: { type: "Polygon", coordinates: [[[95.11, 16.83], [95.13, 16.83], [95.13, 16.85], [95.11, 16.85], [95.11, 16.83]]] },
  centroid: [95.12, 16.84],
  samplePoints: [[95.12, 16.84]],
  areaHa: 9.2,
  region: "ayeyarwady",
  locationConfirmed: true,
  irrigation: "none",
  priorities: { order: ["water"], weights: {} },
  createdAt: stamp,
  updatedAt: stamp,
};
const rotation = {
  id: "rot-current", fieldId: "field-4", label: "Rice, then black gram", cycleYears: 1, cycleDays: 365, source: "farmer",
  slots: [
    { id: "slot-1", kind: "crop", cropId: "rice", plantDate: "2026-06-15", harvestDate: "2026-10-15", dateConfidence: "exact", irrigated: false },
    { id: "slot-2", kind: "crop", cropId: "black-gram", plantDate: "2026-11-01", harvestDate: "2027-02-15", dateConfidence: "exact", irrigated: false },
  ],
};

const conditions = {
  fieldId: "field-4", fetchedAt: stamp, climateAvailable: true, annualRainMm: 866,
  monthlyRainMm: [5, 10, 20, 60, 180, 240, 210, 190, 110, 50, 15, 5],
  monthlyEt0Mm: [95, 110, 140, 160, 150, 120, 110, 110, 105, 100, 90, 85],
  monthlyTmaxC: [31, 33, 36, 38, 35, 31, 30, 30, 31, 31, 31, 30],
  monthlyTminC: [16, 17, 21, 24, 25, 25, 24, 24, 24, 23, 20, 17],
  soil: { ph: 5.9, socGKg: 30.5, texture: "clay loam", source: { dataset: "ISRIC SoilGrids v2", resolution: "250 m", depth: "0 to 30 cm" } },
  sources: [{ dataset: "NASA POWER regional gridded estimates" }],
};

const years = Array.from({ length: 45 }, (_, i) => 1981 + i);
const wave = (i, a, b) => Math.sin(i * a) * Math.cos(i * b);
const trends = {
  through: 2025,
  trends: [
    { key: "monsoon-rain", title: "Monsoon rain (Jun to Oct)", unit: "mm", source: "NASA POWER", scale: "wider", test: null, sentence: "",
      years: years.map((y, i) => ({ year: y, value: y === 1993 || y === 2002 ? null : Math.round(760 + 150 * wave(i, 0.9, 0.31) - i * 0.9) })) },
    { key: "hot-days", title: "Days at 35 °C or hotter (Mar to May)", unit: "days", source: "NASA POWER", scale: "wider", test: null, sentence: "",
      years: years.map((y, i) => ({ year: y, value: Math.max(5, Math.round(22 + i * 0.8 + 14 * wave(i, 0.7, 0.2))) })) },
    { key: "cold-nights", title: "Chilly nights (Nov to Feb)", unit: "nights", source: "NASA POWER", scale: "wider", test: null, sentence: "",
      years: years.map((y, i) => ({ year: y, value: Math.max(0, Math.round(14 - i * 0.18 + 8 * wave(i, 1.1, 0.4))) })) },
  ],
};

const dates = ["2024-06-02", "2024-07-20", "2024-08-17", "2024-09-15", "2024-10-03", "2024-11-12", "2025-01-08", "2025-02-25", "2025-03-30", "2025-04-18"];
const remote = {
  fieldId: "field-4", checkedAt: stamp,
  smap: { kind: "smap", status: "unconfigured", start: "", end: "" },
  hls: {
    kind: "hls", status: "ok", start: "2024-06-01", end: "2025-04-30",
    data: { observations: dates.map((date, i) => ({ date, ndviMedian: 0.4 + (i % 4) * 0.08, ndmiMedian: 0.3, coverage: i === 2 ? 0.3 : 0.9, validPixels: 880 - i * 5, totalPixels: 1000, waterPixels: [0, 220, 410, 760, 90, 0, 0, 0, 0, 0][i] })) },
  },
  srtm: { kind: "srtm", status: "ok", start: "2000-02-11", end: "2000-02-21", data: { slope: { medianDeg: 2.4, meanDeg: 2.5, p90Deg: 3.5, validCells: 100, totalCells: 100 } } },
  modis: { kind: "modis", status: "unconfigured", start: "", end: "" },
  ecostressLst: { kind: "ecostress-lst", status: "unconfigured", start: "", end: "" },
  ecostressEt: { kind: "ecostress-et", status: "unconfigured", start: "", end: "" },
};

const json = (body) => (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

export async function prepare(browser, viewport, mobile) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, locale: "en-US", deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.route("**/api/field/*/conditions*", json(conditions));
  await page.route("**/api/field/*/trends*", json(trends));
  await page.route("**/api/field/*/remote-sensing*", json(remote));
  await page.goto(`${BASE}/welcome`);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.goto(`${BASE}/settings`);
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "field4.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ app: "nasa-farming-app", version: 3, exportedAt: stamp, fields: [field4], rotations: [rotation] })),
  });
  await page.waitForTimeout(700);
  return { context, page };
}

export async function openExplorer(page, name) {
  await page.goto(`${BASE}/fields/field-4/conditions`);
  await page.waitForSelector("h2#summary");
  await page.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first().click();
  await page.waitForSelector('[role="dialog"][aria-label="Field Risk Explorer"]');
  await page.waitForTimeout(3500); // basemap tiles
}

async function run() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const sizes = [
    { tag: "375x812", viewport: { width: 375, height: 812 }, mobile: true },
    { tag: "390x844", viewport: { width: 390, height: 844 }, mobile: true },
    { tag: "1440x900", viewport: { width: 1440, height: 900 }, mobile: false },
  ];
  const risks = [["Water stress", "water"], ["Flood", "flood"], ["Erosion", "erosion"], ["Heat & cold", "heat"]];

  for (const s of sizes) {
    const { context, page } = await prepare(browser, s.viewport, s.mobile);
    await page.goto(`${BASE}/fields/field-4/conditions`);
    await page.waitForSelector("h2#summary");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/conditions-${s.tag}-top.png` });
    await page.screenshot({ path: `${OUT}/conditions-${s.tag}-full.png`, fullPage: true });

    for (const [label, id] of risks) {
      await openExplorer(page, label);
      await page.screenshot({ path: `${OUT}/explorer-${id}-${s.tag}-half.png` });
      if (s.mobile) {
        await page.getByRole("button", { name: /Expand findings/ }).click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${OUT}/explorer-${id}-${s.tag}-full.png` });
        await page.getByRole("button", { name: /Back to the map/ }).click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${OUT}/explorer-${id}-${s.tag}-peek.png` });
      }
      await page.getByRole("button", { name: "Back to Conditions" }).click();
      await page.waitForSelector("h2#summary");
    }
    console.log("done", s.tag);
    await context.close();
  }
  await browser.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
