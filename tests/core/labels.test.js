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

  it("面标模板对模块生效，端子标签仍用模块编号", () => {
    const node = { id: "K1", label: "客厅灯控", product: { kind: "relay" } };
    const smartNet = { nodes: [node], ports: { "K1:CH1_OUT": { id: "K1:CH1_OUT", node: "K1", key: "CH1_OUT" } }, wires: [] };
    const plain = applyLabelRules({ circuits: [] }, smartNet);
    expect(plain.faceLabel(node)).toBe("K1");
    const custom = applyLabelRules({ circuits: [], labelRules: { faceLabel: "{prefix}-{seq} {name}" } }, smartNet);
    expect(custom.faceLabel(node)).toBe("K-1 客厅灯控");
    expect(custom.terminalTag("K1:CH1_OUT")).toBe("K1.CH1_OUT");
  });
});
