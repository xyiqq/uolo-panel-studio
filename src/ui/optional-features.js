import {OPTIONAL_FEATURES,featureVisible,setFeatureVisible} from '../core/feature-settings.js';
import {ROW_ZONES,rowZone,rowZoneIssues} from '../core/row-zones.js';
import {BUS_TYPES,saveBus,deleteBus} from '../core/bus-editor.js';
import {computeBusBudgets} from '../core/buses.js';
import {auditElectrical} from '../core/audit/electrical.js';
import {auditSmart} from '../core/audit/smart.js';
import {esc} from '../view/terminal-connections.js';
import '../styles/optional-features.css';

const options=(rows,value)=>rows.map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
const field=(label,html)=>`<label class="field"><span>${label}</span>${html}</label>`;
const input=(id,value='',type='text')=>`<input id="${id}" type="${type}" ${type==='number'?'min="0" step="any"':''} value="${esc(value??'')}">`;

export function mountOptionalFeatures({root,getDesign,getAssembly,getNet,products,resolve,commit,open,close,select,toast}) {
  const d=getDesign();
  root.innerHTML=`<button class="btn" data-feature-settings>功能显示设置</button>${OPTIONAL_FEATURES.map(([key,label])=>`<button class="btn" data-feature="${key}" ${featureVisible(d,key)?'':'hidden'}>${label}</button>`).join('')}`;
  const modal=()=>document.querySelector('#modal-body');
  const showSettings=()=>{
    open('功能显示设置',`<p>三个功能可分别显示或隐藏，设置随方案保存。隐藏入口不会删除总线、分排配置，也不会停用已保存的排布约束。</p><div class="feature-switches">${OPTIONAL_FEATURES.map(([key,label])=>`<label class="switch-label"><input type="checkbox" class="switch" data-visible="${key}" ${featureVisible(getDesign(),key)?'checked':''}>显示${label}</label>`).join('')}</div><button class="btn primary" data-feature-done>完成</button>`);
    modal().querySelectorAll('[data-visible]').forEach(el=>el.onchange=()=>commit(d=>setFeatureVisible(d,el.dataset.visible,el.checked)));
    modal().querySelector('[data-feature-done]').onclick=close;
  };
  const showAudit=()=>{
    const d=getDesign(),a=getAssembly(),budgets=computeBusBudgets(d,products());
    const issues=[...auditSmart(d,a,budgets,{products:products()}),...auditElectrical(d,a,getNet(),budgets)];
    open('电气校核',`<p>根据已录入负荷、额定与实际接线预检查。未知参数标记待核；结果不代替厂家资料和现场深化。</p><div class="feature-summary">${issues.filter(i=>i.level==='error').length} 项错误 · ${issues.filter(i=>i.level==='warning').length} 项提醒 · ${issues.filter(i=>i.level==='pending').length} 项待核</div><div class="feature-issues">${issues.map((i,index)=>`<article class="feature-issue ${esc(i.level)}"><strong>${esc({error:'错误',warning:'提醒',pending:'待核'}[i.level]||i.level)}</strong><span>${esc(i.message)}</span>${i.ref?`<button class="link" data-issue="${index}">定位 ${esc(i.ref)}</button>`:''}</article>`).join('')||'<p>当前已录入数据未发现上述问题。</p>'}</div><button class="btn" data-feature-done>关闭</button>`);
    modal().querySelectorAll('[data-issue]').forEach(el=>el.onclick=()=>{
      const ref=issues[+el.dataset.issue].ref;
      if((getDesign().buses||[]).some(b=>b.id===ref)){showBusForm(ref);return;}
      close();select(ref);
    });
    modal().querySelector('[data-feature-done]').onclick=close;
  };
  const showBuses=()=>{
    const budgets=computeBusBudgets(getDesign(),products());
    const fmt=v=>v==null?'待核':Number(v.toFixed(2));
    open('总线编辑',`<p>编辑电源、成员和线缆参数。未录入的消耗保持待核，多电源不会自动并联。</p><button class="btn primary" data-bus-new>新增总线</button><div class="feature-bus-list">${budgets.map(b=>`<article><strong>${esc(b.label||b.id)}</strong><p>${esc(b.type.toUpperCase())} · ${b.deviceCount} 个成员 · ${fmt(b.used)} / ${fmt(b.capacity)} ${esc(b.unit)}</p><small>${esc(b.pending.join('；'))}</small><div><button class="btn" data-bus-edit="${esc(b.id)}">编辑</button><button class="btn danger" data-bus-delete="${esc(b.id)}">删除</button></div></article>`).join('')||'<p>暂无总线。先从器件库装入电源和模块，再配置关联。</p>'}</div>`);
    modal().querySelector('[data-bus-new]').onclick=()=>showBusForm();
    modal().querySelectorAll('[data-bus-edit]').forEach(el=>el.onclick=()=>showBusForm(el.dataset.busEdit));
    modal().querySelectorAll('[data-bus-delete]').forEach(el=>el.onclick=()=>{
      const id=el.dataset.busDelete;
      open('删除总线',`<p>删除 ${esc(id)} 的配置和成员关联，柜内设备保留。可撤销。</p><button class="btn" data-bus-cancel>取消</button> <button class="btn danger" data-bus-confirm>确认删除</button>`);
      modal().querySelector('[data-bus-cancel]').onclick=showBuses;
      modal().querySelector('[data-bus-confirm]').onclick=()=>{commit(d=>deleteBus(d,id));showBuses();};
    });
  };
  const showBusForm=(id=null)=>{
    const d=getDesign(),b=d.buses?.find(v=>v.id===id)||{type:'dc',budgetUnit:'W',segregation:'SELV',voltage:24};
    const modules=(d.modules||[]).filter(m=>{const p=resolve(m.productId);return p&&!p.networkPorts&&!p.outletCount&&p.kind!=='terminal';});
    const checks=(kind,list)=>modules.filter(m=>kind!=='psu'||resolve(m.productId).kind==='psu').map(m=>`<label><input type="checkbox" data-bus-${kind}="${esc(m.id)}" ${(list||[]).includes(m.id)?'checked':''}>${esc(m.id+' · '+(m.label||resolve(m.productId).name))}${m.busId&&m.busId!==id?'（已属于其他总线）':''}</label>`).join('')||'<p>暂无可选模块</p>';
    open(id?'编辑总线 '+id:'新增总线',`<div class="feature-form-grid">${field('名称',input('bus-label',b.label||''))}${field('类型',`<select id="bus-type">${options(BUS_TYPES.map(t=>[t,t.toUpperCase()]),b.type)}</select>`)}${field('电压 V（未知留空）',input('bus-voltage',b.voltage,'number'))}${field('预算单位',`<select id="bus-unit">${options([['W','W'],['mA','mA']],b.budgetUnit)}</select>`)}${field('总容量（留空按单电源计算）',input('bus-capacity',b.capacity,'number'))}${field('最大设备数（未知留空）',input('bus-limit',b.maxDevices,'number'))}${field('线径 mm²（未知留空）',input('bus-section',typeof b.section==='number'?b.section:null,'number'))}${field('线缆规格',input('bus-cable',b.cableSpec||(typeof b.section==='string'?b.section:'')))}${field('线缆长度 m',input('bus-length',b.cableMeters,'number'))}${field('隔离类型',`<select id="bus-segregation">${options([['SELV','SELV'],['FELV','FELV'],['none','待核 / 未指定']],b.segregation)}</select>`)}</div>
      <h3>电源模块</h3><div class="feature-checks">${checks('psu',b.psuModuleIds)}</div><h3>成员模块</h3><div class="feature-checks">${checks('member',b.deviceModuleIds)}</div>
      <p class="feature-error" role="alert"></p><div class="tools"><button class="btn" data-bus-cancel>取消</button><button class="btn primary" data-bus-save>保存总线</button></div>`);
    modal().querySelector('#bus-type').onchange=event=>{
      // 类型切换不保留原类型容量，避免把 mA 直接当成 W。
      const type=event.target.value;
      modal().querySelector('#bus-unit').value=type==='dc'?'W':'mA';
      modal().querySelector('#bus-capacity').value='';
      modal().querySelector('#bus-voltage').value=type==='knx'?30:type==='dali'?'':24;
      modal().querySelector('#bus-segregation').value=type==='dali'?'FELV':['dc','knx','cresnet','qslink'].includes(type)?'SELV':'none';
      modal().querySelector('#bus-limit').value=['dali','knx'].includes(type)?64:'';
    };
    modal().querySelector('[data-bus-cancel]').onclick=showBuses;
    modal().querySelector('[data-bus-save]').onclick=()=>{
      const value=id=>modal().querySelector('#'+id).value;
      const next={id,type:value('bus-type'),label:value('bus-label'),voltage:value('bus-voltage'),budgetUnit:value('bus-unit'),capacity:value('bus-capacity'),maxDevices:value('bus-limit'),section:value('bus-section'),cableSpec:value('bus-cable'),cableMeters:value('bus-length'),segregation:value('bus-segregation'),psuModuleIds:[...modal().querySelectorAll('[data-bus-psu]:checked')].map(el=>el.dataset.busPsu),deviceModuleIds:[...modal().querySelectorAll('[data-bus-member]:checked')].map(el=>el.dataset.busMember)};
      try {saveBus(structuredClone(getDesign()),next,resolve);commit(d=>saveBus(d,next,resolve));showBuses();toast('总线已保存，可撤销');}
      catch(e){modal().querySelector('.feature-error').textContent=e.message;}
    };
  };
  const showRows=()=>{
    const a=getAssembly(),d=getDesign(),issues=rowZoneIssues(d,a);
    open('强弱电分排',`<p>按器件目录分区约束自动排布。控制模块仍可能含市电端子，分排不代替电气隔离核验。</p><div class="feature-rows">${Array.from({length:a.box.rows},(_,row)=>field(`第 ${row+1} 排 · ${a.nodes.filter(n=>!n.overflow&&n.row===row).length} 个器件`,`<select data-row-zone="${row}">${options(ROW_ZONES,rowZone(d,row))}</select>`)).join('')}</div><p>${issues.map(i=>esc(i.message)).join('<br>')}</p><p>保存时保留兼容的手动位置，不兼容位置会尝试重新排布并提示。选择“全部自动重排”会释放所有手动位置，可撤销。</p><label class="switch-label"><input type="checkbox" id="row-release">全部自动重排</label><p class="feature-error" role="alert"></p><div class="tools"><button class="btn" data-feature-done>取消</button><button class="btn primary" data-row-save>保存分排</button></div>`);
    modal().querySelector('[data-feature-done]').onclick=close;
    modal().querySelector('[data-row-save]').onclick=()=>{
      const zones=[...modal().querySelectorAll('[data-row-zone]')].map(el=>el.value),release=modal().querySelector('#row-release').checked;
      commit(d=>{d.rowZones=zones;if(release){d.positions={};for(const m of d.modules||[])m.position=null;for(const c of d.circuits||[])c.position=null;}});
      const problems=rowZoneIssues(getDesign(),getAssembly());
      if(problems.length){showRows();modal().querySelector('.feature-error').textContent='分排已保存，但仍有位置冲突或空间不足，请调整。';}
      else {close();toast('分排已保存，自动排布已更新');}
    };
  };
  root.querySelector('[data-feature-settings]').onclick=showSettings;
  const actions={electricalAudit:showAudit,busEditor:showBuses,rowZoning:showRows};
  root.querySelectorAll('[data-feature]').forEach(el=>el.onclick=actions[el.dataset.feature]);
}
