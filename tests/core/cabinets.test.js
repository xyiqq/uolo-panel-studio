import { describe, it, expect } from "vitest";
import {
  createDefaultDesign,
  buildAssembly,
  validateDesign,
  resolveCabinet,
  validateCustomCabinet,
} from "../../src/core/domain.js";
import {
  GENERIC_CABINETS,
  makeGenericCabinet,
  allCabinets,
} from "../../src/data/cabinets/index.js";

describe("multi-size cabinets", () => {
  it("默认方案仍为 MH144，模位 108", () => {
    const design = createDefaultDesign();
    const assembly = buildAssembly(design);
    expect(design.cabinet).toBe("MH144");
    expect(resolveCabinet(design).id).toBe("MH144");
    expect(assembly.box.rows).toBe(6);
    expect(assembly.modules).toBe(108);
  });

  it("可切换到通用 GEN-2x24-D120-S 并通过校验", () => {
    const gen = GENERIC_CABINETS.find((c) => c.id === "GEN-2x24-D120-S");
    expect(gen).toBeTruthy();
    const design = createDefaultDesign();
    design.cabinet = gen.id;
    design.circuits.forEach((c) => (c.position = null));
    const validated = validateDesign(design);
    const assembly = buildAssembly(validated);
    expect(assembly.box.id).toBe("GEN-2x24-D120-S");
    expect(assembly.box.rows).toBe(2);
    expect(assembly.box.slots).toBe(24);
    expect(assembly.box.depth).toBe(120);
    expect(assembly.box.estimated).toBe(true);
    expect(assembly.nodes.some((n) => n.overflow)).toBe(true);
  });

  it("allCabinets 含玛德克 + 36 通用", () => {
    const list = allCabinets(createDefaultDesign());
    expect(GENERIC_CABINETS.length).toBe(36);
    expect(list.length).toBeGreaterThanOrEqual(39);
    expect(list.some((c) => c.id === "MH144")).toBe(true);
    expect(list.some((c) => c.id === "GEN-6x24-D150-S")).toBe(true);
  });

  it("自定义箱体可保存并装配", () => {
    const made = makeGenericCabinet(3, 12, 90, "明装");
    const custom = validateCustomCabinet({
      ...made,
      id: "USR-CAB-demo01",
      brand: "自定义",
      custom: true,
      name: "自定义 3×12P · 深90 · 明装",
    });
    const design = createDefaultDesign();
    design.customCabinets = [custom];
    design.cabinet = custom.id;
    design.circuits.forEach((c) => (c.position = null));
    const validated = validateDesign(design);
    const assembly = buildAssembly(validated);
    expect(assembly.box.id).toBe("USR-CAB-demo01");
    expect(assembly.box.rows).toBe(3);
    expect(assembly.box.slots).toBe(12);
    expect(allCabinets(validated).some((c) => c.id === "USR-CAB-demo01")).toBe(
      true
    );
  });
});
