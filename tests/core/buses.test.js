import { describe, it, expect } from "vitest";
import { computeBusBudgets } from "../../src/core/buses.js";
import { auditSmart } from "../../src/core/audit/smart.js";

function makeKnxFixture({ deviceCount, withPsu, usedEach = 12, psuMa = 640 }) {
  const products = [];
  const modules = [];
  const deviceModuleIds = [];

  if (withPsu) {
    products.push({
      id: "knx-psu",
      kind: "psu",
      name: "测试 KNX 电源",
      psuOutput: { type: "knx", voltage: 30, milliamps: psuMa },
      busConsumption: null,
      width: 72,
    });
    modules.push({
      id: "PS1",
      productId: "knx-psu",
      label: "PS1",
      busId: "B-KNX",
      feed: "none",
      feedCircuitId: null,
      channels: {},
      position: null,
    });
  }

  for (let i = 0; i < deviceCount; i++) {
    const id = `D${i + 1}`;
    const pid = `dev-${i + 1}`;
    products.push({
      id: pid,
      kind: "relay",
      name: `KNX 设备 ${i + 1}`,
      busConsumption: { unit: "mA", value: usedEach },
      width: null,
      availability: "参数待核",
    });
    modules.push({
      id,
      productId: pid,
      label: id,
      busId: "B-KNX",
      feed: "none",
      feedCircuitId: null,
      channels: {},
      position: null,
    });
    deviceModuleIds.push(id);
  }

  const design = {
    spareRatio: 0.25,
    modules,
    buses: [
      {
        id: "B-KNX",
        type: "knx",
        label: "KNX 主线",
        psuModuleIds: withPsu ? ["PS1"] : [],
        deviceModuleIds,
        voltage: 30,
        budgetUnit: "mA",
        capacity: null,
        maxDevices: 64,
        segregation: "SELV",
      },
    ],
  };

  return { design, products };
}

describe("buses + auditSmart", () => {
  it("无电源触发 BUS_NO_PSU", () => {
    const { design, products } = makeKnxFixture({ deviceCount: 2, withPsu: false });
    const budgets = computeBusBudgets(design, products);
    expect(budgets[0].hasPsu).toBe(false);
    const issues = auditSmart(design, { nodes: [], box: null }, budgets, { products });
    expect(issues.some((i) => i.code === "BUS_NO_PSU")).toBe(true);
  });

  it("70 台设备触发 BUS_DEVICE_LIMIT", () => {
    const { design, products } = makeKnxFixture({ deviceCount: 70, withPsu: true });
    const budgets = computeBusBudgets(design, products);
    expect(budgets[0].deviceCount).toBe(70);
    expect(budgets[0].maxDevices).toBe(64);
    const issues = auditSmart(design, { nodes: [], box: null }, budgets, { products });
    expect(issues.some((i) => i.code === "BUS_DEVICE_LIMIT")).toBe(true);
  });

  it("消费超过容量触发 BUS_BUDGET", () => {
    const { design, products } = makeKnxFixture({
      deviceCount: 10,
      withPsu: true,
      usedEach: 100,
      psuMa: 200,
    });
    const budgets = computeBusBudgets(design, products);
    expect(budgets[0].capacity).toBe(200);
    expect(budgets[0].used).toBe(1000);
    const issues = auditSmart(design, { nodes: [], box: null }, budgets);
    expect(issues.some((i) => i.code === "BUS_BUDGET")).toBe(true);
  });

  it("DALI capacity 上限 min(cap,250)", () => {
    const products = [
      {
        id: "dali-ps",
        kind: "psu",
        psuOutput: { type: "dali", milliamps: 400 },
      },
    ];
    const design = {
      modules: [
        {
          id: "PS1",
          productId: "dali-ps",
          label: "PS1",
          busId: "B-DALI",
          feed: "none",
          feedCircuitId: null,
          channels: {},
          position: null,
        },
      ],
      buses: [
        {
          id: "B-DALI",
          type: "dali",
          label: "DALI",
          psuModuleIds: ["PS1"],
          deviceModuleIds: [],
          budgetUnit: "mA",
          capacity: null,
          maxDevices: null,
          segregation: "FELV",
        },
      ],
    };
    const budgets = computeBusBudgets(design, products);
    expect(budgets[0].capacity).toBe(250);
    expect(budgets[0].maxDevices).toBe(64);
  });

  it("宽度未知触发 PRODUCT_WIDTH_UNKNOWN", () => {
    const { design, products } = makeKnxFixture({ deviceCount: 1, withPsu: true });
    const budgets = computeBusBudgets(design, products);
    const issues = auditSmart(design, { nodes: [], box: null }, budgets, { products });
    expect(issues.some((i) => i.code === "PRODUCT_WIDTH_UNKNOWN")).toBe(true);
  });
});
