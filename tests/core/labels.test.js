import { describe, it, expect } from "vitest";
import {
  createDefaultDesign,
  buildAssembly,
  buildWiring,
} from "../../src/core/domain.js";
import { applyLabelRules } from "../../src/core/labels.js";

describe("labels · 编号规则", () => {
  const design = createDefaultDesign();
  const assembly = buildAssembly(design);
  const net = buildWiring(design, assembly);
  const labels = applyLabelRules(design, net);

  it("默认方案导线 tag 两端有值", () => {
    expect(labels.wires.length).toBe(net.wires.length);
    expect(labels.wires.length).toBeGreaterThan(0);
    for (const w of labels.wires) {
      expect(w.fromTag, `fromTag ${w.id}`).toBeTruthy();
      expect(w.toTag, `toTag ${w.id}`).toBeTruthy();
      expect(String(w.fromTag)).not.toMatch(/undefined/);
      expect(String(w.toTag)).not.toMatch(/undefined/);
    }
  });
});
