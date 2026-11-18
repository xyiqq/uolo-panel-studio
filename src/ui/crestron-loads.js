import {fieldTerminalOptions,fieldTerminalClaims} from '../core/field-terminals.js';
import {hasDryContacts,isAnalogOutput,isCommonAnalog,analogClassLabel,loadTopology} from '../core/crestron-loads.js';
import {escapeHtml as esc} from '../core/escape.js';
import {analogCurrentStatus,driverDirections,normalizeAnalogCurrent} from '../core/analog-current.js';

function analogCurrentFields(pair={}) {
  const options=[['','待核'],...Object.entries(driverDirections)];
  if(pair.driverRole==='invalid')options.push(['invalid','已保存的方向无效']);
  return '<label class="field"><span>现场驱动器接口方向</span><select data-analog-driver>'+options.map(([value,name])=>
    '<option value="'+value+'" '+(value===(pair.driverRole||'')?'selected':'')+'>'+name+'</option>').join('')+'</select></label>'+
    '<label class="field"><span>本路驱动器接口总电流（mA）</span><input data-analog-ma inputmode="decimal" placeholder="待核" value="'+esc(pair.interfaceMa??'')+'"></label>'+
    '<p class="condition" data-analog-budget aria-live="polite"></p>';
}
const currentValues=row=>normalizeAnalogCurrent({driverRole:row.querySelector('[data-analog-driver]').value,interfaceMa:row.querySelector('[data-analog-ma]').value});
export function bindAnalogCurrent(root,product) {
  if(!isAnalogOutput(product))return;
  for(const row of root.querySelectorAll('[data-load-setting]')){
    const status=row.querySelector('[data-analog-budget]');
    const update=()=>{
      const budget=analogCurrentStatus(product,currentValues(row));
      const active=row.querySelector('[data-analog-plus]').value || row.querySelector('[data-analog-minus]').value || row.querySelector('[data-analog-ma]').value || row.querySelector('[data-analog-driver]').value;
      status.hidden=!active;
      status.textContent=budget.detail+(budget.error?' · '+budget.error+'。保存后本路信号对不出线。':'');
      status.style.color=budget.error?'#bf3030':'';
    };
    row.addEventListener('input',update);row.addEventListener('change',update);update();
  }
}

export function verifiedLoadFields(design,mod,product,resolve) {
  if(loadTopology(product)==='threePhase'){
    return '<label class="field" data-load-setting="1"><span>三相电表串联顺序</span><input data-series-stage type="number" min="1" step="1" placeholder="单表可留空" value="'+esc(mod.seriesStages?.[1]||'')+'"></label><p class="condition">同一馈线串接多表时，从保护器端逐表填写 1、2、3。四芯均依次经过每台表，PE 直达负载。</p>';
  }
  if(!hasDryContacts(product)) return '';
  const analog=isAnalogOutput(product);
  const terminals=analog?fieldTerminalOptions(design,resolve):[];
  const opts=current=>'<option value="">— 未配置 —</option>'+terminals.map(t=>'<option value="'+esc(t.id)+'" '+(current===t.id?'selected':'')+'>'+esc(t.label)+'</option>').join('');
  const sections=Array.from({length:product.channels},(_,i)=>{
    const ch=i+1, pair=mod.analogTerminals?.[ch];
    const selector=(key,sign)=>'<label class="field"><span>DIM '+sign+' 出箱端子</span><select data-analog-'+key+'>'+opts(pair?.[key])+'</select></label>';
    return '<div class="field-grid" data-load-setting="'+ch+'"><label class="field"><span>CH'+ch+' 串联顺序（选填）</span><input data-series-stage type="number" min="1" step="1" placeholder="单级留空" value="'+esc(mod.seriesStages?.[ch]||'')+'"></label>'+
       (analog?selector('plus','+')+selector('minus','−')+'<label class="field"><span>调光线截面 mm²</span><select data-analog-gauge><option value="">待核</option>'+[0.5,0.75,1,1.5].map(n=>'<option '+(pair?.section===n?'selected':'')+'>'+n+'</option>').join('')+'</select></label>'+analogCurrentFields(pair):'')+'</div>';
  }).join('');
  const grade=isCommonAnalog(product)?'<label class="field"><span>四区共用负端 · 全部现场驱动器回路类别</span><select data-analog-class>'+['','pelv','nonPelv'].map(value=>'<option value="'+value+'" '+((mod.analogCircuitClass||'')===value?'selected':'')+'>'+analogClassLabel(value)+'</option>').join('')+'</select></label>':'';
  return '<details '+(analog?'open':'')+'><summary>'+(analog?'0–10V 出线与接点串联':'干接点串联顺序')+'</summary><p class="condition">多个干接点串接同一支路时，从保护器到负载依次填写 1、2、3。'+(analog?'调光线分别接入两个灰色端子极位。'+analogCurrentStatus(product).capability+'，同一路多个驱动器按接口电流之和核对。':'')+'</p>'+grade+sections+'</details>';
}

