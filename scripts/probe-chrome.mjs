import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);

const before = await page.evaluate(() => {
  const wrap = document.querySelector(".canvas-wrap");
  const top = document.querySelector(".canvas-top");
  const dock = document.querySelector(".parts-dock");
  const studio = window.__PANEL_STATE__?.studio?.();
  return {
    hasTopBtn: !!document.querySelector("#chrome-top"),
    hasBottomBtn: !!document.querySelector("#chrome-bottom"),
    topDisplay: top ? getComputedStyle(top).display : null,
    dockDisplay: dock ? getComputedStyle(dock).display : null,
    classes: wrap?.className ?? null,
    camZ: studio?.camera?.position?.z ?? null,
  };
});
console.log("before", before);

await page.click("#chrome-top");
await page.click("#chrome-bottom");
await page.waitForTimeout(800);

const after = await page.evaluate(() => {
  const wrap = document.querySelector(".canvas-wrap");
  const top = document.querySelector(".canvas-top");
  const dock = document.querySelector(".parts-dock");
  const phase = document.querySelector(".phase-strip");
  const studio = window.__PANEL_STATE__?.studio?.();
  return {
    classes: wrap?.className ?? null,
    topDisplay: top ? getComputedStyle(top).display : null,
    dockDisplay: dock ? getComputedStyle(dock).display : null,
    phaseDisplay: phase ? getComputedStyle(phase).display : null,
    topActive: document.querySelector("#chrome-top")?.classList.contains("active"),
    bottomActive: document.querySelector("#chrome-bottom")?.classList.contains("active"),
    camZ: studio?.camera?.position?.z ?? null,
  };
});
console.log("after", after);

await page.screenshot({ path: "docs/_smoke-chrome-hidden.png", fullPage: false });
await browser.close();
