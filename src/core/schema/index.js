import { validateDesignV2 } from "./v2.js";
import { validateDesignV3 } from "./v3.js";
import { migrateV2ToV3 } from "./migrate.js";

/**
 * @param {unknown} raw
 * @returns {object} DesignV3
 */
export function loadDesign(raw) {
  if (!raw || typeof raw !== "object") throw new Error("无效方案");
  if (raw.version === 3) return validateDesignV3(structuredClone(raw));
  if (raw.version === 2) return migrateV2ToV3(raw);
  throw new Error(`不支持的方案版本：${raw.version}`);
}

export { validateDesignV2, validateDesignV3, migrateV2ToV3 };
export { validateDesign } from "../domain.js";

