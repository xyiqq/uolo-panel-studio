import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const el = document.querySelector("#canvas");
  const sheets = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      const text = rule.cssText || "";
      if (/\.canvas[\s{,]|#canvas/.test(text) && /position/.test(text)) {
        sheets.push(text.slice(0, 240));
      }
    }
  }
  return {
    className: el.className,
    inline: el.getAttribute("style"),
    position: getComputedStyle(el).position,
    matching: sheets,
    parentPos: getComputedStyle(el.parentElement).position,
    childTag: el.firstElementChild?.tagName,
    childStyle: el.firstElementChild?.getAttribute("style")?.slice(0, 120),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
