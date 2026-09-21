import { describe, expect, it } from "vitest";
import { SMART_PRODUCTS } from "../../src/data/products/smart-index.js";

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

  it("不完整型号与 OEM 占位不可冒充已核官网型号", () => {
    for (const id of ["lutron-lqse-4a5-d", "lutron-qs-link-psu", "lutron-hqp7", "mdt-scn-dali64", "abb-dg-s", "lunatone-dali-ps", "tuya-relay-2ch"]) {
      expect(product(id).availability).toMatch(/待核/);
    }
  });
});
