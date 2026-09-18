import fs from "fs";

const path = "src/core/domain.js";
let s = fs.readFileSync(path, "utf8");
if (!s.includes("SMART_PRODUCTS")) {
  s = s.replace(
    "/** 从配电工坊V4.html",
    'import { SMART_PRODUCTS } from "../data/products/smart-index.js";\n/** 从配电工坊V4.html'
  );
  s = s.replace(
    "allProducts=a=>[...BUILTIN_PRODUCTS,...a.customProducts||[]]",
    "allProducts=a=>[...BUILTIN_PRODUCTS,...SMART_PRODUCTS,...a.customProducts||[]]"
  );
  fs.writeFileSync(path, s);
  console.log("domain patched");
} else {
  console.log("domain already patched");
}

const appPath = "src/ui/app.js";
let app = fs.readFileSync(appPath, "utf8");
if (!app.includes("__PANEL_STATE__")) {
  // Append state bridge near end before last statements — after gX(); try{qt=...
  const marker = "G1&&pe(G1);";
  if (!app.includes(marker)) throw new Error("marker not found");
  app = app.replace(
    marker,
    `${marker}
window.__PANEL_STATE__={
  design:()=>Y,
  assembly:()=>kt,
  net:()=>Xe,
  issues:()=>Je,
  toast:pe,
  recompute:ra,
  studio:()=>qt
};`
  );
  fs.writeFileSync(appPath, app);
  console.log("app state hook patched");
} else {
  console.log("app already hooked");
}
