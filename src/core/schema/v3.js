const REQUIRED = [
  "version",
  "revision",
  "designId",
  "name",
  "supply",
  "cabinet",
  "loads",
  "circuits",
  "modules",
  "buses",
  "spareRatio",
  "labelRules",
  "customCabinets",
];

export function validateDesignV3(raw) {
  if (!raw || typeof raw !== "object") throw new Error("方案不是对象");
  if (raw.version !== 3) throw new Error("version 必须为 3");
  if (raw.revision !== "smart") throw new Error('revision 必须为 "smart"');
  for (const k of REQUIRED) {
    if (!(k in raw)) throw new Error(`缺少字段：${k}`);
  }
  if (!Array.isArray(raw.circuits)) throw new Error("circuits 必须为数组");
  for (const c of raw.circuits) {
    if (!Array.isArray(c.devices)) throw new Error(`回路 ${c.id} 缺少 devices`);
  }
  if (!Array.isArray(raw.modules) || !Array.isArray(raw.buses)) {
    throw new Error("modules/buses 必须为数组");
  }
  return raw;
}
