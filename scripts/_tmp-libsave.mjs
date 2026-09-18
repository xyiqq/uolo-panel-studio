import fs from "fs";
const s = fs.readFileSync("src/ui/app.js", "utf8");
const i = s.indexOf('R("#lib-save").onclick');
console.log(s.slice(i, i + 1800));
