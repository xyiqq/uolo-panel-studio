import {escapeHtml as esc} from '../core/escape.js';
import {rs485CableNote,rs485PlanIssue,SDM630_V2} from '../core/serial-rs485.js';

export function serialFields(design, master) {
  if (master.productId !== 'crestron-din-ap4') return '';
  const meters = design.modules.filter(m=>m.productId === SDM630_V2);
  const ids = master.rs485Meters || [];
  const missing = ids.filter(id=>!meters.some(m=>m.id===id));
  const rows = meters.map(m=>{
    const position = ids.indexOf(m.id);
    return `<label class="field"><span>${esc(m.id)} · SDM630-Modbus V2</span><input type="number" min="1" step="1" data-serial-rank="${esc(m.id)}" value="${position<0?'':position+1}" placeholder="未接入"></label>`;
  });
  return `<fieldset id="mod-serial"><legend>RS-485 · COM1</legend>
    <p>按现场串接顺序填写电表序号，未接入的电表留空。</p><div class="field-grid">${rows.join('') || '<p>柜内暂无 SDM630-Modbus V2。</p>'}
    <label class="field"><span>总线长 m</span><input type="number" id="mod-serial-length" min="0" max="1200" step="any" value="${esc(master.rs485MetersLength??'')}" placeholder="待核"></label></div>
    ${missing.length?'<label><input type="checkbox" id="mod-serial-repair"> 原路径有缺失设备，按当前顺序重新接线</label>':''}
    <p class="data-note">${esc(rs485CableNote)}</p></fieldset>`;
}

export function readSerialFields(root,design,master) {
  if (!root.querySelector('#mod-serial')) return {};
  const repair = root.querySelector('#mod-serial-repair');
  if (repair && !repair.checked) return {rs485Meters:master.rs485Meters,rs485MetersLength:master.rs485MetersLength};
  const ranks = [...root.querySelectorAll('[data-serial-rank]')].filter(el=>el.value!=='')
    .map(el=>({id:el.dataset.serialRank, rank:Number(el.value)}));
  if (ranks.some(({rank})=>!Number.isSafeInteger(rank)||rank<1) || ranks.length!==new Set(ranks.map(r=>r.rank)).size) {
    throw new Error('电表串接序号须为互不重复的正整数。');
  }
  const ids = ranks.sort((a,b)=>a.rank-b.rank).map(r=>r.id);
  const raw = root.querySelector('#mod-serial-length').value;
  const length = raw === '' ? null : Number(raw);
  const issue = rs485PlanIssue(design,{...master,rs485MetersLength:length},ids);
  if (issue) throw new Error(issue);
  return {rs485Meters:ids,rs485MetersLength:length};
}
