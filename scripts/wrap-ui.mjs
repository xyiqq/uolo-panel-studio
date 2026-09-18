/**
 * 将 V4 UI 原码包装为 ESM 模块。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ui = fs.readFileSync(path.join(process.env.TEMP, "ui-raw.js"), "utf8");

const preamble = `import { createIcons, icons } from "lucide";
import {
  eX, _s, $s, Ka, kA, AX, sX, aX, Me, gA, js, Co, ea, ta, fr, Mo, W1, N1, yo,
  Ue, HA, Za, Qe, bA, Eo, Yr, _r, Js
} from "../core/legacy-names.js";
import { renderTerminalSchematic as nX } from "../view/terminal-schematic.js";
import { Studio3D as Qo } from "../view/studio3d.js";
import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";
import "../styles/app.css";

const sz = createIcons;
const un = icons;

`;

// Strip leading "var R=" -> keep as is but ensure we don't double-declare imports
let body = ui.trim();
if (body.startsWith("var R=")) {
  // ok
}

const out = preamble + body + "\n";
const outPath = path.join(root, "src/ui/app.js");
fs.writeFileSync(outPath, out, "utf8");
console.log("wrote", outPath, fs.statSync(outPath).size);
