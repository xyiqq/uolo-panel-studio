import fs from "fs";

const html = fs.readFileSync("dist/index.html", "utf8");
const start = html.indexOf("<script type=\"module\"");
const end = html.indexOf("</script>", start);
const script = html.slice(html.indexOf(">", start) + 1, end);
const i = script.indexOf("__PANEL_STATE__");
console.log(script.slice(i - 200, i + 300));

// Is STATE inside a function that is never called?
// Search backwards for 'return' before STATE within 500 chars
const before = script.slice(Math.max(0, i - 800), i);
console.log("\n--- has return nearby?", /return\b/.test(before));
console.log("return idx in before", before.lastIndexOf("return"));
