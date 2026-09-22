import { describe, it, expect } from "vitest";
import { SMART_PRODUCTS } from "../../src/data/products/smart-index.js";
import { VERIFIED_DIM } from "../../src/data/products/_smart-factory.js";
import { smartFaceSvg, isSmartVisual } from "../../src/view/smart-device3d.js";
import { validateCustomProduct } from "../../src/core/domain.js";
import {
  DIN_SIZE_TEMPLATES,
  autoCustomName,
} from "../../src/data/products/custom-templates.js";

describe("smart products catalog", () => {
  it("全部智能模块具备可上架外形（有 modules/width）", () => {
    expect(SMART_PRODUCTS.length).toBeGreaterThan(20);
    for (const p of SMART_PRODUCTS) {
      expect(p.source?.file).toBeTruthy();
      expect(p.modules).toBeGreaterThan(0);
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.depth).toBeGreaterThan(0);
      expect(p.availability).toBeTruthy();
      if (p.availability === VERIFIED_DIM) expect(p.source.url).toMatch(/^https:\/\//);
      expect(isSmartVisual(p)).toBe(true);
      expect(p.amps == null || Number.isFinite(p.amps)).toBe(true);
    }
    const dali = SMART_PRODUCTS.find((p) => p.id === "crestron-din-dali-2");
    expect(dali.modules).toBe(9);
    expect(dali.width).toBe(159);
    const dli = SMART_PRODUCTS.find((p) => p.id === "crestron-din-dli");
    expect(dli.modules).toBe(3);
    expect(dli.width).toBe(52.83);
    expect(dli.height).toBe(93.7);
    expect(dli.depth).toBe(59);
  });

  it("智能面板 SVG 可生成", () => {
    const p = SMART_PRODUCTS[0];
    const svg = smartFaceSvg(p);
    expect(svg).toContain("<svg");
    expect(svg).toContain(p.name);
  });

  it("自定义 DIN 尺寸模板可生成智能模块", () => {
    expect(DIN_SIZE_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    const tpl = DIN_SIZE_TEMPLATES.find((t) => t.id === "din-3m");
    const name = autoCustomName("Acme", "CTL-3");
    expect(name).toBe("Acme CTL-3");
    const p = validateCustomProduct({
      id: "USR-acme-ctl3",
      brand: "Acme",
      name,
      sku: "CTL-3",
      kind: "gateway",
      poles: 2,
      amps: null,
      width: tpl.width,
      height: tpl.height,
      depth: tpl.depth,
      minWire: 1,
      maxWire: 16,
      neutralSide: "left",
      protectedPoles: 0,
      residual: 30,
      rcdType: "A",
      icn: null,
      backup: 40,
      protocol: "din",
      sourceURL: "",
    });
    expect(p.smart).toBe(true);
    expect(p.modules).toBe(3);
    expect(isSmartVisual(p)).toBe(true);
  });
});
