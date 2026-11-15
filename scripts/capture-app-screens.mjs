import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3001";
const OUT_DIR = path.resolve("screenshots");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  
  const context = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  console.log("1. Welcome screen");
  await page.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, "01-welcome.png") });

  console.log("2. Dismiss welcome -> Home screen (empty state)");
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, "02-home-empty.png") });

  console.log("3. Add field screen (/fields/new)");
  await page.locator('a[href="/fields/new"]').first().click();
  await page.waitForURL(/\/fields\/new/, { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "03-add-field-map.png") });

  console.log("4. Enter coordinates modal/details");
  await page.locator('button:has-text("Use coordinates")').first().click();
  await page.waitForTimeout(400);
  await page.locator('input[placeholder="South latitude"]').fill("20.14");
  await page.locator('input[placeholder="West longitude"]').fill("94.94");
  await page.locator('input[placeholder="North latitude"]').fill("20.16");
  await page.locator('input[placeholder="East longitude"]').fill("94.96");
  await page.screenshot({ path: path.join(OUT_DIR, "04-field-coordinates-entered.png") });

  console.log("5. Draw box from coordinates");
  await page.locator('button:has-text("Draw box from coordinates")').first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, "05-field-box-drawn.png") });

  console.log("6. Click Continue -> Field Details sheet");
  await page.locator('button:has-text("Continue")').first().click();
  await page.waitForTimeout(600);
  await page.locator('input[placeholder="Field 1"]').fill("Central Dry Zone Demonstration Plot");
  // Click some irrigation if present
  const irrBtn = page.locator('button:has-text("Some irrigation")').first();
  if (await irrBtn.count()) await irrBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "06-field-save-modal.png") });

  console.log("7. Save field -> Lands on Rotation page");
  await page.locator('button:has-text("Save field and continue")').first().click();
  await page.waitForURL(/\/fields\/.*\/rotation/, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const rotUrl = page.url();
  console.log("   Rotation URL:", rotUrl);
  const fieldBaseUrl = rotUrl.replace(/\/rotation.*$/, "");
  console.log("   Field Base URL:", fieldBaseUrl);
  await page.screenshot({ path: path.join(OUT_DIR, "07-field-rotation-setup.png") });

  console.log("8. Add crops to rotation");
  const cropChips = page.locator('button:has-text("Groundnut"), button:has-text("Sesame"), button:has-text("Pigeon pea"), button:has-text("Black gram"), button:has-text("Chickpea")');
  const count = await cropChips.count();
  console.log("   Found crop buttons:", count);
  if (count > 0) {
    await cropChips.nth(0).click();
    await page.waitForTimeout(400);
  }
  if (count > 1) {
    await cropChips.nth(1).click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, "08-field-rotation-crops-selected.png") });

  console.log("9. Field Profile / Overview page");
  await page.goto(`${fieldBaseUrl}/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT_DIR, "09-field-profile.png") });

  console.log("10. Field Conditions (NASA POWER, satellite indices & ISRIC soil)");
  await page.goto(`${fieldBaseUrl}/conditions`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT_DIR, "10-field-conditions.png") });

  console.log("11. Field Compare (Crop Rotation Scenarios & Advisories)");
  await page.goto(`${fieldBaseUrl}/compare`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT_DIR, "11-field-compare.png") });

  console.log("12. Field Report (Adviser & Extension Officer Summary)");
  await page.goto(`${fieldBaseUrl}/report`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "12-field-report.png") });

  console.log("13. Crop Knowledge Base (/about/crops)");
  await page.goto(`${BASE}/about/crops`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "13-about-crops.png") });

  console.log("14. NASA Data Sources (/about/data)");
  await page.goto(`${BASE}/about/data`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "14-about-nasa-data.png") });

  console.log("15. Home screen with saved field card");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "15-home-saved-fields.png") });

  console.log("16. Mobile View - Field Conditions");
  const mobilePage = await context.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.goto(`${fieldBaseUrl}/conditions`, { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(2500);
  await mobilePage.screenshot({ path: path.join(OUT_DIR, "16-mobile-conditions.png") });

  console.log("17. Mobile View - Field Compare & Trade-offs");
  await mobilePage.goto(`${fieldBaseUrl}/compare`, { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(2500);
  await mobilePage.screenshot({ path: path.join(OUT_DIR, "17-mobile-compare.png") });

  await mobilePage.close();
  await browser.close();
  console.log("All screenshots captured successfully in:", OUT_DIR);
}

capture().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
