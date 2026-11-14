import { chromium } from "playwright-core";
const b = await chromium.launch({ headless: true, channel: "chrome" });
const p = await b.newPage();
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
for (const a of await p.locator("a").all()) {
  console.log(JSON.stringify((await a.textContent())?.trim().slice(0,40)), "->", await a.getAttribute("href"));
}
console.log("--- BUTTONS ---");
for (const a of await p.locator("button").all()) {
  console.log(JSON.stringify((await a.textContent())?.trim().slice(0,40)));
}
await b.close();
