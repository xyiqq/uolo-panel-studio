/**
 * 交底包 ZIP（fflate，MIT）
 * 口径：条件性方案，非施工合格结论
 */

import { zipSync, strToU8 } from "fflate";

export function handoverReadme() {
  return [
    "配电工坊 · 施工交底包",
    "",
    "【重要口径】",
    "本包内容为「条件性方案，非施工合格结论」。",
    "图纸、标签、BOM 与检查单仅供设计沟通与现场辅助，",
    "不替代持证电工施工、送电试验与竣工验收。",
    "",
    "使用前请核对：方案版本、签认状态、现场供电与箱体实物。",
    "",
    "生成工具：配电工坊 Panel Studio",
  ].join("\n");
}

/**
 * @param {Record<string, Uint8Array|string>} files
 * @returns {Uint8Array}
 */
export function buildHandoverZip(files = {}) {
  const zipped = {};
  for (const [name, data] of Object.entries(files)) {
    if (data == null) continue;
    zipped[name] = typeof data === "string" ? strToU8(data) : data;
  }
  if (!zipped["README.txt"]) {
    zipped["README.txt"] = strToU8(handoverReadme());
  }
  return zipSync(zipped);
}
