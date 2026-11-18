import {escapeHtml as esc} from '../core/escape.js';
import {daliPowerMode,daliCresnetWatts,daliLoopSupplyCandidates} from '../core/dali-power.js';

export function daliPowerFields(module) {
  const mode=daliPowerMode(module);
  return `<fieldset id="mod-dali-settings"><legend>DALI 总线供电</legend>
    <label class="field"><span>整机 DALI POWER 拨档</span><select id="mod-dali-mode">
      ${['INT','EXT'].map(key=>`<option value="${key}" ${mode===key?'selected':''}>${key} · ${key==='INT'?'内置电源':'外置电源'}</option>`).join('')}
      ${['INT','EXT'].includes(mode)?'':'<option value="" selected>拨档待核，请重新选择</option>'}
    </select></label>
    <p class="condition" id="mod-dali-budget" aria-live="polite"></p>
    <div class="field-grid" id="mod-dali-supplies" hidden>${[1,2].map(loop=>`<label class="field"><span>DALI ${loop} 外置总线电源</span><select id="mod-dali-supply-${loop}"></select></label>`).join('')}</div>
    <p class="condition" id="mod-dali-guide"></p>
  </fieldset>`;
}

export function bindDaliPowerFields(root,design,module,product,resolve) {
  const mode=root.querySelector('#mod-dali-mode');
  const sources=[1,2].map(loop=>root.querySelector('#mod-dali-supply-'+loop));
  const picks={...module.daliLoopSupplies};
  function update() {
    const external=mode.value==='EXT';
    root.querySelector('#mod-dali-supplies').hidden=!external;
    const watts=daliCresnetWatts(product,mode.value);
    root.querySelector('#mod-dali-budget').textContent=watts==null?'Cresnet 功耗待核':`采用 Cresnet 24V 供电时，整机计入 ${watts} W。`;
    root.querySelector('#mod-dali-guide').textContent=external
      ? '整机两路均使用外置电源。每路分别选择柜内的 DALI 电源，留空的回路保存为待核。'
      : 'INT 由机内电源分别为两路 DALI 供电。保存 INT 将解除两路外置电源分配。';
    const editedModule={...module,daliPowerMode:'EXT',daliLoopSupplies:picks};
    const draft={...design,modules:[...design.modules.filter(m=>m.id!==module.id),editedModule]};
    sources.forEach((select,index)=>{
      const loop=index+1, current=picks[loop];
      const candidates=daliLoopSupplyCandidates(draft,module.id,loop,resolve);
      const options=candidates.map(m=>`<option value="${esc(m.id)}">${esc(m.id)} · ${esc(m.displayName||m.label||resolve(m.productId).name)}</option>`);
      if(current&&!candidates.some(m=>m.id===current)){
        options.push(`<option value="${esc(current)}" disabled>${esc(current)} · 来源待核</option>`);
      }
      select.innerHTML='<option value="">— 待配置 —</option>'+options.join('');
      select.value=current||'';
      select.disabled=!external;
    });
  }
  mode.addEventListener('change',update);
  sources.forEach((select,index)=>select.addEventListener('change',()=>{
    picks[index+1]=select.value||null;
    update();
  }));
  update();
  return ()=>({mode:mode.value,loopSupplies:mode.value==='EXT'?picks:{}});
}
