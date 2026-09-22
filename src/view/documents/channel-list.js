import { esc, pageShell } from "./_util.js";
import { buildChannelRows } from "../../core/modules.js";
export function renderChannelList({ design, findProduct } = {}) {
  const rows = buildChannelRows(design || {}, findProduct || null).map(r => `<tr>
    <td><strong>${esc(r.moduleId)}</strong><br>${esc(r.moduleLabel)}<br><span class="muted">${esc(r.productName)}</span></td>
    <td>${r.channel === '' ? '—' : `CH${esc(r.channel)}`}<br>${esc(r.label || '未填写用途')}</td>
    <td>${esc(r.terminal || '未指定')}</td>
    <td>断路器：${esc(r.breaker || '未指定')}<br>漏电保护器：${esc(r.rcd || '未指定')}</td>
  </tr>`).join('');
  return pageShell('通道清单', `<table class="doc-table"><thead><tr><th>设备 / 型号</th><th>通道 / 控制用途</th><th>接线端子编号</th><th>共用保护设备</th></tr></thead><tbody>${rows || '<tr><td colspan="4">暂无模块。添加智能控制设备后显示各路用途。</td></tr>'}</tbody></table>`, 'doc-channel-list',
    '通道是设备的一路控制输出，CH 后的数字是通道号。备注说明它控制的灯具或设备；接线端子编号用于现场查找。断路器（空开）与漏电保护器（漏保）列为方案关联，未指定不等于不需要保护。');
}
