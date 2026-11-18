import {OPTIONAL_FEATURES,featureVisible,setFeatureVisible} from '../core/feature-settings.js';
import {ROW_ZONES,rowZone,rowZoneIssues} from '../core/row-zones.js';
import {BUS_TYPES,saveBus,deleteBus} from '../core/bus-editor.js';
import {computeBusBudgets} from '../core/buses.js';
import {isCresnetDataBus,isCresnetChainBus} from '../core/cresnet.js';
import {isDinDali2,daliPowerMode,daliCresnetWatts} from '../core/dali-power.js';
import {isCresnetReceiver,isCresnetController,isCresnetChainSupply} from '../core/ports.js';
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
    const design=getDesign(),budgets=computeBusBudgets(design,products());
    const fmt=v=>v==null?'待核':Number(v.toFixed(2));
    const budgetText=b=>{
      if(b.dataOnly&&!b.cresnetChain) return '数据 Y/Z/G';
      const used=b.usedKnown?fmt(b.used):b.knownUsed>0?`至少 ${fmt(b.knownUsed)}（部分待核）`:'待核';
      if(b.cresnetChain&&!b.capacityKnown) return 'DIN-PWS50 串接 · 电源待核';
      const bus=design.buses.find(bus=>bus.id===b.id);
      const gateways=['dc','cresnet'].includes(b.type)?design.modules.filter(m=>
        (m.busId===b.id||bus?.deviceModuleIds?.includes(m.id))&&isDinDali2(resolve(m.productId))):[];
      const byMode=gateways.map(m=>{
        const mode=daliPowerMode(m),watts=daliCresnetWatts(resolve(m.productId),mode);
        return `<br>${esc(m.id)} · ${watts==null?'DALI 拨档待核':esc(mode)+' · '+esc(watts)+' W'}`;
      }).join('');
      return `${b.cresnetChain?'DIN-PWS50 串接 · ':''}${used} / ${fmt(b.capacity)} ${esc(b.unit)}${byMode}`;
    };
    open('总线编辑',`<p>配置供电总线、Cresnet 数据直连或 DIN-PWS50 串接。</p><button class="btn primary" data-bus-new>新增总线</button><div class="feature-bus-list">${budgets.map(b=>`<article><strong>${esc(b.label||b.id)}</strong><p>${esc(b.type.toUpperCase())} · ${b.deviceCount} 个成员 · ${budgetText(b)}</p><small>${esc(b.pending.join('；'))}</small><div><button class="btn" data-bus-edit="${esc(b.id)}">编辑</button><button class="btn danger" data-bus-delete="${esc(b.id)}">删除</button></div></article>`).join('')||'<p>暂无总线。先从器件库装入电源和模块，再配置关联。</p>'}</div>`);
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
    const label=m=>m.id+' · '+(m.displayName||m.label||resolve(m.productId).name);
    const otherBus=m=>m.busId&&m.busId!==id?'（已属于其他总线）':'';
    const controllerOptions=modules.filter(m=>isCresnetController(resolve(m.productId))).map(m=>[m.id,label(m)]);
    const chainSupplies=modules.filter(m=>isCresnetChainSupply(resolve(m.productId))).map(m=>[m.id,label(m)]);
    const pendingSupply='__supply_pending__';
    const chainOptions=[['','AP4 直连 · 成员独立 24V 供电'],...chainSupplies.map(([id,text])=>[id,`${text} · 串接电源`])];
    let savedSupply=b.chainSupplyModuleId||'';
    if(isCresnetChainBus(b)&&!chainSupplies.some(([id])=>id===savedSupply)){
      chainOptions.push([pendingSupply,'DIN-PWS50 串接 · 电源待核']);
      savedSupply=pendingSupply;
    }
    const dataMembers=modules.filter(m=>isCresnetReceiver(resolve(m.productId)));
    const dataMemberIds=new Set(dataMembers.map(m=>m.id));
    // Keep reserved socket positions visible when an imported member is missing or unsupported.
    const dataChoices=new Map(dataMembers.map(m=>[m.id,m]));
    if(isCresnetDataBus(b)) for(const id of b.deviceModuleIds||[]) {
      if(!dataChoices.has(id)) dataChoices.set(id,{id,label:'型号或位置待核'});
    }
    const legacyCresnet=!!id&&b.type==='cresnet'&&!isCresnetDataBus(b);
    if(b.controllerModuleId&&!controllerOptions.some(([id])=>id===b.controllerModuleId)){
      controllerOptions.unshift([b.controllerModuleId,`${b.controllerModuleId}（控制器待核）`]);
    }
    const psuChecks=modules.filter(m=>resolve(m.productId).kind==='psu').map(m=>`<label><input type="checkbox" data-bus-psu="${esc(m.id)}" ${b.psuModuleIds?.includes(m.id)?'checked':''}>${esc(label(m))}${otherBus(m)}</label>`).join('')||'<p>暂无可选模块</p>';
    let memberOrder=[...new Set(b.deviceModuleIds||[])];
    open(id?'编辑总线 '+id:'新增总线',`<div class="feature-form-grid">${field('名称',input('bus-label',b.label||''))}${field('类型',`<select id="bus-type">${options(BUS_TYPES.map(t=>[t,t.toUpperCase()]),b.type)}</select>`)}${field('电压 V（未知留空）',input('bus-voltage',b.voltage,'number'))}${field('预算单位',`<select id="bus-unit">${options([['W','W'],['mA','mA']],b.budgetUnit)}</select>`)}${field('总容量（留空按单电源计算）',input('bus-capacity',b.capacity,'number'))}${field('最大设备数（未知留空）',input('bus-limit',b.maxDevices,'number'))}${field('线径 mm²（未知留空）',input('bus-section',typeof b.section==='number'?b.section:null,'number'))}${field('线缆规格',input('bus-cable',b.cableSpec||(typeof b.section==='string'?b.section:'')))}${field('线缆长度 m',input('bus-length',b.cableMeters,'number'))}${field('隔离类型',`<select id="bus-segregation">${options([['SELV','SELV'],['FELV','FELV'],['none','待核 / 未指定']],b.segregation)}</select>`)}</div>
      <div id="bus-controller-field" hidden>${field('Cresnet 控制器',`<select id="bus-controller" aria-describedby="bus-cresnet-note">${options([['',legacyCresnet?'已保存的供电关联':'— 选择 DIN-AP4 —'],...controllerOptions],b.controllerModuleId||'')}</select>`)}</div>
      <div id="bus-chain-field" hidden>${field('Cresnet 接线方式 / 串接电源',`<select id="bus-chain-supply" aria-describedby="bus-cresnet-note">${options(chainOptions,savedSupply)}</select>`)}</div>
      <div id="bus-chain-length-field" hidden>${field('DIN-PWS50 至末台成员总线长 m（未知留空）',input('bus-chain-length',b.chainPowerMeters,'number'))}</div>
      <div id="bus-cresnet-note" hidden>
        <p class="condition" id="bus-direct-guide">DIN-AP4 有两个直连 NET 插口，成员的 24V 供电在直流电源模块中单独分配。三台及以上可选择 DIN-PWS50 串接。</p>
        <div id="bus-chain-guide" hidden>
          <p class="condition">DIN-AP4 NET 至 DIN-PWS50 NET 接 Y/Z/G。电源 NET2 至首台成员 NET，随后每台 NET2 至下一台 NET，逐段接 24/Y/Z/G。本方案使用 NET 插头，现场核对同段 M2M 跳接件配置。</p>
          <p class="condition">串接成员统一使用 DIN-PWS50 的 24V 控制电源。已有的供电关联须先解除。负载供电和 DALI 回路分别在具体模块中配置。</p>
        </div>
        <p class="condition" id="bus-cresnet-cable">标准 Cresnet 线缆 · Y/Z 各 0.33 mm²，G 通信参考 0.82 mm²</p>
      </div>
      <div id="bus-psus"><h3>电源模块</h3><div class="feature-checks">${psuChecks}</div></div><h3>成员模块</h3><div class="feature-checks" id="bus-members"></div>
      <p class="feature-error" role="alert"></p><div class="tools"><button class="btn" data-bus-cancel>取消</button><button class="btn primary" data-bus-save>保存总线</button></div>`);
    const form=modal();
    const find=id=>form.querySelector('#'+id);
    const value=id=>find(id).value;
    const typeIsCresnet=()=>value('bus-type')==='cresnet';
    const dataOnly=()=>typeIsCresnet()&&(!legacyCresnet||!!value('bus-controller'));
    const chainSource=()=>value('bus-chain-supply');
    const chainEnabled=()=>dataOnly()&&!!chainSource();
    const renderMembers=()=>{
      const data=dataOnly(),list=data?dataMembers:modules;
      const ids=memberOrder.filter(id=>dataChoices.has(id));
      const sorted=data?[...ids.map(id=>dataChoices.get(id)),...list.filter(m=>!ids.includes(m.id))]:list;
      find('bus-members').innerHTML=sorted.map(m=>{
        const index=ids.indexOf(m.id),checked=memberOrder.includes(m.id);
        const previous=ids[index-1]||(chainSource()===pendingSupply?'电源待核':chainSource());
        const socket=chainEnabled()?`第 ${index+1} 台 · ${previous} NET2 → NET`:
          index<2?['NET','NET2'][index]:'直连接口待核';
        const daliSupply=value('bus-type')==='dali'&&form.querySelector('[data-bus-psu]:checked')&&resolve(m.productId)?.daliPowerSupply;
        const daliHint=daliSupply==='switchable'?'请在网关中按 DALI 回路配置':daliSupply==='internal-only'?'仅用内置 DALI 电源':'';
        return `<div><label><input type="checkbox" data-bus-member="${esc(m.id)}" ${checked?'checked':''} ${daliHint&&!checked?'disabled':''}>${esc(label(m))}${daliHint?' · '+daliHint:data&&checked?` · ${esc(socket)}`:data?'':otherBus(m)}</label>${data&&checked&&ids.length>1?`<div class="tools" style="margin-top:6px">
          <button class="btn" data-bus-move-up="${esc(m.id)}" ${index===0?'disabled':''} aria-label="上移 ${esc(m.id)}">上移</button>
          <button class="btn" data-bus-move-down="${esc(m.id)}" ${index===ids.length-1?'disabled':''} aria-label="下移 ${esc(m.id)}">下移</button></div>`:''}</div>`;
      }).join('')||'<p>暂无可选模块</p>';
      find('bus-members').querySelectorAll('[data-bus-member]').forEach(el=>el.onchange=()=>{
        const id=el.dataset.busMember;
        memberOrder=el.checked?[...memberOrder,id]:memberOrder.filter(member=>member!==id);
        if(data){
          renderMembers();
          [...find('bus-members').querySelectorAll('[data-bus-member]')].find(item=>item.dataset.busMember===id)?.focus();
        }
      });
      for(const [name,step] of [['up',-1],['down',1]]){
        find('bus-members').querySelectorAll(`[data-bus-move-${name}]`).forEach(el=>el.onclick=()=>{
          const id=el.getAttribute(`data-bus-move-${name}`);
          const from=memberOrder.indexOf(id),to=memberOrder.indexOf(ids[ids.indexOf(id)+step]);
          [memberOrder[from],memberOrder[to]]=[memberOrder[to],memberOrder[from]];
          renderMembers();
          const moved=[...find('bus-members').querySelectorAll(`[data-bus-move-${name}]`)].find(item=>item.getAttribute(`data-bus-move-${name}`)===id);
          if(moved?.disabled) [...find('bus-members').querySelectorAll('[data-bus-member]')].find(item=>item.dataset.busMember===id)?.focus();
          else moved?.focus();
        });
      }
    };
    const renderTypeFields=()=>{
      const data=dataOnly();
      find('bus-controller-field').hidden=!typeIsCresnet();
      find('bus-chain-field').hidden=!data;
      find('bus-chain-length-field').hidden=!chainEnabled();
      find('bus-cresnet-note').hidden=!data;
      find('bus-direct-guide').hidden=chainEnabled();
      find('bus-chain-guide').hidden=!chainEnabled();
      find('bus-cresnet-cable').textContent=chainEnabled()?'标准 Cresnet 线缆 · 红/黑 24/G 各 0.82 mm²，白/蓝 Y/Z 各 0.33 mm²':
        '标准 Cresnet 线缆 · Y/Z 各 0.33 mm²，G 通信参考 0.82 mm²';
      find('bus-psus').hidden=data;
      for(const field of ['voltage','unit','capacity','limit','section','cable','segregation']) find('bus-'+field).closest('label').hidden=data;
      renderMembers();
    };
    renderTypeFields();
    modal().querySelector('#bus-type').onchange=event=>{
      // 类型切换不保留原类型容量，避免把 mA 直接当成 W。
      const type=event.target.value;
      modal().querySelector('#bus-unit').value=type==='dc'?'W':'mA';
      modal().querySelector('#bus-capacity').value='';
      modal().querySelector('#bus-voltage').value=type==='knx'?30:type==='dali'?'':24;
      modal().querySelector('#bus-segregation').value=type==='dali'?'FELV':['dc','knx','cresnet','qslink'].includes(type)?'SELV':'none';
      modal().querySelector('#bus-limit').value=['dali','knx'].includes(type)?64:'';
      renderTypeFields();
    };
    find('bus-controller').onchange=renderTypeFields;
    find('bus-chain-supply').onchange=renderTypeFields;
    find('bus-psus').addEventListener('change',()=>{if(value('bus-type')==='dali') renderMembers();});
    modal().querySelector('#bus-unit').onchange=()=>{
      // 手动改单位同样不能把已输入的容量数值直接解释为另一单位。
      modal().querySelector('#bus-capacity').value='';
    };
    modal().querySelector('[data-bus-cancel]').onclick=showBuses;
    modal().querySelector('[data-bus-save]').onclick=()=>{
      const data=dataOnly(),source=chainSource();
      const next={id,type:value('bus-type'),label:value('bus-label'),
        voltage:data?'':value('bus-voltage'),budgetUnit:chainEnabled()?'W':value('bus-unit'),capacity:data?'':value('bus-capacity'),
        maxDevices:data?'':value('bus-limit'),section:data?'':value('bus-section'),cableSpec:data?'':value('bus-cable'),
        cableMeters:value('bus-length'),segregation:value('bus-segregation'),
        psuModuleIds:data?[]:[...form.querySelectorAll('[data-bus-psu]:checked')].map(el=>el.dataset.busPsu),
        ...(data?{controllerModuleId:value('bus-controller'),chainSupplyModuleId:source===pendingSupply?null:source||undefined,
          chainPowerMeters:source?value('bus-chain-length'):undefined}:{}),
        deviceModuleIds:data?memberOrder.filter(id=>dataChoices.has(id)):[...form.querySelectorAll('[data-bus-member]:checked')].map(el=>el.dataset.busMember)};
      try {
        if(data&&!next.controllerModuleId) throw new Error('请选择柜内的 DIN-AP4 作为 Cresnet 控制器。');
        if(data&&legacyCresnet&&(b.psuModuleIds?.length||b.deviceModuleIds?.some(id=>!dataMemberIds.has(id)))){
          throw new Error('现有总线包含供电配置或其他型号。请另建 Cresnet 数据总线。');
        }
        saveBus(structuredClone(getDesign()),next,resolve);
        commit(d=>saveBus(d,next,resolve));showBuses();toast('总线已保存，可撤销');
      } catch(e){form.querySelector('.feature-error').textContent=e.message;}
    };
  };
  const showRows=()=>{
    const a=getAssembly(),d=getDesign(),issues=rowZoneIssues(d,a);
    open('强弱电分排',`<p>按器件目录分区约束自动排布。控制模块仍可能含市电端子，分排不代替电气隔离核验。</p><div class="feature-rows">${Array.from({length:a.box.rows},(_,row)=>field(`第 ${row+1} 排 · ${a.nodes.filter(n=>!n.overflow&&n.row===row).length} 个器件`,`<select data-row-zone="${row}">${options(ROW_ZONES,rowZone(d,row))}</select>`)).join('')}</div><div class="feature-issues">${issues.map(i=>`<article class="feature-issue error"><span>${esc(i.message)}</span><button class="link" data-row-issue="${esc(i.ref)}">定位 ${esc(i.ref)}</button></article>`).join('')}</div><p>保存时保留兼容的手动位置，不兼容位置会尝试重新排布并提示。选择“全部自动重排”会释放所有手动位置，可撤销。</p><label class="switch-label"><input type="checkbox" id="row-release">全部自动重排</label><p class="feature-error" role="alert"></p><div class="tools"><button class="btn" data-feature-done>取消</button><button class="btn primary" data-row-save>保存分排</button></div>`);
    modal().querySelectorAll('[data-row-issue]').forEach(el=>el.onclick=()=>{close();select(el.dataset.rowIssue);});
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
  return {showBuses};
}
