import { esc, pageShell } from './_util.js';
import {buildBomDelivery} from '../../core/bom-delivery.js';

/** Delivery BOM deliberately omits model catalog parameters. */
export function renderBomPage({bom,assembly,design}={}) {
  const view=buildBomDelivery(bom,{assembly,design});
  const rows=items=>items.map(item=>`<tr><td>${esc(item.name)}</td><td>${esc(item.qty??'待核')}</td><td>${esc(item.unit)}</td><td>${esc(item.location)}</td></tr>`).join('')||'<tr><td colspan="4">无</td></tr>';
  const table=(items,estimated=false)=>`<table class="doc-table"><thead><tr><th>通用名称</th><th>${estimated?'估算数量':'数量'}</th><th>单位</th><th>用途 / 位置${estimated?' / 待核事项':''}</th></tr></thead><tbody>${rows(items)}</tbody></table>`;
  return pageShell('物料清单 BOM',
    `<p class="hint">${esc(view.note)}</p>`+
    `<section><h2>设备与附件 · 按布置统计</h2>${table(view.items)}</section>`+
    `<section><h2>线材 · 估算待核</h2>${table(view.wires,true)}<p class="hint">线材按用途汇总，仅用于估算工作量。同类线材可能包含不同实际规格，采购前须另行拆分确认，不可直接据此下单。</p></section>`,'doc-bom');
}
