import fs from "fs";

const h = fs.readFileSync("dist/index.html", "utf8");
const a = h.indexOf('<script type="module"');
const b = h.indexOf("</script>", a);
const s = h.slice(h.indexOf(">", a) + 1, b);
const i = s.indexOf("window.__PANEL_STATE__");
const before = s.slice(Math.max(0, i - 500), i);

// Find if we're inside or outside function by scanning for '})();' or similar before STATE
console.log("before STATE (500):", before.slice(-300));

// Search for pattern: }Rn(); or }ra near end of app logic
const markers = ["})();", "})()", "});nu&&", "}Rn();", "}ra();"];
for (const m of markers) {
  const idx = s.lastIndexOf(m, i);
  console.log(m, "lastIndex before STATE", idx, idx > 0 ? s.slice(idx, idx + m.length + 40) : "");
}
