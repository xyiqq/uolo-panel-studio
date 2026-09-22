/**
 * 按 kind 生成端子模板（P1-2）。
 */
export function dcInputVoltage(product) {
  const input = String(product?.powerInput || '').replace(/\s/g, '');
  const match = /^(?:(12|24)VDC|DC(12|24))(?:-or-poe)?$/i.exec(input);
  return match ? Number(match[1] || match[2]) : null;
}

/** Load contacts remain separate from the controller's low-voltage supply. */
export function loadPowerInput(product) {
  return product?.loadPowerInput ?? product?.powerInput;
}

export function acceptsExternalDaliPower(product) {
  return !['internal-only', 'switchable'].includes(product?.daliPowerSupply);
}

export function buildPortTemplates(product) {
  const kind = product?.kind;
  const ports = [];
  const add = (key, conductor, side, io, channel) => {
    ports.push({ key, conductor, side, io, ...(channel != null ? { channel } : {}) });
  };
  // RJ45 不作为强电/KNX 总线端子，避免把交换机自动接入电气网络。
  if (product?.networkPorts) return ports;

  if (["mcb", "rcbo", "rccb", "spd", "isolator", "changeover"].includes(kind)) {
    const poles = product.poles || 1;
    const labels =
      poles === 1
        ? ["L"]
        : poles === 2
          ? ["L", "N"]
          : poles === 3
            ? ["L1", "L2", "L3"]
            : ["L1", "L2", "L3", "N"];
    for (const cond of labels) {
      const c = cond.startsWith("L") ? "L" : cond;
      add(`${cond}_IN`, c === "L" ? "L" : cond, "top", "in");
      add(`${cond}_OUT`, c === "L" ? "L" : cond, "bottom", "out");
    }
    return ports;
  }

  if (["relay", "dimmer", "contactor", "timer"].includes(kind)) {
    if (dcInputVoltage(product)) {
      add("DC+", "DC+", "top", "in");
      add("DC-", "DC-", "top", "in");
    }
    add("L_IN", "L", "top", "in");
    if(product.id !== 'crestron-din-8sw8-i') add("N_IN", "N", "top", "in");
    const ch = product.channels || 1;
    for (let i = 1; i <= ch; i++) {
      add(`CH${i}_IN`, "L", "top", "in", i);
      add(`CH${i}_OUT`, "OUT", "bottom", "out", i);
    }
    if (product.protocol?.some((p) => ["knx", "cresnet", "qslink", "dali"].includes(p)) || product.powerInput === "bus") {
      add("BUS+", "BUS+", "top", "both");
      add("BUS-", "BUS-", "top", "both");
    }
    return ports;
  }

  if (kind === "psu") {
    add("L_IN", "L", "top", "in");
    add("N_IN", "N", "top", "in");
    if (product.protocol?.some((p) => ["dali", "knx"].includes(p))) {
      add("BUS+", "BUS+", "bottom", "out");
      add("BUS-", "BUS-", "bottom", "out");
    } else {
      add("DC+", "DC+", "bottom", "out");
      add("DC-", "DC-", "bottom", "out");
    }
    return ports;
  }

  if (kind === "gateway") {
    if (dcInputVoltage(product)) {
      add("DC+", "DC+", "top", "in");
      add("DC-", "DC-", "top", "in");
    }
    if (product.powerInput === "LN") {
      add("L_IN", "L", "top", "in");
      add("N_IN", "N", "top", "in");
    }
    add("BUS+", "BUS+", "bottom", "both");
    add("BUS-", "BUS-", "bottom", "both");
    return ports;
  }

  if (kind === "meter") {
    add("L_IN", "L", "top", "in");
    add("L_OUT", "L", "bottom", "out");
    add("N_IN", "N", "top", "in");
    add("N_OUT", "N", "bottom", "out");
    add("A", "A", "bottom", "both");
    add("B", "B", "bottom", "both");
    return ports;
  }

  if (kind === "terminal") {
    const cond = product.conductor === "N" ? "N" : "L";
    const poles = Math.max(1, Number(product.poles) || Number(product.channels) || 1);
    for (let i = 1; i <= poles; i++) {
      const suffix = poles > 1 ? String(i) : "";
      add(`FIELD${suffix}`, cond, "top", "in", poles > 1 ? i : undefined);
      add(`PANEL${suffix}`, cond, "bottom", "out", poles > 1 ? i : undefined);
    }
    return ports;
  }

  return ports;
}
