import {psuConnectionType,psuConnections} from '../core/psu-connections.js';
import {qsPowerReserved} from '../core/qs-link.js';
import {isCresnetChainBus} from '../core/cresnet.js';
import {isDinDali2,daliPowerMode,daliSupplyOwners} from '../core/dali-power.js';
import {dcInputVoltage,acceptsExternalDaliPower,hasIndependentLoadFeeds,isCresnetController,isCresnetChainSupply} from '../core/ports.js';

export function modulePowerDescription(product) {
  if(isCresnetChainSupply(product)) return 'DIN-PWS50 由市电侧供电。用于 Cresnet 串接时，在总线编辑中选择供电电源和成员顺序。';
  const voltage=dcInputVoltage(product);
  if(!voltage) return '';
  const terminals=isCresnetController(product)?'（独立 PWR 24 / G 电源端子）':
    product.protocol?.includes('cresnet')?'（NET 的 24 / G 电源端子）':'';
  const input=`模块本身：${voltage}V 直流供电${product.powerInput.includes('poe')?'，也可使用 PoE':''}${terminals}。`;
  if(hasIndependentLoadFeeds(product)) {
    return `${input}负载侧按独立通道或桥接组分配 L/N 馈电。出厂 L/N 共接跳线须按实际分组调整。`;
  }
  if(product.daliPowerSupply==='internal-only') return input+'DALI 回路使用内置总线电源。';
  const load=product.loadPowerInput==='LN'?'灯具／设备：由支路空开经过模块负载端供电，与模块本身的直流供电分开。':'';
  return input+load;
}

export function psuConnectionFields(design,id,product,lookup,escape) {
  const type=psuConnectionType(product);
  if(!type) return '';
  const selected=new Set(psuConnections(design,id));
  if(type==='dc' && qsPowerReserved(design,id) && !selected.size)return '<p class="condition" data-qs-managed>该电源已分配至 HQP7 接线线束或现场 QS 电源组，可在处理器中编辑。</p>';
  const daliOwners=type==='dali'?daliSupplyOwners(design,id):[];
  if(daliOwners.length&&!selected.size){
    const assigned=daliOwners.map(o=>escape(o.moduleId)+' · DALI '+o.loop).join(' / ');
    return `<p class="condition" data-dali-managed>外置 DALI 电源已分配给 ${assigned}。在对应网关的「DALI 总线供电」中修改分配。</p>`;
  }
  const chainBuses=(design.buses||[]).filter(isCresnetChainBus);
  const chainSource=chainBuses.some(b=>b.chainSupplyModuleId===id);
  if(chainSource&&!selected.size) return '<p class="condition" data-cresnet-managed>下端 NET2 接线由 Cresnet 串接总线配置；成员和顺序在总线编辑中调整。</p>';
  const items=(design.modules||[]).filter(m=>m.id!==id&&lookup(m.productId)?.kind!=='psu').map(m=>{
    const p=lookup(m.productId);
    if(!p) return '';
    const blockedDali=type==='dali'&&p.protocol?.includes('dali')&&!acceptsExternalDaliPower(p);
    const match=type==='dc' ? dcInputVoltage(p)===product.psuOutput.voltage : p.protocol?.includes(type)&&!blockedDali;
    const unknown=type==='dc'&&!p.powerInput&&p.kind==='gateway'&&!p.networkPorts;
    const occupied=(design.buses||[]).some(b=>b.type===type&&!b.psuModuleIds?.includes(id)&&b.psuModuleIds?.length&&(b.deviceModuleIds?.includes(m.id)||m.busId===b.id));
    const chainMember=type==='dc'&&chainBuses.some(b=>b.deviceModuleIds?.includes(m.id));
    const qsOwned=type==='dc' && qsPowerReserved(design,m.id);
    const disabled=(qsOwned||chainSource||chainMember||daliOwners.length)?!selected.has(m.id):occupied||(!match&&!unknown&&!selected.has(m.id));
    let status=chainSource?'由 Cresnet 串接总线分配':chainMember?'由 DIN-PWS50 串接总线供电':occupied?'已连接其他电源':blockedDali?(p.daliPowerSupply==='internal-only'?'内置 DALI 电源，不可外接':'需确认外置 DALI 电源模式'):match?(type==='dc'?`${dcInputVoltage(p)}V 模块供电${p.loadPowerInput==='LN'||hasIndependentLoadFeeds(p)?'，负载另接支路空开':''}`:''):unknown?'供电参数待核，仅保存关联':'电压或协议不匹配';
    if(type==='dali'&&isDinDali2(p)){
      const loops=Object.entries(m.daliLoopSupplies||{}).filter(([,source])=>source===id).map(([loop])=>'DALI '+loop);
      status=daliPowerMode(m)==='INT'?'INT · 使用内置电源':loops.length?`已分配到 ${loops.join(' / ')}，在网关中编辑`:'在网关中按 DALI 回路分配电源';
    }
    if(qsOwned)status='已在 HQP7 设置中配置线束供电';
    return `<label style="display:flex;align-items:center;gap:8px;margin:8px 0"><input type="checkbox" data-psu-target="${escape(m.id)}" ${selected.has(m.id)?'checked':''} ${disabled?'disabled':''}><span>${escape(m.id)} · ${escape(m.displayName||m.label||p.name)}${status?` <small>（${status}）</small>`:''}</span></label>`;
  }).join('');
  return `<fieldset id="mod-psu-output" style="margin:12px 0;padding:12px;border:1px solid #ccd6d1;border-radius:8px"><legend>下端出线连接的模块 · ${type==='dc'?`${product.psuOutput.voltage}V DC`:type.toUpperCase()}</legend><p class="condition">可多选。上端由支路空开供电，下端连接这里勾选的模块。${type==='dc'?'这里给模块本身供电；继电器／调光器的灯具、设备负载另接支路空开。供电参数待核的关联不会自动生成接线。':'这里连接 DALI／总线端子，不代替模块的直流供电。'}</p>${items||'<p>请先装入需要连接的模块，再编辑此电源选择。</p>'}</fieldset>`;
}
