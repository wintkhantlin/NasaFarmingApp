import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const weatherFixture = JSON.parse(
  readFileSync("data/predownload/weather/power_20.0_95.000.json", "utf8")
).weather;

const stamp = new Date().toISOString();

const field4 = {
  id: "field-4",
  name: "Field 4",
  geometry: { type: "Point", coordinates: [95.12, 16.84] },
  centroid: [95.12, 16.84],
  samplePoints: [[95.12, 16.84]],
  areaHa: 9.2,
  region: "ayeyarwady",
  locationConfirmed: true,
  irrigation: "none",
  priorities: { order: ["water"], weights: {} },
  localNotes: "Water check: well is at 16.840, 95.120 near the secondary ditch.",
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

async function setupPageRoutes(page) {
  await page.route("**/api/field/*/conditions?*", (route) =>
    route.fulfill({
      json: {
        fieldId: field4.id,
        fetchedAt: stamp,
        climateAvailable: true,
        soilAvailable: false,
        weather: weatherFixture,
        sources: [{ dataset: "NASA POWER regional gridded estimates" }],
        power: {
          status: "ok",
          version: weatherFixture.meta.apiVersion,
          fillValue: -999,
          timeStandard: "UTC",
          sources: weatherFixture.meta.sources,
          retrievedAt: stamp,
          start: weatherFixture.dates[0],
          end: weatherFixture.dates.at(-1),
          elevationM: weatherFixture.elevationM,
          units: weatherFixture.meta.units,
        },
      },
    })
  );

  await page.route("**/api/field/*/remote-sensing", (route) =>
    route.fulfill({
      json: {
        fieldId: field4.id,
        checkedAt: stamp,
        smap: { status: "unconfigured" },
        hls: { status: "unavailable" },
        srtm: { status: "unconfigured" },
        modis: { status: "unconfigured" },
        ecostressLst: { status: "unconfigured" },
        ecostressEt: { status: "unconfigured" },
      },
    })
  );
}

async function injectFieldAndSettings(page, locale = "en") {
  await page.goto("http://localhost:3001/welcome");
  await page.getByRole("button", { name: /continue/i }).click();

  await page.goto("http://localhost:3001/settings");
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

  // 1. Desktop Screenshot (1280x900)
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    });
    const page = await context.newPage();
    await setupPageRoutes(page);
    await injectFieldAndSettings(page, "en");

    await page.goto("http://localhost:3001/fields/field-4/report");
    await page.waitForSelector("h1:has-text('Field 4')");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "docs/screenshots/s16-report-after-desktop.png",
      fullPage: true,
    });
    console.log("Captured docs/screenshots/s16-report-after-desktop.png");

    // 2. Location Hidden Screenshot
    await page.getByRole("checkbox", { name: "Hide exact location" }).check();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "docs/screenshots/s16-report-after-hidden-location.png",
      fullPage: false,
    });
    console.log("Captured docs/screenshots/s16-report-after-hidden-location.png");

    // 3. Print Simulation Screenshot (A4 media query)
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "docs/screenshots/s16-report-after-print.png",
      fullPage: true,
    });
    console.log("Captured docs/screenshots/s16-report-after-print.png");

    await context.close();
  }

  // 4. Mobile Screenshot (390x844 Pixel 7 / iPhone)
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

    await page.goto("http://localhost:3001/fields/field-4/report");
    await page.waitForSelector("h1:has-text('Field 4')");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "docs/screenshots/s16-report-after-mobile.png",
      fullPage: true,
    });
    console.log("Captured docs/screenshots/s16-report-after-mobile.png");

    await context.close();
  }

  // 5. Myanmar Locale Mobile Screenshot
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: "my-MM",
    });
    const page = await context.newPage();
    await setupPageRoutes(page);
    await injectFieldAndSettings(page, "my");

    await page.goto("http://localhost:3001/fields/field-4/report");
    await page.waitForSelector("h1:has-text('Field 4')");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "docs/screenshots/s16-report-after-myanmar.png",
      fullPage: true,
    });
    console.log("Captured docs/screenshots/s16-report-after-myanmar.png");

    await context.close();
  }

  await browser.close();
  console.log("All screenshots captured successfully.");
}

run().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
