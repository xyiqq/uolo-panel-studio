import { validateDesignV2 } from "./v2.js";
import { validateDesignV3 } from "./v3.js";

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_LABEL_RULES = {
  circuitTemplate: "{id}",
  faceTemplate: "{id} {name} {in}A",
  wireTemplate: "{circuit}-{conductor}",
  terminalPrefix: { N: "XN", PE: "XPE", load: "X" },
  qrMode: "offline",
};

export function migrateV2ToV3(v2raw) {
  const v2 = validateDesignV2(structuredClone(v2raw));
  const now = new Date().toISOString();
  const circuits = (v2.circuits || []).map((c) => {
    const devices = [];
    if (c.productId != null || c.productId === null) {
      devices.push({ role: "protection", productId: c.productId ?? null });
    } else {
      devices.push({ role: "protection", productId: null });
    }
    if (c.rcdProductId) devices.push({ role: "rcd", productId: c.rcdProductId });
    const { productId, rcdProductId, ...rest } = c;
    return { ...rest, devices };
  });

  const v3 = {
    ...v2,
    version: 3,
    revision: "smart",
    designId: v2.designId || uuid(),
    createdAt: v2.createdAt || now,
    updatedAt: now,
    revisions: [{ at: now, summary: "由 V4 方案迁移", errors: 0, pending: 0 }],
    signoff: {},
    publicBaseUrl: null,
    modules: structuredClone(v2.modules || []),
    buses: structuredClone(v2.buses || []),
    customCabinets: structuredClone(v2.customCabinets || []),
    spareRatio: 0.25,
    labelRules: DEFAULT_LABEL_RULES,
    circuits,
  };
  return validateDesignV3(v3);
}
