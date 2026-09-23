import "./_require-write.mjs";
import fs from "fs";

const path = "src/ui/app.js";
let app = fs.readFileSync(path, "utf8");

if (!app.includes('from "./v5-bridge.js"')) {
  app = app.replace(
    'import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";',
    'import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";\nimport { mountV5Bridge } from "./v5-bridge.js";'
  );
}

const hook = `window.__PANEL_STATE__={
  design:()=>Y,
  assembly:()=>kt,
  net:()=>Xe,
  issues:()=>Je,
  toast:pe,
  recompute:ra,
  studio:()=>qt
};`;

const boot = `window.__PANEL_STATE__={
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
}catch(err){console.warn("V5 bridge",err);}`;

if (!app.includes("mountV5Bridge({")) {
  if (!app.includes(hook)) throw new Error("hook missing");
  app = app.replace(hook, boot);
  console.log("inlined mountV5Bridge call");
} else {
  console.log("mount call already present");
}

fs.writeFileSync(path, app);

// simplify main.js
fs.writeFileSync(
  "src/main.js",
  `import "./ui/app.js";\n`
);
console.log("main.js simplified");
