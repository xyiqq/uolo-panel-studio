import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));

await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

// clear chrome prefs and reload clean
await page.evaluate(() => localStorage.removeItem("panel-studio-chrome"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const wrap = document.querySelector(".canvas-wrap");
  const canvasHost = document.querySelector("#canvas");
  const canvas = document.querySelector("#canvas canvas");
  const overlay = document.querySelector("#overlay");
  const studio = window.__PANEL_STATE__?.studio?.();
  const wr = wrap.getBoundingClientRect();
  const cr = canvas.getBoundingClientRect();
  const hr = canvasHost.getBoundingClientRect();
  const cs = getComputedStyle(canvasHost);
  const kids = [...(overlay?.children || [])].map((el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return {
      cls: el.className,
      display: st.display,
      bg: st.backgroundColor,
      top: Math.round(r.top),
      height: Math.round(r.height),
      width: Math.round(r.width),
      position: st.position,
      left: st.left,
      right: st.right,
    };
  });
  return {
    wrap: { w: Math.round(wr.width), h: Math.round(wr.height), top: Math.round(wr.top) },
    host: {
      w: Math.round(hr.width),
      h: Math.round(hr.height),
      top: Math.round(hr.top),
      className: canvasHost.className,
      position: cs.position,
      inset: cs.inset,
      top: cs.top,
      bottom: cs.bottom,
      height: cs.height,
      width: cs.width,
    },
    canvas: {
      cssW: Math.round(cr.width),
      cssH: Math.round(cr.height),
      bufW: canvas.width,
      bufH: canvas.height,
    },
    kids,
    view: studio?.viewport?.() ?? null,
  };
});

console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "docs/_smoke-canvas-block.png", fullPage: false });
await browser.close();
