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
        message: `总线「${b.label || id}」功耗/电流超预算（${b.used}/${b.capacity} ${b.unit || ""}）`,
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
    if (b.type === "dali" && b.used != null && b.used > 250) {
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
    if (product && (product.width == null || !Number.isFinite(product.width))) {
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
    if (p && (p.width == null || !Number.isFinite(p.width))) {
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
  }

  return issues;
}
