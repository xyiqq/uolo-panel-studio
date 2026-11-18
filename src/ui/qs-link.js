import {escapeHtml as e} from '../core/escape.js';
import {normalizeQsConfig,qsLinkCount,QS_SUPPLIES,QS_HARNESS,QS_RECEIVERS,qsSummary,qsPowerReserved} from '../core/qs-link.js';
import {fieldTerminalOptions,fieldTerminalClaims} from '../core/field-terminals.js';

export function qsFields(design, module, resolve) {
  const count=qsLinkCount(module.productId);
  if(!count)return '';
  const cfg=normalizeQsConfig(module.qsConfig||{},count);
  const options=(modules,value,empty)=>'<option value="">'+e(empty)+'</option>'+modules.map(m=>
    '<option value="'+e(m.id)+'" '+(m.id===value?'selected':'')+'>'+e(m.id+' · '+(m.displayName||m.label||resolve(m.productId)?.name||m.id))+'</option>'
  ).join('')+(value&&!modules.some(m=>m.id===value)?'<option selected value="'+e(value)+'">'+e(value)+' · 资料待核</option>':'');
  const modules=design.modules||[];
  const otherHosts={modules:modules.filter(m=>m.id!==module.id && m.qsConfig)};
  const occupiedMembers=new Set(otherHosts.modules.flatMap(m=>Object.values(m.qsConfig.links).flatMap(l=>l.members)));
  const sources=modules.filter(m=>QS_SUPPLIES.includes(m.productId) && !qsPowerReserved(otherHosts,m.id));
  const members=modules.filter(m=>QS_RECEIVERS.includes(m.productId) && !occupiedMembers.has(m.id));
  const contacts=fieldTerminalOptions(design,resolve);
  const strips=modules.filter(m=>contacts.some(p=>p.id===m.id+':4'));
  const claims=fieldTerminalClaims(design);
  const num=(key,label,value)=>'<label class="field"><span>'+label+'</span><input data-qs-num="'+key+'" type="number" min="0" step="any" placeholder="待核" value="'+e(value??'')+'"></label>';
  const select=(key,label,opts)=>'<label class="field"><span>'+label+'</span><select data-qs="'+key+'">'+opts+'</select></label>';
  const links=Object.entries(cfg.links).map(([n,l])=>{
    const ordered=[...new Set([...l.members,...members.map(m=>m.id)])];
    return '<fieldset data-qs-link="'+n+'"><legend>QS L'+n+'</legend><p class="condition">勾选的设备按从上到下的顺序级联，可用「上移」调整。市电 LQSE 只接 1 COM、3 MUX、4 MUX̅。</p>'+
      '<div data-qs-members>'+ordered.map(id=>'<div><label><input type="checkbox" data-qs-member="'+e(id)+'" '+(l.members.includes(id)?'checked':'')+'> '+e(id+' · '+(resolve(modules.find(m=>m.id===id)?.productId)?.name||'待核'))+'</label> <button type="button" data-qs-up>上移</button></div>').join('')+'</div>'+
      num('meters','累计线长（m）',l.meters)+select('terminal','现场 QS 出线端子（1–4 位）',options(strips.filter(m=>[1,2,3,4].every(p=>(claims.get(m.id+':'+p)||[]).every(c=>c.moduleId===module.id && c.field==='qs-'+n+'-'+p))),l.terminalId,'无现场出线'))+
      '<div data-qs-group>'+select('group','现场组供电',options([{id:'@link',label:'HQP7 本链路端子 2'},...sources],l.fieldSupplyId,'请选择电源组'))+
      '<p class="condition">端子 1 为 COM，2 为 +24 V，3、4 为屏蔽双绞数据线。独立供电组与处理器链路只共接 COM 和数据。</p>'+
      '<div class="field-grid">'+num('fieldPdu','现场设备总 PDU',l.fieldPdu)+num('fieldMa','现场设备总电流（mA）',l.fieldMa)+
      num('fieldDevices','现场设备地址数',l.fieldDevices)+'</div></div>'+
      num('fieldOutputs','柜外可控输出与 DALI 驱动器合计数',l.fieldOutputs)+'</fieldset>';
  }).join('');
  return '<fieldset id="qs-settings"><legend>HomeWorks QSX 接线</legend><label><input type="checkbox" id="qs-enable" '+(module.qsConfig?'checked':'')+'> 配置处理器线束和有线链路</label><div id="qs-config">'+
    select('power','处理器电源',options(sources.filter(m=>m.productId===QS_HARNESS),cfg.supplyId,'选择 QSPS-DH-1-75-H'))+
    '<p class="condition">线束给 P、COM 单独供电。每链路最多 99 个设备、512 个可控输出。含 LQSE-4T10-D 或 4S10-D 时累计最长 600 m，其余已核链路最长 610 m。现场供电组额定 75 PDU，单个处理器链路最大 1 A。</p>'+
    (module.qsConfig?'<p class="condition">'+e(qsSummary(module)[0].detail)+'</p>':'')+
    links+select('ethernet','下一级处理器（ETH2 → ETH1）',options(modules.filter(m=>m.id!==module.id&&qsLinkCount(m.productId)),cfg.nextProcessorId,'无处理器级联'))+
    num('ethernetMeters','至下一级的 Cat5e 或更高类别线长（m）',cfg.ethernetMeters)+'</div></fieldset>';
}

