import { describe, it, expect } from "vitest";
import {
  createBlankDesign,
  createBreakerPackDesign,
  BUILTIN_DESIGN_TEMPLATES,
  materializeTemplate,
  snapshotDesignTemplate,
  slotsLengthHint,
} from "../../src/data/design-templates.js";
import { buildAssembly, createDefaultDesign } from "../../src/core/domain.js";

describe("design templates", () => {
  it("shows P length in mm", () => {
    expect(slotsLengthHint(24)).toContain("432 mm");
    expect(slotsLengthHint(12)).toContain("216 mm");
  });

  it("blank design has no branch breakers", () => {
    const blank = materializeTemplate(BUILTIN_DESIGN_TEMPLATES.find((t) => t.id === "blank"));
    expect(blank.circuits).toHaveLength(0);
    const asm = buildAssembly(blank);
    expect(asm.nodes.every((n) => n.role !== "branch")).toBe(true);
  });

  it("breaker pack templates use known RCBO", () => {
    const pack = materializeTemplate(BUILTIN_DESIGN_TEMPLATES.find((t) => t.id === "breakers-12"));
    expect(pack.circuits).toHaveLength(12);
    expect(pack.circuits.every((c) => c.productId === "A9D32616")).toBe(true);
  });

  it("full demo still matches createDefaultDesign", () => {
    const demo = materializeTemplate(BUILTIN_DESIGN_TEMPLATES.find((t) => t.id === "full-demo"));
    expect(demo.circuits.length).toBe(createDefaultDesign().circuits.length);
  });

  it("snapshots and rematerializes user templates", () => {
    const pack = createBreakerPackDesign({ count: 6, name: "六路" });
    const snap = snapshotDesignTemplate(pack, "测试模板");
    expect(snap.name).toBe("测试模板");
    expect(materializeTemplate(snap).circuits).toHaveLength(6);
  });

  it("createBlankDesign is empty by default", () => {
    const d = createBlankDesign();
    expect(d.circuits).toHaveLength(0);
    expect(d.loads).toHaveLength(0);
  });
});
