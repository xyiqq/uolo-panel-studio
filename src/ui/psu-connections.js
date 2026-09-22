import {psuConnectionType,psuConnections} from '../core/psu-connections.js';
import {dcInputVoltage,acceptsExternalDaliPower} from '../core/ports.js';

export function modulePowerDescription(product) {
  const voltage=dcInputVoltage(product);
  if(!voltage) return '';
  const input=`模块本身：${voltage}V 直流供电${product.powerInput.includes('poe')?'，也可使用 PoE':''}${product.protocol?.includes('cresnet')?'（Cresnet 的 24 / G 电源端子）':''}。`;
  const load=product.loadPowerInput==='LN'?'灯具／设备：由支路空开经过模块负载端供电，与模块本身的直流供电分开。':'';
  return input+load;
}

export function psuConnectionFields(design,id,product,lookup,escape) {
  const type=psuConnectionType(product);
  if(!type) return '';
  const selected=new Set(psuConnections(design,id));
  const items=(design.modules||[]).filter(m=>m.id!==id&&lookup(m.productId)?.kind!=='psu').map(m=>{
    const p=lookup(m.productId);
    if(!p) return '';
    const blockedDali=type==='dali'&&p.protocol?.includes('dali')&&!acceptsExternalDaliPower(p);
    const match=type==='dc' ? dcInputVoltage(p)===product.psuOutput.voltage : p.protocol?.includes(type)&&!blockedDali;
    const unknown=type==='dc'&&!p.powerInput&&p.kind==='gateway'&&!p.networkPorts;
    const occupied=(design.buses||[]).some(b=>b.type===type&&!b.psuModuleIds?.includes(id)&&b.psuModuleIds?.length&&(b.deviceModuleIds?.includes(m.id)||m.busId===b.id));
    const disabled=occupied||(!match&&!unknown&&!selected.has(m.id));
    const status=occupied?'已连接其他电源':blockedDali?(p.daliPowerSupply==='internal-only'?'内置 DALI 电源，不可外接':'需确认外置 DALI 电源模式'):match?(type==='dc'?`${dcInputVoltage(p)}V 模块供电${p.loadPowerInput==='LN'?'；负载另接支路空开':''}`:''):unknown?'供电参数待核，仅保存关联':'电压或协议不匹配';
    return `<label style="display:flex;align-items:center;gap:8px;margin:8px 0"><input type="checkbox" data-psu-target="${escape(m.id)}" ${selected.has(m.id)?'checked':''} ${disabled?'disabled':''}><span>${escape(m.id)} · ${escape(m.displayName||m.label||p.name)}${status?` <small>（${status}）</small>`:''}</span></label>`;
  }).join('');
  return `<fieldset id="mod-psu-output" style="margin:12px 0;padding:12px;border:1px solid #ccd6d1;border-radius:8px"><legend>下端出线连接的模块 · ${type==='dc'?`${product.psuOutput.voltage}V DC`:type.toUpperCase()}</legend><p class="condition">可多选。上端由支路空开供电，下端连接这里勾选的模块。${type==='dc'?'这里给模块本身供电；继电器／调光器的灯具、设备负载另接支路空开。供电参数待核的关联不会自动生成接线。':'这里连接 DALI／总线端子，不代替模块的直流供电。'}</p>${items||'<p>请先装入需要连接的模块，再编辑此电源选择。</p>'}</fieldset>`;
}
