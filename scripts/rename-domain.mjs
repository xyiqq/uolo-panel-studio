/**
 * P0-3：把 _legacy-domain.js 中的压缩标识符改成语义名。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = path.join(root, "src/core/_legacy-domain.js");
const outPath = path.join(root, "src/core/domain.js");

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function renameIdent(code, from, to) {
  const re = new RegExp(`(?<![A-Za-z0-9_$])${escapeRe(from)}(?![A-Za-z0-9_$])`, "g");
  return code.replace(re, to);
}

let code = fs.readFileSync(srcPath, "utf8");
code = code.replace(/\nexport \{[\s\S]*?\};\s*$/, "\n");

// L1 函数：避免误伤相位字符串 "L1"
code = code.replace(/function L1\(/g, "function reachable(");
code = code.replace(/(?<![A-Za-z0-9_$"])L1\(/g, "reachable(");

const map = [
  ["qU", "schneiderSource"],
  ["Oa", "schneiderProduct"],
  ["go", "BUILTIN_PRODUCTS"],
  ["Za", "CABINETS"],
  ["HA", "GROUPS"],
  ["Qe", "PHASES"],
  ["Ue", "CONDUCTOR_COLORS"],
  ["bA", "SECTIONS"],
  ["Vo", "CURRENT_CAPACITY_TABLE"],
  ["Eo", "INSTALL_METHODS"],
  ["Yr", "TEMP_FACTORS"],
  ["_r", "GROUPING_FACTORS"],
  ["Js", "SOURCE_WORKBOOK"],
  ["js", "allProducts"],
  ["Me", "findProduct"],
  ["gA", "productSku"],
  ["tX", "defaultMainProductId"],
  ["bo", "productPoleKeys"],
  ["Co", "validateCustomProduct"],
  ["ea", "clone"],
  ["IU", "classifyLoad"],
  ["zU", "loadKind"],
  ["$r", "designCurrent"],
  ["eX", "createDefaultDesign"],
  ["ka", "circuitLoads"],
  ["Ys", "circuitWatts"],
  ["fr", "currentCapacity"],
  ["U1", "voltageDrop"],
  ["Mo", "isProtectionFor"],
  ["ta", "unassignedLoads"],
  ["kA", "matchCircuit"],
  ["W1", "phaseDemand"],
  ["N1", "balancePhases"],
  ["Ha", "feedSection"],
  ["Ka", "buildAssembly"],
  ["AX", "auditDesign"],
  ["_s", "validateDesign"],
  ["KA", "portId"],
  ["ur", "internalSection"],
  ["$s", "buildWiring"],
  ["rX", "connectivityGraph"],
  ["aX", "simulate"],
  ["sX", "auditWiring"],
  ["yo", "wireIdsForCircuit"],
];

map.sort((a, b) => b[0].length - a[0].length);
for (const [from, to] of map) code = renameIdent(code, from, to);

const header = `/**
 * 领域模型（P0-3 由 V4 压缩代码语义化改名生成）。
 * 权威实现；后续可再物理拆分到 data/ 与 core/ 子模块。
 */
`;

const exportsBlock = `
export {
  BUILTIN_PRODUCTS,
  schneiderProduct,
  schneiderSource,
  CABINETS,
  GROUPS,
  PHASES,
  CONDUCTOR_COLORS,
  SECTIONS,
  CURRENT_CAPACITY_TABLE,
  INSTALL_METHODS,
  TEMP_FACTORS,
  GROUPING_FACTORS,
  SOURCE_WORKBOOK,
  allProducts,
  findProduct,
  productSku,
  defaultMainProductId,
  productPoleKeys,
  validateCustomProduct,
  clone,
  classifyLoad,
  loadKind,
  designCurrent,
  createDefaultDesign,
  circuitLoads,
  circuitWatts,
  currentCapacity,
  voltageDrop,
  isProtectionFor,
  unassignedLoads,
  matchCircuit,
  phaseDemand,
  balancePhases,
  feedSection,
  buildAssembly,
  auditDesign,
  validateDesign,
  portId,
  internalSection,
  buildWiring,
  connectivityGraph,
  reachable,
  simulate,
  auditWiring,
  wireIdsForCircuit,
};
`;

fs.writeFileSync(outPath, header + code.trimStart() + exportsBlock, "utf8");
console.log("wrote", outPath, fs.statSync(outPath).size, "bytes");

const out = fs.readFileSync(outPath, "utf8");
const leftovers = [];
for (const [from] of map) {
  const re = new RegExp(`(?<![A-Za-z0-9_$])${escapeRe(from)}(?![A-Za-z0-9_$])`);
  if (re.test(out)) leftovers.push(from);
}
// L1 函数残留（字符串 "L1" 允许）
if (/\bfunction L1\b/.test(out) || /(?<![A-Za-z0-9_$"])L1\(/.test(out)) leftovers.push("L1-fn");
if (leftovers.length) {
  console.error("残留标识符:", leftovers.join(", "));
  process.exitCode = 1;
} else {
  console.log("无残留压缩标识符");
}
