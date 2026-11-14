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

await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
await shot("01-home");
console.log("TITLE:", await page.title());
console.log("BODY-TEXT (first 600):\n", (await page.locator("body").innerText()).slice(0, 600));
console.log("CONSOLE-ERRORS:", JSON.stringify(consoleErrors, null, 2));
console.log("NETWORK-ERRORS:", JSON.stringify(networkErrors, null, 2));

await browser.close();
