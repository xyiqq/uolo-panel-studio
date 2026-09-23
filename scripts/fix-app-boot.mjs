import "./_require-write.mjs";
import fs from "fs";

const path = "src/ui/app.js";
let app = fs.readFileSync(path, "utf8");

// Strip broken QA probe (references St/jt/X not in scope; extra braces from V4 IIFE)
const qaStart = app.indexOf("if(window.__PANEL_ENABLE_QA__&&qt){");
const g1 = app.indexOf("G1&&pe(G1);");
if (qaStart >= 0 && g1 > qaStart) {
  app = app.slice(0, qaStart) + app.slice(g1);
  console.log("removed QA block");
} else {
  console.log("QA block not found or already removed", { qaStart, g1 });
}

const boot = `
G1&&pe(G1);
window.__PANEL_STATE__={
  design:()=>Y,
  assembly:()=>kt,
  net:()=>Xe,
  issues:()=>Je,
  toast:pe,
  recompute:ra,
  studio:()=>qt
};
try{
  mountV5Bridge({
    getDesign:()=>Y,
    getAssembly:()=>kt,
    getNet:()=>Xe,
    getIssues:()=>Je,
    toast:pe
  });
}catch(err){console.warn("V5 bridge",err);}
`;

// Ensure single boot after ra()
if (app.includes("mountV5Bridge({")) {
  // remove existing boot tail after ra();
  const ra = app.lastIndexOf("}ra();");
  if (ra < 0) throw new Error("ra() marker missing");
  app = app.slice(0, ra + 6) + boot;
  console.log("replaced boot after ra()");
}

if (!app.includes('from "./v5-bridge.js"')) {
  app = app.replace(
    'import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";',
    'import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";\nimport { mountV5Bridge } from "./v5-bridge.js";'
  );
}

fs.writeFileSync(path, app);
console.log("done, tail:\n", app.slice(-500));
