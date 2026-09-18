import fs from "fs";
const s = fs.readFileSync("src/ui/app.js", "utf8");
const i = s.indexOf("function qX");
console.log(s.slice(i, i + 3500));
