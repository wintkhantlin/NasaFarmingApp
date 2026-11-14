import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3000";

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
const networkErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("requestfailed", (req) => {
  networkErrors.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
});
page.on("response", (res) => {
  if (res.status() >= 400) {
    networkErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  }
});

const shot = (name) => page.screenshot({ path: `verify/${name}.png`, fullPage: true });
const step = (msg) => console.log(`▶ ${msg}`);

step("HOME");
await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
await shot("02-home");

step("ADD FIELD (/fields/new)");
await page.locator('a[href="/fields/new"]').first().click({ timeout: 5000 });
await page.waitForURL(/\/fields\/new/, { timeout: 10000 });
await page.waitForTimeout(1500);
await shot("03-add-field");

step("MARK FIELD BY COORDINATES (Magway: 20.15, 94.95)");
await page.locator('summary:has-text("Enter coordinates")').first().click();
await page.locator('input[id$="-lat"]').fill("20.15");
await page.locator('input[id$="-lon"]').fill("94.95");
await page.locator('button:has-text("Place pin here")').click();
await page.waitForTimeout(500);
await shot("04-pin-placed");

step("CONTINUE (opens name sheet)");
await page.locator('button:has-text("Continue")').first().click({ timeout: 5000 });
await page.waitForTimeout(400);
await shot("05-name-sheet");

step("NAME FIELD + CONFIRM + SAVE");
await page.locator('input[id$="-name"]').fill("Smoke test farm");
const confirmBox = page.locator('input[type="checkbox"]').last();
await confirmBox.check();
await shot("06-named");
await page.locator('button:has-text("Save field")').click({ timeout: 5000 });
await page.waitForURL(/\/fields\/[0-9a-zA-Z-]+$/, { timeout: 15000 });
await page.waitForTimeout(1200);
await shot("07-field-saved");
console.log("   saved URL:", page.url());

step("ROTATION STEP");
const rotLink = page.locator('a[href*="/rotation"]').first();
if (await rotLink.count()) {
  await rotLink.click();
} else {
  await page.goto(page.url().replace(/\/$/, "") + "/rotation");
}
await page.waitForURL(/\/rotation/, { timeout: 15000 });
await page.waitForTimeout(800);
await shot("08-rotation");
console.log("   body:", (await page.locator("body").innerText()).slice(0, 500).replace(/\n+/g, " | "));

step("CONDITIONS STEP");
await page.goto(page.url().replace(/\/rotation.*$/, "") + "/conditions");
await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2000);
await shot("09-conditions");
console.log("   body:", (await page.locator("body").innerText()).slice(0, 900).replace(/\n+/g, " | "));

step("COMPARE STEP");
await page.goto(page.url().replace(/\/conditions.*$/, "") + "/compare");
await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2000);
await shot("10-compare");
console.log("   body:", (await page.locator("body").innerText()).slice(0, 900).replace(/\n+/g, " | "));

step("PROFILE STEP");
await page.goto(page.url().replace(/\/compare.*$/, "") + "/profile");
await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1200);
await shot("11-profile");

console.log("\nCONSOLE-ERRORS:", JSON.stringify(consoleErrors, null, 2));
console.log("NETWORK-ERRORS:", JSON.stringify(networkErrors, null, 2));

await browser.close();
console.log("\n✓ Flow complete");
