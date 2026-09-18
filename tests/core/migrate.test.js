import { describe, it, expect } from "vitest";
import { createDefaultDesign } from "../../src/core/domain.js";
import {
  loadDesign,
  migrateV2ToV3,
  validateDesignV3,
} from "../../src/core/schema/index.js";

describe("migrate V2 → V3", () => {
  it("createDefaultDesign 迁移后通过 validateDesignV3", () => {
    const v2 = createDefaultDesign();
    const v3 = migrateV2ToV3(v2);
    expect(v3.version).toBe(3);
    expect(v3.revision).toBe("smart");
    expect(v3.designId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(v3.modules).toEqual([]);
    expect(v3.buses).toEqual([]);
    expect(v3.customCabinets).toEqual([]);
    expect(v3.spareRatio).toBe(0.25);
    expect(v3.publicBaseUrl).toBeNull();
    expect(v3.signoff).toEqual({});
    expect(v3.labelRules.circuitTemplate).toBe("{id}");
    expect(v3.circuits.length).toBe(v2.circuits.length);
    for (const c of v3.circuits) {
      expect(Array.isArray(c.devices)).toBe(true);
      expect(c.devices[0]).toEqual({ role: "protection", productId: null });
      expect(c.productId).toBeUndefined();
      expect(c.rcdProductId).toBeUndefined();
    }
    expect(() => validateDesignV3(v3)).not.toThrow();
  });

  it("loadDesign 识别 v2 并迁移", () => {
    const v3 = loadDesign(createDefaultDesign());
    expect(v3.version).toBe(3);
  });

  it("loadDesign 直接校验 v3", () => {
    const v3 = migrateV2ToV3(createDefaultDesign());
    expect(loadDesign(v3).designId).toBe(v3.designId);
  });

  it("缺必填字段抛错", () => {
    const v3 = migrateV2ToV3(createDefaultDesign());
    const { designId: _d, ...noId } = v3;
    expect(() => validateDesignV3(noId)).toThrow(/designId/);
    const { modules: _m, ...noModules } = v3;
    expect(() => validateDesignV3(noModules)).toThrow(/modules/);
    const badCircuit = {
      ...v3,
      circuits: v3.circuits.map((c, i) =>
        i === 0 ? { ...c, devices: undefined } : c,
      ),
    };
    expect(() => validateDesignV3(badCircuit)).toThrow(/devices/);
  });

  it("不支持的版本抛错", () => {
    expect(() => loadDesign({ version: 1 })).toThrow(/不支持/);
  });
});
