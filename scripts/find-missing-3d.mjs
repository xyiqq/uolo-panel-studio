import fs from "fs";

const chunk = fs.readFileSync("src/view/studio3d.js", "utf8");
// strip imports
const body = chunk.replace(/^[\s\S]*?\n\n/, "");

// Collect identifiers used as constructors / property access roots
const used = new Set();
for (const m of body.matchAll(/\b(?:new |extends |instanceof )([A-Za-z_$][\w$]*)/g)) {
  used.add(m[1]);
}
for (const m of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]{0,3})\.[A-Za-z_$]/g)) {
  used.add(m[1]);
}

// Locally defined: var/function/class assignments at top level-ish
const defined = new Set([
  "console", "Math", "JSON", "document", "window", "performance",
  "devicePixelRatio", "ResizeObserver", "Set", "Map", "Promise", "Error",
  "Object", "Array", "String", "Number", "Boolean", "Uint8Array",
  "Image", "OffscreenCanvas", "requestAnimationFrame", "cancelAnimationFrame",
  "parseFloat", "parseInt", "isNaN", "Infinity", "NaN", "undefined", "null",
  "true", "false", "this", "super", "arguments",
]);

for (const m of body.matchAll(/(?:^|[;\n]|var |let |const |function |class )([A-Za-z_$][\w$]*)\s*=/gm)) {
  defined.add(m[1]);
}
for (const m of body.matchAll(/function ([A-Za-z_$][\w$]*)\s*\(/g)) {
  defined.add(m[1]);
}
for (const m of body.matchAll(/([A-Za-z_$][\w$]*)=class/g)) {
  defined.add(m[1]);
}

// imports
const importBlock = chunk.match(/import \{([^}]+)\} from "\.\/three-shim/);
if (importBlock) {
  for (const name of importBlock[1].split(",")) {
    defined.add(name.trim());
  }
}
defined.add("Ue"); // from constants

const missing = [...used].filter((n) => !defined.has(n) && n.length <= 4).sort();
console.log("possibly missing:", missing.join(", "));

// Also find bare identifier calls like Da( or H1(
for (const name of ["Da", "en", "H1", "So", "fX", "Ga", "CA", "Xo", "OU", "ja", "uX", "Ro", "zo", "wo", "tn", "Pe", "ke", "Te", "ka", "fr"]) {
  const def = body.includes(`${name}=`) || body.includes(`function ${name}`) || body.includes(`${name}=class`) || body.includes(`var ${name}`);
  const use = (body.match(new RegExp(`\\b${name}\\b`, "g")) || []).length;
  console.log(`${name}: defined=${def} uses=${use}`);
}
