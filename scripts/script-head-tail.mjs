import fs from "fs";
const h = fs.readFileSync("dist/index.html", "utf8");
const a = h.indexOf('<script type="module"');
const b = h.indexOf("</script>", a);
const s = h.slice(h.indexOf(">", a) + 1, b);
console.log("HEAD:", s.slice(0, 200));
console.log("TAIL:", s.slice(-250));
const i = s.indexOf("window.__PANEL_STATE__");
console.log("chars after STATE to EOF", s.length - i);