export function readVerifiedLoadFields(root,design,id,product,channels) {
  const meter=loadTopology(product)==='threePhase';
  if(!hasDryContacts(product)&&!meter) return {};
  const seriesStages={},analogTerminals={},claims=fieldTerminalClaims(design),used=new Set();
  for(const row of root.querySelectorAll('[data-load-setting]')){
    const ch=Number(row.dataset.loadSetting),stage=row.querySelector('[data-series-stage]');
    if(stage.value){
      if(!stage.validity.valid||!Number.isSafeInteger(Number(stage.value))||!channels[ch]) throw Error('CH'+ch+' 串联顺序须为正整数，并先分配支路。');
      seriesStages[ch]=Number(stage.value);
      if(meter && design.modules.some(m=>m.id!==id && m.productId===product.id && m.channels?.[1]===channels[ch] && m.seriesStages?.[1]===seriesStages[ch]))
        throw Error('同一三相馈线的计量级次已有其他电表，请选择不同的顺序。');
    }
    if(!isAnalogOutput(product)) continue;
    const pair={plus:row.querySelector('[data-analog-plus]').value,minus:row.querySelector('[data-analog-minus]').value};
    const current=currentValues(row);
    if(!pair.plus&&!pair.minus){
      if(Object.keys(current).length)analogTerminals[ch]=current;
      continue;
    }
    if(!channels[ch]||!pair.plus||!pair.minus) throw Error('CH'+ch+' 请选择负载回路并配齐 DIM + / − 出箱端子。');
    for(const terminal of Object.values(pair)){
      if(used.has(terminal)||claims.get(terminal)?.some(c=>c.moduleId!==id||!c.field.startsWith('analog-')))
        throw Error(terminal+' 已分配给另一根导线。');
      used.add(terminal);
    }
    const section=Number(row.querySelector('[data-analog-gauge]').value);
    analogTerminals[ch]={...pair,...current,...(section?{section}:{})};
  }
  return {seriesStages,...(isCommonAnalog(product)?{analogCircuitClass:root.querySelector('[data-analog-class]').value}:{}),...(isAnalogOutput(product)?{analogTerminals}:{})};
}

export function verifyLoadCircuitSelection(design,product,channels,feed,source) {
  const type=loadTopology(product);
  if(!type&&!hasDryContacts(product)) return;
  const ids=Object.values(channels).filter(Boolean);
  if(!ids.length) return;
  if(new Set(ids).size!==ids.length) throw Error('同一模块的两个通道不能重复选择同一支路。');
  const voltage=type==='threePhase'?380:220;
  if(ids.some(id=>design.circuits.find(c=>c.id===id)?.voltage!==voltage)) throw Error('该型号的通道须选择 '+voltage+' V 支路。');
  if(type==='common'||type==='commonMotor'||feed==='shared'){
    if(feed!=='shared'||!source) throw Error('请选择共用馈电及对应的保护支路。');
    const feeder=design.circuits.find(c=>c.id===source);
    if(feeder?.voltage!==220 || (design.supply!=='single'&&ids.some(id=>design.circuits.find(c=>c.id===id)?.phase!==feeder.phase))) throw Error('共用馈电支路与各通道须同相。');
  }else if(feed!=='perChannel') throw Error('请选择每路馈电。');
}
