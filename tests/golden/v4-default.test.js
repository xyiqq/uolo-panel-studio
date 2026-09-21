import { describe, it, expect } from "vitest";
import {
  BUILTIN_PRODUCTS,
  createDefaultDesign,
  buildAssembly,
  buildWiring,
  simulate,
  auditDesign,
  auditWiring,
  matchCircuit,
} from "../../src/core/domain.js";

describe("V4 黄金基线（语义名）", () => {
  const design = createDefaultDesign();
  const assembly = buildAssembly(design);
  const net = buildWiring(design, assembly);
  const sim = simulate(net, design, { power: true, trip: null });
  const issues = [...auditDesign(design, assembly), ...auditWiring(net, design)];

  it("产品与源表规模", () => {
    expect(BUILTIN_PRODUCTS.length).toBe(34);
    const single16 = BUILTIN_PRODUCTS.find((p) => p.id === "A9F74116");
    expect(single16).toMatchObject({ brand: "Schneider Electric", kind: "mcb", poles: 1, protectedPoles: 1, amps: 16, modules: 1 });
    expect(design.loads.length).toBe(117);
    expect(design.circuits.length).toBe(44);
  });

  it("装配与模位", () => {
    expect(assembly.nodes.length).toBe(48);
    expect(assembly.modules).toBe(108);
    expect(assembly.box.rows * assembly.box.slots).toBe(144);
  });

  it("配线网", () => {
    expect(Object.keys(net.ports).length).toBe(496);
    expect(net.wires.length).toBe(248);
  });

  it("仿真与审计", () => {
    expect(sim.live).toBe(44);
    expect(issues.filter((i) => i.level === "error").length).toBe(0);
    expect(issues.filter((i) => i.level !== "error").length).toBe(56);
  });

  it("回路选型列表", () => {
    const list = design.circuits.map(
      (c) =>
        `${c.id} ${c.name} ${c.phase} ${matchCircuit(design, c).product.name}`,
    );
    expect(list).toEqual([
      "C01 公区照明 L1 iDPN N Vigi C10",
      "C02 弱电、网络与安防 L3 iDPN N Vigi C16",
      "C03 公区插座 L2 iDPN N Vigi C20",
      "C04 家影娱乐 L2 iDPN N Vigi C16",
      "C05 客厅空调（柜机） L3 iDPN N Vigi C20",
      "C06 电暖器/踢脚线取暖器 L2 iDPN N Vigi C16",
      "C07 餐厅空调（挂机） L3 iDPN N Vigi C16",
      "C08 厨卫照明 L2 iDPN N Vigi C10",
      "C09 台面插座 L1 iDPN N Vigi C16",
      "C10 厨房冰箱 L3 iDPN N Vigi C16",
      "C11 烟灶 L3 iDPN N Vigi C16",
      "C12 大功率 L1 iDPN N Vigi C16",
      "C13 烤箱独立 L2 iDPN N Vigi C20",
      "C14 普通插座 L2 iDPN N Vigi C16",
      "C15 厨房空调 L2 iDPN N Vigi C16",
      "C16 公卫插座 L2 iDPN N Vigi C16",
      "C17 智能马桶 L3 iDPN N Vigi C16",
      "C18 暖风机/浴霸 L1 iDPN N Vigi C16",
      "C19 主卧照明 L2 iDPN N Vigi C10",
      "C20 主卧插座 L1 iDPN N Vigi C16",
      "C21 主卧空调（挂机） L1 iDPN N Vigi C16",
      "C22 主卫插座 L2 iDPN N Vigi C16",
      "C23 智能马桶 L3 iDPN N Vigi C16",
      "C24 暖风机/浴霸 L1 iDPN N Vigi C16",
      "C25 客卧照明 L3 iDPN N Vigi C10",
      "C26 客卧插座 L1 iDPN N Vigi C16",
      "C27 次卧空调（挂机） L3 iDPN N Vigi C16",
      "C28 书房照明 L1 iDPN N Vigi C10",
      "C29 书房插座 L1 iDPN N Vigi C16",
      "C30 书房空调（挂机） L2 iDPN N Vigi C16",
      "C31 户外照明 L3 iDPN N Vigi C10",
      "C32 洗衣机 L1 iDPN N Vigi C16",
      "C33 烘干机 L3 iDPN N Vigi C16",
      "C34 阳台插座 L1 iDPN N Vigi C16",
      "C35 露台插座 L1 iDPN N Vigi C16",
      "C36 户外空调（外机） L3 iDPN N Vigi C20",
      "C37 壁挂锅炉/燃气热水器 L1 iDPN N Vigi C20",
      "C38 空气能热水器 L2 iDPN N Vigi C16",
      "C39 新风与温控 L1 iDPN N Vigi C16",
      "C40 中央空调室外机 ABC iC60N 4P C16",
      "C41 中央空调室内机 L2 iDPN N Vigi C16",
      "C42 水系统 L1 iDPN N Vigi C16",
      "C43 花园插座 L1 iDPN N Vigi C16",
      "C44 花园 L3 iDPN N Vigi C16",
    ]);
  });
});
