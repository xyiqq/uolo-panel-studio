/**
 * 智能模块 / 总线 / 空间相关审计。
 * 约定签名：auditSmart(design, assembly, budgets)
 */

import { computeSpace } from "../space.js";

/**
 * @param {object} design
 * @param {object} assembly
 * @param {object[]} budgets computeBusBudgets 结果
 * @param {{ cabinets?: object[], products?: object[]|Map }} [opts]
 */
export function auditSmart(design, assembly, budgets = [], opts = {}) {
  /** @type {{ code: string, level: string, message: string, ref?: string }[]} */
  const issues = [];

  for (const b of budgets || []) {
    const id = b.busId || b.id;
    if (!b.hasPsu) {
      issues.push({
        code: "BUS_NO_PSU",
        level: "error",
        message: `总线「${b.label || id}」未配置电源模块`,
        ref: id,
      });
    }
    const overBudget =
      b.overBudget === true ||
      (b.capacity != null &&
        b.used != null &&
        Number.isFinite(b.capacity) &&
        Number.isFinite(b.used) &&
        b.used > b.capacity);
    if (overBudget) {
      issues.push({
        code: "BUS_BUDGET",
        level: "error",
        message: `总线「${b.label || id}」功耗/电流超预算（${b.used == null ? '至少 ' : ''}${b.used ?? b.knownUsed}/${b.capacity} ${b.unit || ""}）`,
        ref: id,
      });
    }
    const overDevices =
      b.overDevices === true ||
      (b.maxDevices != null && b.deviceCount > b.maxDevices);
    if (overDevices) {
      issues.push({
        code: "BUS_DEVICE_LIMIT",
        level: "error",
        message: `总线「${b.label || id}」设备数 ${b.deviceCount} 超过上限 ${b.maxDevices}`,
        ref: id,
      });
    }
    if (b.type === "dali" && b.unit === "mA" && b.used != null && b.used > 250) {
      issues.push({
        code: "DALI_BUS_CURRENT",
        level: "error",
        message: `DALI 总线「${b.label || id}」电流 ${b.used} mA 超过 250 mA 上限`,
        ref: id,
      });
    }
  }

  for (const node of assembly?.nodes || []) {
    const product = node.product;
    if (product && (product.width == null || !Number.isFinite(product.width) || product.width <= 0)) {
      issues.push({
        code: "PRODUCT_WIDTH_UNKNOWN",
        level: "error",
        message: `产品「${product.name || product.id}」宽度未知，不参与空间计算`,
        ref: node.id,
      });
    }
  }

  const productsOpt = opts.products;
  let productList = [];
  if (productsOpt instanceof Map) productList = [...productsOpt.values()];
  else if (Array.isArray(productsOpt)) productList = productsOpt;

  const byId = new Map(productList.map((p) => [p.id, p]));
  for (const mod of design?.modules || []) {
    const p = byId.get(mod.productId);
    if (p && (p.width == null || !Number.isFinite(p.width) || p.width <= 0)) {
      if (!issues.some((i) => i.code === "PRODUCT_WIDTH_UNKNOWN" && i.ref === mod.id)) {
        issues.push({
          code: "PRODUCT_WIDTH_UNKNOWN",
          level: "error",
          message: `模块「${mod.label || mod.id}」产品宽度未知，不参与空间计算`,
          ref: mod.id,
        });
      }
    }
  }

  const box = assembly?.box;
  const cabinets = opts.cabinets || (box ? [box] : []);
  if (cabinets.length || box) {
    const space = computeSpace(design, assembly, cabinets.length ? cabinets : box ? [box] : []);
    const current = box || cabinets.find((c) => c.id === design?.cabinet);
    if (current && Number.isFinite(current.rows) && current.rows < space.rowsNeeded) {
      issues.push({
        code: "SPACE_ROWS",
        level: "error",
        message: `当前箱体 ${current.rows} 排不足，按备用比例需 ${space.rowsNeeded} 排`,
        ref: current.id || design?.cabinet,
      });
    }
    const cabinet = space.currentFit.cabinet;
    for (const node of assembly?.nodes || []) {
      const p = node.product || {};
      const label = `${node.id}（${p.name || p.id || '器件'}）`;
      const add = (code, level, message) => issues.push({code, level, ref:node.id, message});
      if (!(Number.isFinite(p.height) && p.height > 0)) {
        add('PRODUCT_HEIGHT_UNKNOWN', 'pending', `${label} 高度待核，不能确认排间净空`);
      } else if ((!p.outletCount || p.pduOrientation !== 'vertical') && p.height > cabinet.rowClearance) {
        add('SPACE_HEIGHT', 'error', `${label} 高 ${p.height} mm，超过当前箱体排间净空 ${cabinet.rowClearance} mm（按已录入尺寸估算，请核对实物）`);
      } else if (p.outletCount && p.pduOrientation === 'vertical' && Math.ceil(p.height/cabinet.pitch) > cabinet.rows) {
        add('SPACE_HEIGHT', 'error', `${label} 按排距估算需 ${Math.ceil(p.height/cabinet.pitch)} 排，超过当前箱体 ${cabinet.rows} 排`);
      }
      if (!(Number.isFinite(p.depth) && p.depth > 0)) {
        add('PRODUCT_DEPTH_UNKNOWN', 'pending', `${label} 深度待核，不能确认箱门及接线净空`);
      } else if (p.depth > cabinet.maxDeviceDepth) {
        add('SPACE_DEPTH', 'error', `${label} 深 ${p.depth} mm，超过当前可用器件深度 ${cabinet.maxDeviceDepth} mm（估算，需核对导轨、箱门及线缆弯曲空间）`);
      }
      if (Number.isFinite(p.width) && p.width > cabinet.slots*cabinet.slotWidth) {
        add('SPACE_WIDTH', 'error', `${label} 宽 ${p.width} mm，超过当前单排 ${cabinet.slots*cabinet.slotWidth} mm，增加排数不能解决`);
      }
      if (!Number.isFinite(p.heatW) || p.heatW < 0) {
        add('PRODUCT_HEAT_UNKNOWN', 'pending', `${label} 发热功率待核，未将负载功率或额定功率当作器件热耗`);
      }
    }
    if ((assembly?.nodes || []).length) issues.push({
      code:'SPACE_THERMAL_REVIEW', level:'pending', ref:current?.id || design?.cabinet,
      message:`已知器件热耗合计 ${space.heatW} W${space.heatUnknown ? `，另有 ${space.heatUnknown} 个器件热耗待核` : ''}；环境温度、箱体散热能力、通风和厂家间距尚未校核，不能据模位余量判定温升合格`,
    });
  }

  return issues;
}
