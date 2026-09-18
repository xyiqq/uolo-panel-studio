import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const logs = [];
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") logs.push(`[${msg.type()}] ${msg.text()}`);
});
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => ({
  hasCanvas: !!document.querySelector("#canvas canvas"),
  engine: document.querySelector("#canvas canvas")?.dataset?.engine || null,
  ready: document.querySelector("#canvas canvas")?.dataset?.ready || null,
  renderStatus: document.querySelector("#render-status")?.textContent || null,
  emptyMsg: document.querySelector("#canvas .empty")?.textContent || null,
}));

await page.screenshot({
  path: "docs/_smoke-3d-cabinet.png",
  fullPage: false,
});

console.log(JSON.stringify(info, null, 2));
console.log("---logs---");
logs.forEach((l) => console.log(l));
await browser.close();
