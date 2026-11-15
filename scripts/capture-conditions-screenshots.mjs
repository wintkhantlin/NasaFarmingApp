import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const stamp = new Date().toISOString();

const field4 = {
  id: "field-4",
  name: "Field 4",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [95.11, 16.83],
        [95.13, 16.83],
        [95.13, 16.85],
        [95.11, 16.85],
        [95.11, 16.83],
      ],
    ],
  },
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

const currentRotation = {
  id: "rot-current",
  fieldId: "field-4",
  label: "Rice, then black gram",
  cycleYears: 1,
  cycleDays: 365,
  source: "farmer",
  slots: [
    {
      id: "slot-1",
      kind: "crop",
      cropId: "rice",
      plantDate: "2026-06-15",
      harvestDate: "2026-10-15",
      dateConfidence: "exact",
      irrigated: false,
    },
    {
      id: "slot-2",
      kind: "crop",
      cropId: "black-gram",
      plantDate: "2026-11-01",
      harvestDate: "2027-02-15",
      dateConfidence: "exact",
      irrigated: false,
    },
  ],
};

const mockConditions = {
  fieldId: "field-4",
  fetchedAt: stamp,
  climateAvailable: true,
  annualRainMm: 866,
  monthlyRainMm: [5, 10, 20, 60, 180, 240, 210, 190, 110, 50, 15, 5],
  monthlyEt0Mm: [95, 110, 140, 160, 150, 120, 110, 110, 105, 100, 90, 85],
  monthlyTmaxC: [31, 33, 36, 38, 35, 31, 30, 30, 31, 31, 31, 30],
  monthlyTminC: [16, 17, 21, 24, 25, 25, 24, 24, 24, 23, 20, 17],
  soil: {
    ph: 5.9,
    socGKg: 30.5,
    texture: "clay loam",
    source: { dataset: "ISRIC SoilGrids v2", resolution: "250 m", depth: "0 to 30 cm" },
  },
  sources: [{ dataset: "NASA POWER regional gridded estimates" }],
};

const mockTrends = {
  through: 2025,
  trends: [
    {
      key: "monsoon-rain",
      title: "Monsoon rain (Jun to Oct)",
      unit: "mm",
      source: "NASA POWER",
      scale: "wider",
      years: [
        { year: 2023, value: 850 },
        { year: 2024, value: 920 },
        { year: 2025, value: 810 },
      ],
      test: null,
      sentence: "Monsoon rain trend",
    },
    {
      key: "hot-days",
      title: "Days at 35 °C or hotter (Mar to May)",
      unit: "days",
      source: "NASA POWER",
      scale: "wider",
      years: [
        { year: 2023, value: 45 },
        { year: 2024, value: 52 },
        { year: 2025, value: 68 },
      ],
      test: null,
      sentence: "Hot days trend",
    },
  ],
};

const mockRemote = {
  fieldId: "field-4",
  checkedAt: stamp,
  smap: { kind: "smap", status: "unconfigured", start: "", end: "" },
  hls: {
    kind: "hls",
    status: "ok",
    start: "2021-01-01",
    end: "2025-12-31",
    data: {
      observations: [
        {
          date: "2024-09-15",
          ndviMedian: 0.65,
          ndmiMedian: 0.42,
          coverage: 0.95,
          validPixels: 95,
          totalPixels: 100,
          waterPixels: 5,
        },
      ],
    },
  },
  srtm: {
    kind: "srtm",
    status: "ok",
    start: "2000-02-11",
    end: "2000-02-21",
    data: {
      slope: {
        medianDeg: 2.4,
        meanDeg: 2.5,
        p90Deg: 3.5,
        validCells: 100,
        totalCells: 100,
      },
    },
  },
  modis: { kind: "modis", status: "unconfigured", start: "", end: "" },
  ecostressLst: { kind: "ecostress-lst", status: "unconfigured", start: "", end: "" },
  ecostressEt: { kind: "ecostress-et", status: "unconfigured", start: "", end: "" },
};

const PORT = 3001;
const BASE = `http://localhost:${PORT}`;

async function setupPageRoutes(page) {
  await page.route("**/api/field/*/conditions*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockConditions),
    })
  );
  await page.route("**/api/field/*/trends*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockTrends),
    })
  );
  await page.route("**/api/field/*/remote-sensing*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockRemote),
    })
  );
}

async function injectFieldAndSettings(page, locale = "en") {
  await page.goto(`${BASE}/welcome`);
  await page.getByRole("button", { name: /continue/i }).click();

  await page.goto(`${BASE}/settings`);
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "field4.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        app: "nasa-farming-app",
        version: 3,
        exportedAt: stamp,
        fields: [field4],
        rotations: [currentRotation],
      })
    ),
  });

  if (locale === "my") {
    await page.evaluate(() => {
      localStorage.setItem("fieldshift.locale.v1", JSON.stringify({ locale: "my", areaUnit: "ha" }));
    });
  }

  await page.waitForTimeout(600);
}

async function run() {
  mkdirSync("docs/screenshots", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // 1. Desktop Surface A: Conditions Overview (1280x900)
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    });
    const page = await context.newPage();
    await setupPageRoutes(page);
    await injectFieldAndSettings(page, "en");

    await page.goto(`${BASE}/fields/field-4/conditions`);
    await page.waitForSelector("h2#summary");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "docs/screenshots/s07-conditions-overview-desktop.png",
      fullPage: true,
    });
    console.log("Captured docs/screenshots/s07-conditions-overview-desktop.png");

    // Open Explorer with Water Stress
    await page.getByRole("button", { name: /Water stress/i }).first().click();
    await page.waitForSelector('div[role="main"][aria-label="Field Risk Explorer"]');
    await page.waitForTimeout(800);

    await page.screenshot({
      path: "docs/screenshots/s07-risk-explorer-water-desktop.png",
      fullPage: false,
    });
    console.log("Captured docs/screenshots/s07-risk-explorer-water-desktop.png");

    // Click Erosion Tab
    await page.getByRole("tab", { name: /Erosion/i }).click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: "docs/screenshots/s07-risk-explorer-erosion-desktop.png",
      fullPage: false,
    });
    console.log("Captured docs/screenshots/s07-risk-explorer-erosion-desktop.png");

    await context.close();
  }

  // 2. Mobile Surface A: Conditions Overview & Surface B Mobile (390x844)
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: "en-US",
    });
    const page = await context.newPage();
    await setupPageRoutes(page);
    await injectFieldAndSettings(page, "en");

    await page.goto(`${BASE}/fields/field-4/conditions`);
    await page.waitForSelector("h2#summary");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "docs/screenshots/s07-conditions-overview-mobile.png",
      fullPage: false,
    });
    console.log("Captured docs/screenshots/s07-conditions-overview-mobile.png");

    // Open Explorer with Flood
    await page.getByRole("button", { name: /Flood/i }).first().click();
    await page.waitForSelector('div[role="main"][aria-label="Field Risk Explorer"]');
    await page.waitForTimeout(800);

    await page.screenshot({
      path: "docs/screenshots/s07-risk-explorer-flood-mobile.png",
      fullPage: false,
    });
    console.log("Captured docs/screenshots/s07-risk-explorer-flood-mobile.png");

    // Click Heat & Cold Tab
    await page.getByRole("tab", { name: /Heat & cold/i }).click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: "docs/screenshots/s07-risk-explorer-heat-mobile.png",
      fullPage: false,
    });
    console.log("Captured docs/screenshots/s07-risk-explorer-heat-mobile.png");

    await context.close();
  }

  await browser.close();
}

run().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
