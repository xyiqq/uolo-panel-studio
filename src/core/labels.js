/**
 * 编号规则引擎
 * N 排 / PE 排 / 出箱端子按回路顺序连续编号；模块按 K/D/WH/GW/PS 前缀计数。
 */

const DEFAULT_CIRCUIT = "{id} {name}";
const DEFAULT_FACE = "{id}";
const DEFAULT_WIRE = "{circuit}-{conductor}";

function tpl(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : "",
  );
}

function circuitOrderIndex(design) {
  const map = new Map();
  (design.circuits || []).forEach((c, i) => map.set(c.id, i));
  return map;
}

function modulePrefix(kind) {
  switch (kind) {
    case "contactor":
      return "K";
    case "relay":
      return "K";
    case "dimmer":
      return "D";
    case "meter":
    case "kwh":
      return "WH";
    case "gateway":
      return "GW";
    case "psu":
      return "PS";
    default:
      return null;
  }
}

/**
 * @param {object} design
 * @param {object} net
 * @returns {{
 *   circuitLabel: (c: object) => string,
 *   faceLabel: (node: object) => string,
 *   wireTag: (wire: object) => string,
 *   terminalTag: (port: object|string) => string,
 *   wires: { id: string, fromTag: string, toTag: string }[],
 * }}
 */
export function applyLabelRules(design, net) {
  const rules = design?.labelRules || {};
  const circuitTpl = rules.circuitLabel || DEFAULT_CIRCUIT;
  const faceTpl = rules.faceLabel || DEFAULT_FACE;
  const wireTpl = rules.wireTag || DEFAULT_WIRE;

  const order = circuitOrderIndex(design);
  const portTags = new Map();
  const nodeFace = new Map();
  const wireTags = new Map();

  // 模块前缀计数
  const moduleCounters = { K: 0, D: 0, WH: 0, GW: 0, PS: 0 };
  for (const node of net?.nodes || net?.assembly?.nodes || []) {
    const prefix = modulePrefix(node.product?.kind);
    if (!prefix) continue;
    moduleCounters[prefix] = (moduleCounters[prefix] || 0) + 1;
    nodeFace.set(node.id, node.id);
  }
  // 装配节点也可能在 assembly.nodes
  for (const node of net?.assembly?.nodes || []) {
    if (nodeFace.has(node.id)) continue;
    const prefix = modulePrefix(node.product?.kind);
    if (!prefix) continue;
    moduleCounters[prefix] = (moduleCounters[prefix] || 0) + 1;
    nodeFace.set(node.id, node.id);
  }

  // 按回路顺序收集 N / PE / 出箱端子
  const circuits = [...(design.circuits || [])].sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );

  let xn = 0;
  let xpe = 0;
  let x = 0;

  const ports = net?.ports || {};

  for (const c of circuits) {
    // N 排：N:N-{circuitId}
    const nKey = `N:N-${c.id}`;
    if (ports[nKey]) {
      xn += 1;
      portTags.set(nKey, `XN:${xn}`);
    }
    // PE 排：PE:PE-{circuitId}
    const peKey = `PE:PE-${c.id}`;
    if (ports[peKey]) {
      xpe += 1;
      portTags.set(peKey, `XPE:${xpe}`);
    }
    // 出箱端子 X-{circuitId}:*
    const xPorts = Object.values(ports)
      .filter((p) => p.node === `X-${c.id}`)
      .sort((a, b) => String(a.key).localeCompare(String(b.key)));
    for (const p of xPorts) {
      x += 1;
      portTags.set(p.id, `X:${x}`);
    }
  }

  // 其余端口：稳定派生标签
  for (const p of Object.values(ports)) {
    if (portTags.has(p.id)) continue;
    if (p.node === "N" && p.key === "N") {
      portTags.set(p.id, "XN:0");
      continue;
    }
    if (p.node === "PE" && p.key === "PE") {
      portTags.set(p.id, "XPE:0");
      continue;
    }
    // 器件端子：节点面标.键
    const face = nodeFace.get(p.node) || p.node;
    portTags.set(p.id, p.displayTag || `${face}.${p.key}`);
  }

  // 回路保护节点面标
  for (const c of circuits) {
    if (!nodeFace.has(c.id)) {
      nodeFace.set(
        c.id,
        tpl(faceTpl, { id: c.id, name: c.name || "" }),
      );
    }
  }

  let wireSeq = 0;
  for (const w of net?.wires || []) {
    wireSeq += 1;
    const tag = w.wireNo || tpl(wireTpl, {
      id: w.id,
      circuit: w.circuit || "",
      conductor: w.conductor || "",
      section: w.section != null ? w.section : "",
      seq: String(wireSeq).padStart(3, "0"),
      scope: w.scope || "",
    }).replace(/^-|-$/g, "") || `W${String(wireSeq).padStart(3, "0")}`;
    wireTags.set(w.id, tag);
  }

  function circuitLabel(c) {
    if (!c) return "";
    return tpl(circuitTpl, { id: c.id, name: c.name || "", phase: c.phase || "" });
  }

  function faceLabel(node) {
    if (!node) return "";
    const id = typeof node === "string" ? node : node.id;
    if (nodeFace.has(id)) return nodeFace.get(id);
    if (typeof node === "object" && node.label) return String(node.label);
    return id || "";
  }

  function wireTag(wire) {
    if (!wire) return "";
    const id = typeof wire === "string" ? wire : wire.id;
    return wireTags.get(id) || "";
  }

  function terminalTag(port) {
    if (!port) return "";
    const id = typeof port === "string" ? port : port.id;
    return portTags.get(id) || id || "";
  }

  const wires = (net?.wires || []).map((w) => ({
    id: w.id,
    fromTag: terminalTag(w.from),
    toTag: terminalTag(w.to),
  }));

  // 写回（可变对象时）
  for (const w of net?.wires || []) {
    const row = wires.find((x) => x.id === w.id);
    if (!row) continue;
    w.fromTag = row.fromTag;
    w.toTag = row.toTag;
    w.tag = wireTag(w);
  }
  for (const p of Object.values(ports)) {
    p.tag = terminalTag(p);
  }

  return { circuitLabel, faceLabel, wireTag, terminalTag, wires };
}
