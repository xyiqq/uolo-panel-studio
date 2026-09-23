import "./_require-write.mjs";
import fs from "fs";

const path = "src/ui/app.js";
let app = fs.readFileSync(path, "utf8");

// Remove boot from WA/Ye area
app = app.replace(
  /,?\(document\.documentElement\.dataset\.v5="1"[\s\S]*?\)\)\(\)\)/,
  ""
);

const boot =
  '(document.documentElement.dataset.v5="1",window.__V5_BRIDGED__=1,window.__PANEL_STATE__={design:()=>Y,assembly:()=>kt,net:()=>Xe,issues:()=>Je,toast:pe,recompute:ra,studio:()=>qt},(()=>{try{mountV5Bridge({getDesign:()=>Y,getAssembly:()=>kt,getNet:()=>Xe,getIssues:()=>Je,toast:pe})}catch(err){document.documentElement.dataset.v5err=String(err&&err.message||err)}})())';

if (!app.includes('dataset.v5="1"')) {
  if (!app.includes("function ra(){gX(),")) {
    throw new Error("ra start missing");
  }
  app = app.replace("function ra(){gX(),", `function ra(){gX(),${boot},`);
}

fs.writeFileSync(path, app);
console.log("boot at ra start", app.includes("function ra(){gX(),(document.documentElement"));
