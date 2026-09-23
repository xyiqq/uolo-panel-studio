import "./_require-write.mjs";
import fs from "fs";

const path = "src/ui/app.js";
let app = fs.readFileSync(path, "utf8");

// Ensure import
if (!app.includes('from "./v5-bridge.js"')) {
  app = app.replace(
    'import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";',
    'import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";\nimport { mountV5Bridge } from "./v5-bridge.js";'
  );
}

// Inject one-shot bridge mount at end of ra() function
if (!app.includes("__V5_BRIDGED__")) {
  // ra is `function ra(){gX(),...Ye()}` — find `function ra()` or `function ra(){` / `ra=()=>{` / in minified `function ra(){`
  // In app: `function ra(){gX(),R("#project-title")...Ye()}`
  const marker = "function ra(){";
  const idx = app.indexOf(marker);
  if (idx < 0) throw new Error("ra() not found");
  // Find matching close of ra — fragile; instead patch Ye() call at end of first ra body via unique string
  // Looking at code: ends with `WA(),Ye()}` before `function UA`
  const endMark = "WA(),Ye()}function UA";
  if (!app.includes(endMark)) {
    // try alternate
    const alt = app.indexOf("WA(),Ye()}");
    console.log("alt Ye close at", alt, app.slice(alt, alt + 40));
    throw new Error("endMark missing: " + endMark);
  }
  app = app.replace(
    endMark,
    `WA(),Ye();
if(!window.__V5_BRIDGED__){window.__V5_BRIDGED__=1;window.__PANEL_STATE__={design:()=>Y,assembly:()=>kt,net:()=>Xe,issues:()=>Je,toast:pe,recompute:ra,studio:()=>qt};try{mountV5Bridge({getDesign:()=>Y,getAssembly:()=>kt,getNet:()=>Xe,getIssues:()=>Je,toast:pe})}catch(err){console.warn("V5 bridge",err)}}
}function UA`
  );
  console.log("injected into ra()");
}

// Remove trailing boot after catch WebGL to avoid double / dead code confusion
const trail = app.indexOf("}ra();\nG1&&pe(G1);");
if (trail > 0) {
  app = app.slice(0, trail + 6) + "\nG1&&pe(G1);\n";
  console.log("trimmed dead trailing boot");
} else {
  // also try without newline
  const t2 = app.lastIndexOf("}ra();");
  const state = app.indexOf("window.__PANEL_STATE__", t2);
  if (t2 > 0 && state > t2) {
    app = app.slice(0, t2 + 6) + "\nG1&&pe(G1);\n";
    console.log("trimmed trailing boot (alt)");
  }
}

fs.writeFileSync(path, app);
console.log("tail:\n", app.slice(-400));
