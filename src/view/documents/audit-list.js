import { dash, esc, pageShell } from "./_util.js";
const levels = { error: '需要修正', warning: '注意核对', warn: '注意核对', pending: '资料待确认', info: '说明', success: '检查通过' };
export function renderAuditList({ issues } = {}) {
  const list = issues || [];
  const rows = list.map(it => {
    const level = it.level || it.severity || 'info';
    return `<tr class="issue-${esc(level)}"><td>${esc(levels[level] || '需要核对')}</td><td>${esc(dash(it.circuit || it.target))}<br><span class="muted">${esc(it.code || '')}</span></td><td>${esc(it.message || it.text || '请复核此项记录。')}</td></tr>`;
  }).join('');
  return pageShell('校核清单', list.length ? `<table class="doc-table"><thead><tr><th>处理类别</th><th>相关设备 / 查询代码</th><th>问题说明</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="doc-empty">当前无校核条目。这不表示现场已验收，也不代表所有资料均已核实。</p>', 'doc-audit-list',
    '先处理“需要修正”，再补齐“资料待确认”。查询代码用于与设计人员沟通；请保留问题说明并逐项复核。软件检查只覆盖已录入的信息。');
}
