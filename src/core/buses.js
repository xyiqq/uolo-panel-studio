/**
 * 总线预算（计划 P1-8）。
 * capacity / used 未知时保持 null，不编造数值。
 */

/**
 * @param {object} design
 * @param {object[]|Map<string,object>} products 产品目录或 id→产品 Map
 */
export function computeBusBudgets(design, products = []) {
  /** @type {Map<string, object>} */
  let byId;
  if (products instanceof Map) {
    byId = products;
  } else if (Array.isArray(products)) {
    byId = new Map(products.map((p) => [p.id, p]));
  } else if (products && typeof products === "object") {
    byId = new Map(Object.entries(products));
  } else {
    byId = new Map();
  }

  const modules = design?.modules || [];
  const moduleById = new Map(modules.map((m) => [m.id, m]));

  function resolveProduct(moduleId) {
    const mod = moduleById.get(moduleId);
    if (!mod) return null;
    return byId.get(mod.productId) || null;
  }

  return (design?.buses || []).map((bus) => {
    const psuProducts = (bus.psuModuleIds || [])
      .map(resolveProduct)
      .filter(Boolean);
    const deviceProducts = (bus.deviceModuleIds || [])
      .map(resolveProduct)
      .filter(Boolean);

    let unit = bus.budgetUnit || null;
    let capacity = bus.capacity;
    let used = null;
    let capacityKnown = true;
    let usedKnown = true;

    if (capacity == null) {
      let sum = 0;
      let any = false;
      let inferredUnit = unit;
      for (const p of psuProducts) {
        const out = p.psuOutput;
        if (!out) {
          capacityKnown = false;
          continue;
        }
        any = true;
        if (out.milliamps != null) {
          inferredUnit = "mA";
          sum += out.milliamps;
        } else if (out.watts != null) {
          inferredUnit = "W";
          sum += out.watts;
        } else if (out.amps != null && out.voltage != null) {
          inferredUnit = "W";
          sum += out.amps * out.voltage;
        } else {
          capacityKnown = false;
        }
      }
      unit = inferredUnit || unit;
      capacity = any ? sum : null;
      if (!any) capacityKnown = true;
    }

    {
      let sum = 0;
      let any = false;
      for (const p of deviceProducts) {
        const c = p.busConsumption;
        if (!c || c.value == null) {
          usedKnown = false;
          continue;
        }
        any = true;
        sum += c.value;
        unit = unit || c.unit;
      }
      used = any ? sum : null;
      if (!any) usedKnown = true;
    }

    if (bus.type === "dali" && capacity != null) {
      capacity = Math.min(capacity, 250);
    }

    let maxDevices = bus.maxDevices;
    if (maxDevices == null && (bus.type === "knx" || bus.type === "dali")) {
      maxDevices = 64;
    }

    const deviceCount = (bus.deviceModuleIds || []).length;
    const hasPsu = (bus.psuModuleIds || []).length > 0;
    const overBudget =
      capacity != null && used != null && Number.isFinite(capacity) && Number.isFinite(used) && used > capacity;
    const overDevices = maxDevices != null && deviceCount > maxDevices;

    return {
      id: bus.id,
      busId: bus.id,
      type: bus.type,
      label: bus.label,
      unit,
      capacity,
      used,
      capacityKnown,
      usedKnown,
      maxDevices,
      deviceCount,
      hasPsu,
      psuCount: (bus.psuModuleIds || []).length,
      overBudget,
      overDevices,
    };
  });
}
