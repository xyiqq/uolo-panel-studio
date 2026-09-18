import fs from "fs";

const h = fs.readFileSync("dist/index.html", "utf8");
const a = h.indexOf('<script type="module"');
const b = h.indexOf("</script>", a);
const s = h.slice(h.indexOf(">", a) + 1, b);

// Find end of first IIFE: starts with (function(){
let depth = 0;
let started = false;
let end = -1;
for (let i = 0; i < Math.min(s.length, 50000); i++) {
  // naive skip strings roughly
  const c = s[i];
  if (c === "{") {
    depth++;
    started = true;
  } else if (c === "}") {
    depth--;
    if (started && depth === 0) {
      end = i;
      break;
    }
  }
}
console.log("first IIFE-like block ends at", end);
console.log("snippet around end:", s.slice(Math.max(0, end - 40), end + 80));
console.log("STATE is after first block?", s.indexOf("__PANEL_STATE__") > end);

// Check supports("modulepreload") path - if return exits only polyfill
const ret = s.indexOf('supports("modulepreload"))return');
console.log("early return at", ret);
console.log("after return:", s.slice(ret, ret + 120));
