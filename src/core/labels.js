/**
 * 编号规则引擎
 * N 排 / PE 排 / 出箱端子按回路顺序连续编号；模块按 K/D/WH/GW/PS 前缀计数。
 */

const DEFAULT_CIRCUIT = "{id} {name}";
const DEFAULT_FACE = "{id}";
const DEFAULT_WIRE = "{circuit}-{conductor}";

/** A4 标签纸尺寸（mm）；预设使用明确的边距，打印时必须选择实际大小。 */
export function normalizeLabelSheet(value = {}) {
  const preset = ['module', 'a4-30', 'a4-48', 'custom'].includes(value?.preset) ? value.preset : 'module';
  const defaults = { rows: preset === 'a4-48' ? 12 : 10, columns: preset === 'a4-48' ? 4 : 3,
    marginTop: 8.5, marginBottom: 8.5, marginLeft: 7, marginRight: 7, gapX: 2, gapY: 0 };
  const result = { preset, ...defaults };
  if (preset === 'custom') {
    for (const key of Object.keys(defaults)) {
      const n = Number(value[key]);
      if (value[key] !== '' && value[key] != null && Number.isFinite(n)) result[key] = Math.max(0, n);
    }
    result.rows = Math.min(48, Math.max(1, Math.floor(result.rows)));
    result.columns = Math.min(12, Math.max(1, Math.floor(result.columns)));
  }
  result.widthMm = (210 - result.marginLeft - result.marginRight - (result.columns - 1) * result.gapX) / result.columns;
  result.heightMm = (297 - result.marginTop - result.marginBottom - (result.rows - 1) * result.gapY) / result.rows;
  if (result.widthMm < 5 || result.heightMm < 5) throw new RangeError('标签纸边距或间距过大，每格宽高至少需要 5 mm');
  result.capacity = result.rows * result.columns;
  return result;
}

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

  // 模块前缀计数；端子标签始终用节点 id，面标按模板渲染
  const moduleCounters = { K: 0, D: 0, WH: 0, GW: 0, PS: 0 };
  const moduleNodes = new Set();
  for (const node of [...(net?.nodes || []), ...(net?.assembly?.nodes || [])]) {
    if (moduleNodes.has(node.id)) continue;
    const prefix = modulePrefix(node.product?.kind);
    if (!prefix) continue;
    moduleNodes.add(node.id);
    moduleCounters[prefix] = (moduleCounters[prefix] || 0) + 1;
    nodeFace.set(node.id, tpl(faceTpl, { id: node.id, name: node.label || "", prefix, seq: moduleCounters[prefix] }));
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
    // 器件端子：节点 id.键
    const face = moduleNodes.has(p.node) ? p.node : nodeFace.get(p.node) || p.node;
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
