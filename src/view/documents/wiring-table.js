import { dash, esc, pageShell } from "./_util.js";
const wireClasses = { power: '电源线', control: '控制线', bus: '通信总线', comms: '通信总线', signal: '信号线', network: '网络线', dc: '直流电源线' };
const conductors = { L: '火线 L', L1: '火线 L1', L2: '火线 L2', L3: '火线 L3', N: '零线 N', PE: '保护地线 PE', 'DC+': '直流正极 DC+', 'DC-': '直流负极 / 0V（非零线 N）' };
export function renderWiringTable({ net, labels } = {}) {
  const rows = (net?.wires || []).map(w => {
    const from = labels?.terminalTag ? labels.terminalTag(w.from) : w.fromTag || w.from;
    const to = labels?.terminalTag ? labels.terminalTag(w.to) : w.toTag || w.to;
    const tag = labels?.wireTag ? labels.wireTag(w) : w.tag;
    const connected = w.connected === true ? '方案中已连接' : w.connected === false ? '方案中未连接' : '连接状态待确认';
    return `<tr>
      <td><strong>${esc(dash(tag))}</strong><br><span class="muted">编号：${esc(dash(w.id))}</span></td>
      <td>从：${esc(dash(from))}<br>到：${esc(dash(to))}</td>
      <td>${esc(conductors[w.conductor] || dash(w.conductor))}<br>${esc(wireClasses[w.class || 'power'] || w.class)}<br>截面积：${esc(dash(w.section))}${w.section != null && w.section !== "" && Number.isFinite(Number(w.section)) ? " mm²" : ""}</td>
      <td>${esc(dash(w.scope))}<br>回路：${esc(dash(w.circuit))}<br>${connected}</td>
    </tr>`;
  }).join('');
  const issues = net?.wiringIssues?.length ? `<p class="doc-guide">需要核对：${net.wiringIssues.map(i => esc(i.message || i.text)).join('<br>')}</p>` : '';
  return pageShell('接线表', issues + `<table class="doc-table"><thead><tr><th>导线标签 / 编号</th><th>连接位置</th><th>导线用途 / 粗细</th><th>所属位置 / 状态</th></tr></thead><tbody>${rows || '<tr><td colspan="4">暂无接线记录。配置设备与连接关系后生成。</td></tr>'}</tbody></table>`, 'doc-wiring-table',
    '按导线标签找到对应电线，再核对两端位置。号码管是套在电线上的编号标签；端子是电线的接入点。连接状态仅描述本方案，不代表现场已经接好或通过验收。');
}
