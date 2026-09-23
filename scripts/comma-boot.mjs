import "./_require-write.mjs";
import fs from "fs";

const path = "src/ui/app.js";
let app = fs.readFileSync(path, "utf8");

// Strip any previous boot fragment
app = app.replace(
  /WA\(\),Ye\(\),\([\s\S]*?\)\),0\)\}function UA/,
  "WA(),Ye()}function UA"
);
app = app.replace(
  /WA\(\),Ye\(\);\s*if\(!window\.__V5_BRIDGED__\)\{[\s\S]*?\}\s*\}function UA/,
  "WA(),Ye()}function UA"
);

const boot =
  'WA(),Ye(),(window.__V5_BRIDGED__||(window.__V5_BRIDGED__=1,window.__PANEL_STATE__={design:()=>Y,assembly:()=>kt,net:()=>Xe,issues:()=>Je,toast:pe,recompute:ra,studio:()=>qt},(()=>{try{mountV5Bridge({getDesign:()=>Y,getAssembly:()=>kt,getNet:()=>Xe,getIssues:()=>Je,toast:pe})}catch(err){console.warn("V5 bridge",err)}})()),0)}function UA';

if (!app.includes("WA(),Ye()}function UA")) {
  throw new Error("anchor missing");
}
app = app.replace("WA(),Ye()}function UA", boot);

if (!app.includes('from "./v5-bridge.js"')) {
  app = app.replace(
    'import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";',
    'import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";\nimport { mountV5Bridge } from "./v5-bridge.js";'
  );
}

fs.writeFileSync(path, app);
console.log("fixed boot");
