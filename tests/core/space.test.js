import { describe, it, expect } from "vitest";
import { createDefaultDesign, buildAssembly } from "../../src/core/domain.js";
import { computeSpace } from "../../src/core/space.js";
import { allCabinets } from "../../src/data/cabinets/index.js";

describe("computeSpace", () => {
  it("默认方案 modulesPower=108，spare0.25 → rowsNeeded=6", () => {
    const design = { ...createDefaultDesign(), spareRatio: 0.25 };
    const assembly = buildAssembly(design);
    const space = computeSpace(design, assembly, allCabinets(design));

    expect(assembly.modules).toBe(108);
    expect(space.modulesPower).toBe(108);
    expect(space.modulesControl).toBe(0);
    expect(space.unknownWidth).toBe(0);
    expect(space.rowsNeeded).toBe(6); // ceil(108*1.25/24)=ceil(135/24)=6
    expect(space.rowsPower).toBe(6);
    expect(space.rowsControl).toBe(0);
  });

  it("加入 8M 控制模块后 rowsControl=1", () => {
    const design = { ...createDefaultDesign(), spareRatio: 0.25 };
    const assembly = buildAssembly(design);
    const withControl = {
      ...assembly,
      nodes: [
        ...assembly.nodes,
        {
          id: "K1",
          zone: "control",
          product: {
            id: "demo-relay",
            name: "演示 8M 继电器",
            kind: "relay",
            zone: "control",
            width: 144,
            modules: 8,
            height: 90,
            depth: 60,
          },
        },
      ],
    };
    const space = computeSpace(design, withControl, allCabinets(design));
    expect(space.modulesControl).toBe(8);
    expect(space.rowsControl).toBe(1); // ceil(8*1.25/24)=1
    expect(space.rowsNeeded).toBe(7);
  });

  it("width 为 null 计入 unknownWidth 且不计入模位", () => {
    const design = { ...createDefaultDesign(), spareRatio: 0.25 };
    const assembly = buildAssembly(design);
    const withUnknown = {
      ...assembly,
      nodes: [
        ...assembly.nodes,
        {
          id: "U1",
          zone: "control",
          product: {
            id: "unknown",
            name: "宽度待录",
            kind: "relay",
            zone: "control",
            width: null,
            modules: null,
            availability: "参数待核",
          },
        },
      ],
    };
    const space = computeSpace(design, withUnknown, []);
    expect(space.unknownWidth).toBe(1);
    expect(space.modulesControl).toBe(0);
  });
});
