import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}\n${err.stack}`));

await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);

// Click fit / front to force camera
await page.click("#fit").catch(() => {});
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const st = window.__PANEL_STATE__;
  const studio = st?.studio?.();
  const scene = studio?.scene;
  const children = [];
  scene?.traverse((o) => {
    if (o.isMesh || o.isGroup) {
      children.push({
        type: o.type,
        name: o.name,
        visible: o.visible,
        children: o.children?.length,
      });
    }
  });
  return {
    hasStudio: !!studio,
    hasModel: !!studio?.model,
    modelKeys: studio?.model ? Object.keys(studio.model) : null,
    sceneChildCount: scene?.children?.length ?? 0,
    meshCount: children.filter((c) => c.type === "Mesh").length,
    named: children.filter((c) => c.name).slice(0, 30),
    cameraPos: studio?.camera?.position?.toArray?.() ?? null,
    controlsTarget: studio?.controls?.target?.toArray?.() ?? null,
    netNodes: st?.net?.()?.assembly?.nodes?.length ?? st?.assembly?.()?.nodes?.length ?? null,
  };
});

console.log(JSON.stringify(info, null, 2));
console.log("---errors---");
logs.filter((l) => /error|Error|not defined/i.test(l)).forEach((l) => console.log(l));
await browser.close();
