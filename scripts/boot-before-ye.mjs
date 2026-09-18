import fs from "fs";

const path = "src/ui/app.js";
let app = fs.readFileSync(path, "utf8");

// Remove existing boot from end of ra chain
app = app.replace(
  /,Ye\(\),\([\s\S]*?dataset\.v5[\s\S]*?\),0\)\}function UA/,
  ",Ye()}function UA"
);
app = app.replace(
  /,Ye\(\),\([\s\S]*?__V5_BRIDGED__[\s\S]*?\),0\)\}function UA/,
  ",Ye()}function UA"
);

const bootExpr =
  '(document.documentElement.dataset.v5="1",window.__V5_BRIDGED__=1,window.__PANEL_STATE__={design:()=>Y,assembly:()=>kt,net:()=>Xe,issues:()=>Je,toast:pe,recompute:ra,studio:()=>qt},(()=>{try{mountV5Bridge({getDesign:()=>Y,getAssembly:()=>kt,getNet:()=>Xe,getIssues:()=>Je,toast:pe})}catch(err){console.warn("V5 bridge",err);document.documentElement.dataset.v5err=String(err&&err.message||err)}})())';

// Insert BEFORE Ye() so icon refresh errors cannot skip bridge
if (!app.includes('dataset.v5="1"')) {
  if (!app.includes("WA(),Ye()}function UA")) {
    throw new Error("anchor missing: " + app.includes("WA(),Ye()"));
  }
  app = app.replace(
    "WA(),Ye()}function UA",
    `WA(),${bootExpr},Ye()}function UA`
  );
}

fs.writeFileSync(path, app);
console.log("boot before Ye", app.includes('WA(),(document.documentElement.dataset.v5'));
