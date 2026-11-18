import { describe, expect, it } from "vitest";
import { SMART_PRODUCTS } from "../../src/data/products/smart-index.js";
import { computeBusBudgets } from "../../src/core/buses.js";
import { buildWiring, createDefaultDesign } from "../../src/core/domain.js";
import { normalizeModule } from "../../src/core/modules.js";
import { psuConnectionType } from "../../src/core/psu-connections.js";

const product = (id) => SMART_PRODUCTS.find((item) => item.id === id);

describe("官方目录参数回归", () => {
  it("Lutron 9M 模块不再套用 12M 外壳，电机控制器提供四路输出", () => {
    for (const suffix of ["4t10", "4s10", "2dal", "4m"]) {
      expect(product(`lutron-lqse-${suffix}-d`)).toMatchObject({
        modules: 9, width: 161.7, height: 89.7, depth: 60.6,
      });
    }
    expect(product("lutron-lqse-4m-d")).toMatchObject({ kind: "contactor", channels: 4 });
  });

  it("MDT 已核规格和电源类别保持一致", () => {
    for (const id of ["mdt-aks-0816-03", "mdt-akd-0401-02"]) {
      expect(product(id)).toMatchObject({ modules: 6, width: 108, depth: 65 });
    }
    expect(product("mdt-jal-0810-02")).toMatchObject({ channels: 8, width: 144, depth: 65, powerInput: "LN" });
    expect(product("mdt-stc-0640-01")).toMatchObject({ kind: "psu", powerInput: "LN", psuOutput: { voltage: 30, amps: 0.64 } });
    expect(product("mdt-scn-dali64").kind).toBe("gateway");
    expect(product("abb-dg-s").kind).toBe("gateway");
  });

  it("实际电源宽度用于导轨占位", () => {
    expect(product("meanwell-dlp-04r")).toMatchObject({ modules: 2, width: 35, protocol: ["dali"] });
    expect(product("tridonic-dali-ps2")).toMatchObject({ modules: 2, width: 36, height: 89.5, depth: 56.8 });
  });

  it("Lunatone 24033444 使用图纸外形和保证电流计算预算", () => {
    const psu = product("lunatone-dali-ps-24033444");
    expect(psu).toMatchObject({ sku: "24033444", modules: 1, width: 17.5, height: 98, depth: 56.4, powerInput: "LN" });
    expect(psu.psuOutput).toEqual({ milliamps: 200 });
    expect(psuConnectionType(psu)).toBe("dali");
    expect(psu.source.url).toContain("24033444_DALI_PS_EN_D0077.pdf");
    const device = { id: "fixture-dali-device", busConsumption: { value: 201, unit: "mA" } };
    const [budget] = computeBusBudgets({
      modules: [{ id: "PS1", productId: psu.id }, { id: "G1", productId: device.id }],
      buses: [{ id: "B1", type: "dali", psuModuleIds: ["PS1"], deviceModuleIds: ["G1"] }],
    }, [psu, device]);
    expect(budget).toMatchObject({ capacity: 200, used: 201, unit: "mA", overBudget: true });
  });

  it("ABB DG/S Premium 完整型号拒绝外接 DALI 电源", () => {
    const g1 = product("abb-dg-s-1-64-5-1");
    const g2 = product("abb-dg-s-2-64-5-1");
    expect(g1.sku).toBe("2CDG110273R0011");
    expect(g2.sku).toBe("2CDG110274R0011");
    for (const gateway of [g1, g2]) {
      expect(gateway).toMatchObject({
        kind: "gateway", modules: 4, width: 70, height: 90, depth: 63.5,
        powerInput: "LN", daliPowerSupply: "internal-only", psuOutput: null,
      });
      expect(psuConnectionType(gateway)).toBeNull();
    }
    const design = createDefaultDesign();
    design.modules = [
      normalizeModule({ id: "PS1", productId: "lunatone-dali-ps-24033444" }),
      normalizeModule({ id: "G1", productId: g1.id }),
      normalizeModule({ id: "G2", productId: g2.id }),
    ];
    design.buses = [{ id: "B1", type: "dali", section: 0.75, psuModuleIds: ["PS1"], deviceModuleIds: ["G1", "G2"] }];
    const wiring = buildWiring(design);
    const blocked = wiring.wiringIssues.filter(issue => issue.code === "DALI_INTERNAL_SUPPLY_CONFLICT");
    expect(blocked.map(issue => issue.moduleId)).toEqual(["G1", "G2"]);
    expect(wiring.wires.some(wire => wire.busId === "B1")).toBe(false);
  });

  it("不完整型号与 OEM 占位不可冒充已核官网型号", () => {
    for (const id of ["lutron-lqse-4a5-d", "lutron-qs-link-psu", "lutron-hqp7", "mdt-scn-dali64", "abb-dg-s", "lunatone-dali-ps", "tuya-relay-2ch"]) {
      expect(product(id).availability).toMatch(/待核/);
    }
    expect(product("lunatone-dali-ps")).toMatchObject({ width: 18, height: 90, depth: 58, psuOutput: null });
    expect(product("abb-dg-s")).toMatchObject({ width: 36, height: 90, depth: 64, psuOutput: null });
  });
});
