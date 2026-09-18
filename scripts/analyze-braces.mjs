import fs from "fs";

const html = fs.readFileSync("dist/index.html", "utf8");
const start = html.indexOf("<script type=\"module\"");
const end = html.indexOf("</script>", start);
const script = html.slice(html.indexOf(">", start) + 1, end);
const qa = script.indexOf("__PANEL_ENABLE_QA__");
const slice = script.slice(qa);

let depth = 0;
let started = false;
for (let i = 0; i < slice.length; i++) {
  const c = slice[i];
  if (c === "{") {
    depth++;
    started = true;
  }
  if (c === "}") {
    depth--;
    if (started && depth === 0) {
      console.log("first outer block ends at", i);
      console.log("after:", slice.slice(i, i + 150));
      const rest = slice.slice(i + 1);
      let d2 = 0;
      for (const ch of rest) {
        if (ch === "{") d2++;
        if (ch === "}") d2--;
      }
      console.log("brace delta after close→EOF", d2);
      console.log("contains STATE?", rest.includes("__PANEL_STATE__"));
      break;
    }
  }
}

// Global brace balance of whole script
let g = 0;
let min = 0;
for (const ch of script) {
  if (ch === "{") g++;
  if (ch === "}") {
    g--;
    if (g < min) min = g;
  }
}
console.log("global brace end", g, "min", min);
