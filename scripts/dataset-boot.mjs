import fs from "fs";

const path = "src/ui/app.js";
let app = fs.readFileSync(path, "utf8");

// Replace boot with ultra-visible version
const oldBoot =
  /WA\(\),Ye\(\),\([\s\S]*?\)\),0\)\}function UA/;

const boot =
  'WA(),Ye(),(document.documentElement.dataset.v5="1",window.__V5_BRIDGED__=1,window.__PANEL_STATE__={design:()=>Y,assembly:()=>kt,net:()=>Xe,issues:()=>Je,toast:pe,recompute:ra,studio:()=>qt},(()=>{try{mountV5Bridge({getDesign:()=>Y,getAssembly:()=>kt,getNet:()=>Xe,getIssues:()=>Je,toast:pe})}catch(err){console.warn("V5 bridge",err);document.documentElement.dataset.v5err=String(err&&err.message||err)}})(),0)}function UA';

if (!oldBoot.test(app)) {
  // try exact current
  if (!app.includes("window.__V5_BRIDGED__")) throw new Error("no boot");
  app = app.replace(
    /WA\(\),Ye\(\),\([\s\S]*?catch\(err\)\{console\.warn\("V5 bridge",err\)\}\)\)\(\)\),0\)\}function UA/,
    boot
  );
} else {
  app = app.replace(oldBoot, boot);
}

fs.writeFileSync(path, app);
console.log("dataset boot", app.includes('dataset.v5'));
