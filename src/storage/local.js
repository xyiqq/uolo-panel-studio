/**
 * 本地存储适配：v4 → v5 key 迁移，多方案索引。
 */
const KEY_V4 = "panel-studio-v4";
const KEY_V5 = "panel-studio-v5";
const INDEX_KEY = "panel-studio-v5:index";

function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function migrateLocalV4IfNeeded() {
  const v4 = readJson(KEY_V4);
  if (!v4) return null;
  const index = readJson(INDEX_KEY, []);
  const id = v4.designId || "migrated-v4";
  if (!index.includes(id)) {
    writeJson(`${KEY_V5}:${id}`, { ...v4, designId: id });
    writeJson(INDEX_KEY, [id, ...index]);
  }
  return id;
}

export const localStorageAdapter = {
  async list() {
    migrateLocalV4IfNeeded();
    return readJson(INDEX_KEY, []);
  },
  async load(id) {
    migrateLocalV4IfNeeded();
    if (!id) {
      const ids = readJson(INDEX_KEY, []);
      id = ids[0];
    }
    if (!id) return readJson(KEY_V4);
    return readJson(`${KEY_V5}:${id}`) || readJson(KEY_V4);
  },
  async save(design) {
    const id = design.designId || crypto.randomUUID();
    design.designId = id;
    design.updatedAt = new Date().toISOString();
    writeJson(`${KEY_V5}:${id}`, design);
    writeJson(KEY_V5, design); // 当前活动方案
    const index = readJson(INDEX_KEY, []);
    if (!index.includes(id)) writeJson(INDEX_KEY, [id, ...index]);
    return id;
  },
  async remove(id) {
    localStorage.removeItem(`${KEY_V5}:${id}`);
    writeJson(
      INDEX_KEY,
      readJson(INDEX_KEY, []).filter((x) => x !== id)
    );
  },
};

/** 占位：无后端时禁用 */
export const restStorageAdapter = {
  async list() {
    throw new Error("REST 存储未启用");
  },
  async load() {
    throw new Error("REST 存储未启用");
  },
  async save() {
    throw new Error("REST 存储未启用");
  },
  async remove() {
    throw new Error("REST 存储未启用");
  },
};