export function bindQsFields(root) {
  const panel=root.querySelector('#qs-settings');
  if(!panel)return null;
  const enabled=panel.querySelector('#qs-enable'), rows=[...panel.querySelectorAll('[data-qs-link]')];
  const get=(el,k)=>el.querySelector('[data-qs="'+k+'"]');
  const num=(el,k)=>{const input=el.querySelector('[data-qs-num="'+k+'"]');return input.value===''?null:input.valueAsNumber;};
  const visibility=()=>{
    panel.querySelector('#qs-config').hidden=!enabled.checked;
    for(const row of rows)row.querySelector('[data-qs-group]').hidden=!get(row,'terminal').value;
    const sources=[get(panel,'power'),...rows.filter(row=>get(row,'terminal').value).map(row=>get(row,'group'))];
    for(const select of sources)for(const opt of select.options)opt.disabled=!!opt.value && opt.value!=='@link' && !opt.selected && sources.some(other=>other!==select && other.value===opt.value);
    const checks=[...panel.querySelectorAll('[data-qs-member]')];
    for(const box of checks)box.disabled=!box.checked && checks.some(other=>other!==box && other.checked && other.dataset.qsMember===box.dataset.qsMember);
  };
  panel.addEventListener('change',visibility);
  panel.querySelectorAll('[data-qs-up]').forEach(button=>button.onclick=()=>{
    const row=button.parentElement;
    if(row.previousElementSibling)row.parentElement.insertBefore(row,row.previousElementSibling);
  });
  visibility();
  return ()=>{
    if(!enabled.checked)return null;
    const links={};
    for(const row of rows){
      const terminalId=get(row,'terminal').value;
      links[row.dataset.qsLink]={meters:num(row,'meters'),members:[...row.querySelectorAll('[data-qs-member]:checked')].map(el=>el.dataset.qsMember),
        terminalId, fieldSupplyId:terminalId?get(row,'group').value:'',
        fieldPdu:terminalId?num(row,'fieldPdu'):null,fieldMa:terminalId?num(row,'fieldMa'):null,
        fieldDevices:terminalId?num(row,'fieldDevices'):null,fieldOutputs:num(row,'fieldOutputs')};
    }
    return {supplyId:get(panel,'power').value,links,nextProcessorId:get(panel,'ethernet').value,ethernetMeters:num(panel,'ethernetMeters')};
  };
}
