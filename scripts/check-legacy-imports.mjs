import fs from "fs";

const app = fs.readFileSync("src/ui/app.js", "utf8");
const legacy = fs.readFileSync("src/core/legacy-names.js", "utf8");

// names exported as aliases: `foo as bar` or just re-export
const exported = new Set();
for (const m of legacy.matchAll(/\bas\s+([A-Za-z_$][\w$]*)/g)) exported.add(m[1]);
for (const m of legacy.matchAll(/^\s*([A-Za-z_$][\w$]*),?\s*$/gm)) {
  // skip
}

const importMatch = app.match(/import \{\s*([^}]+)\}\s*from ["']\.\.\/core\/legacy-names/);
const imported = new Set(
  importMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
);

// Find short legacy-like identifiers used in app body (2-3 chars camel or $)
const body = app.slice(app.indexOf("var R="));
const used = new Set();
for (const m of body.matchAll(/\b([a-z$][A-Za-z0-9$]{0,2}|[A-Z][a-zA-Z0-9]{0,2})\s*\(/g)) {
  used.add(m[1]);
}

const missing = [...used].filter((n) => exported.has(n) && !imported.has(n)).sort();
console.log("exported from legacy but not imported:", missing.join(", ") || "(none)");
console.log("ka exported?", exported.has("ka"), "imported?", imported.has("ka"));

// Also check Ys Ha etc that might be used
for (const n of ["ka", "Ys", "Ha", "bo", "tX", "IU", "zU", "$r", "U1", "yo", "fr"]) {
  const uses = (body.match(new RegExp(`\\b${n.replace("$", "\\$")}\\b`, "g")) || []).length;
  console.log(n, "uses", uses, "imported", imported.has(n), "exported", exported.has(n));
}
