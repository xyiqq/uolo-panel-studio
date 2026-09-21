/**
 * UI 模式：simple（简易布置，默认）| full（完整工坊）
 * 存在 design.uiMode；缺省读 localStorage，再回落 simple。
 */

const STORAGE_KEY = "panel-studio-ui-mode";

export function normalizeUiMode(value) {
  return value === "full" ? "full" : "simple";
}

export function readStoredUiMode() {
  try {
    return normalizeUiMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "simple";
  }
}

export function writeStoredUiMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeUiMode(mode));
  } catch {
    /* ignore */
  }
}

/** @param {object} [design] */
export function getUiMode(design) {
  if (design && (design.uiMode === "simple" || design.uiMode === "full")) {
    return design.uiMode;
  }
  return readStoredUiMode();
}

/** @param {object} [design] */
export function isSimpleMode(design) {
  return getUiMode(design) === "simple";
}

/**
 * @param {object} design
 * @param {"simple"|"full"} mode
 */
export function setUiMode(design, mode) {
  const next = normalizeUiMode(mode);
  design.uiMode = next;
  writeStoredUiMode(next);
  return next;
}
