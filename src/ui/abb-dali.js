import {escapeHtml as esc} from '../core/escape.js';
import {fieldTerminalOptions} from '../core/field-terminals.js';
import {abbDaliLines,daliCableSections,daliFieldLineCount,daliFieldCapacity,fieldLineLabel,normalizeDaliFieldLoops,unsignedDaliFields} from '../core/abb-dali.js';

export function daliFieldInputs(design, mod, product, resolve) {
  const count = daliFieldLineCount(product);
  if (!count) return '';
  const terminals = fieldTerminalOptions(design,resolve);
  const loops = mod.daliFieldLoops || {};
  const options = id => '<option value="">— 选择实际灰色极位 —</option>'+
    (id && !terminals.some(t=>t.id===id) ? '<option selected value="'+esc(id)+'">'+esc(id)+' · 待核</option>' : '')+
    terminals.map(t => '<option value="'+esc(t.id)+'" '+(id===t.id?'selected':'')+'>'+esc(t.label)+'</option>').join('');
  return Array.from({length:count}, (_,i) => {
    const line = i + 1, loop = loops[line] || {};
    const field = (caption,key,attrs='') => '<label class="field"><span>'+caption+'</span><input data-dali-field="'+key+'" '+attrs+' value="'+esc(loop[key]??'')+'"></label>';
    const terminal = (sign,key) => '<label class="field"><span>DA'+sign+' 出箱端子</span><select data-dali-field="'+key+'">'+options(loop[key])+'</select></label>';
    return '<fieldset data-dali-line="'+line+'"><legend>'+fieldLineLabel(product,line)+' 现场出线</legend>'+
      field('驱动器组或现场位置','name','maxlength="80"')+
      '<div class="field-grid">'+terminal(unsignedDaliFields(product)?' 左':'+','plus')+terminal(unsignedDaliFields(product)?' 右':'−','minus')+
      field('驱动器数量','devices','type="number" min="1" max="64" step="1"')+
      field('驱动器总线电流合计（mA）','milliamps','type="number" min="0" step="any"')+
      '<label class="field"><span>截面积（mm²）</span><select data-dali-field="section"><option value="">待核</option>'+
      daliCableSections(product).map(n=>'<option value="'+n+'" '+(loop.section===n?'selected':'')+'>'+n+(n===0.82?'（18 AWG）':'')+'</option>').join('')+'</select></label>'+
      field(abbDaliLines(product)||unsignedDaliFields(product)?'总布线长度（m）':product.id==='crestron-din-dali-2'?'至最远驱动器长度（m）':'最远两设备间长度（m）','meters','type="number" min="0" step="any"')+
      '</div><p data-dali-rating class="condition"></p></fieldset>';
  }).join('');
}

export function bindDaliFieldInputs(root,design,mod,product,resolve) {
  const sets = [...root.querySelectorAll('[data-dali-line]')];
  if (!sets.length) return null;
  function update() {
    const draft={...mod,daliPowerMode:root.querySelector('#mod-dali-mode')?.value??mod.daliPowerMode,
      daliLoopSupplies:{...mod.daliLoopSupplies}};
    sets.forEach(set => {
      const line = Number(set.dataset.daliLine);
      const supply = root.querySelector('#mod-dali-supply-'+line);
      if (supply) draft.daliLoopSupplies[line]=supply.value;
      const capacity = daliFieldCapacity(product,draft,line,id=>resolve(design.modules.find(m=>m.id===id)?.productId));
      set.querySelector('[data-dali-rating]').textContent='每路最多 64 台 · '+(capacity==null?'外源供电预算待核':'本路供电预算 '+capacity+' mA');
    });
  }
  for (const field of root.querySelectorAll('#mod-dali-mode,[id^="mod-dali-supply-"]')) field.addEventListener('change',update);
  update();
  return () => {
    const data={};
    for (const set of sets) {
      const row = {};
      for (const input of set.querySelectorAll('[data-dali-field]')) row[input.dataset.daliField]=input.value;
      data[set.dataset.daliLine] = row;
    }
    return normalizeDaliFieldLoops(data,product);
  };
}
