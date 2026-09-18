import fs from "fs";

const app = fs.readFileSync("src/ui/app.js", "utf8");
const legacy = fs.readFileSync("src/core/legacy-names.js", "utf8");
const exported = new Set([...legacy.matchAll(/ as ([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
const imported = new Set(
  app
    .match(/import \{([^}]+)\} from "\.\.\/core\/legacy-names/)[1]
    .split(",")
    .map((s) => s.trim())
);
const body = app.slice(app.indexOf("var R="));

const missing = [];
for (const n of exported) {
  const re = new RegExp(`\\b${n.replace(/\$/g, "\\$")}\\b`);
  if (re.test(body) && !imported.has(n)) missing.push(n);
}
console.log("missing legacy imports:", missing);

// find vA occurrences with context
let i = -1;
let c = 0;
while ((i = body.indexOf("vA", i + 1)) >= 0 && c++ < 15) {
  const ctx = body.slice(Math.max(0, i - 25), i + 35);
  // skip HTML / CSS noise if any
  if (/[a-zA-Z]$/.test(body[i - 1] || "") || /^[a-zA-Z]/.test(body[i + 2] || "")) continue;
  console.log("vA@", i, JSON.stringify(ctx));
}
