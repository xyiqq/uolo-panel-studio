import "./_require-write.mjs";
import fs from "fs";

const path = "src/ui/app.js";
let app = fs.readFileSync(path, "utf8");

// Aggressive strip of any bridge boot comma-group
while (app.includes('dataset.v5="1"')) {
  const start = app.indexOf('(document.documentElement.dataset.v5="1"');
  if (start < 0) break;
  // find matching close for this paren group — scan
  let depth = 0;
  let end = -1;
  for (let i = start; i < app.length; i++) {
    if (app[i] === "(") depth++;
    if (app[i] === ")") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error("unclosed boot");
  // also remove leading comma if present
  let from = start;
  if (app[from - 1] === ",") from--;
  app = app.slice(0, from) + app.slice(end + 1);
  console.log("stripped one boot");
}

const boot =
  '(document.documentElement.dataset.v5="1",window.__V5_BRIDGED__=1,window.__PANEL_STATE__={design:()=>Y,assembly:()=>kt,net:()=>Xe,issues:()=>Je,toast:pe,recompute:ra,studio:()=>qt},(()=>{try{mountV5Bridge({getDesign:()=>Y,getAssembly:()=>kt,getNet:()=>Xe,getIssues:()=>Je,toast:pe})}catch(err){document.documentElement.dataset.v5err=String(err&&err.message||err)}})())';

app = app.replace("function ra(){gX(),", `function ra(){gX(),${boot},`);

if (!app.includes('from "./v5-bridge.js"')) {
  app = app.replace(
    'import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";',
    'import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";\nimport { mountV5Bridge } from "./v5-bridge.js";'
  );
}

fs.writeFileSync(path, app);
const i = app.indexOf("function ra(){");
console.log(app.slice(i, i + 160));
