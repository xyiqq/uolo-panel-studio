import {fieldTerminalClaims, fieldTerminalPort} from './field-terminals.js';
import {isDaliLoopSupply} from './dali-power.js';

const ABB_LINES = new Map([['abb-dg-s-1-64-5-1',1], ['abb-dg-s-2-64-5-1',2]]);
const ABB_DISTANCES = new Map([[0.5,100], [0.75,150], [1,200], [1.5,300]]);

export function isMdtBusSupply(product) {return product?.id === 'mdt-stc-0640-01';}
export function unsignedDaliFields(product) {return product?.id === 'lutron-lqse-2dal-d';}

export function abbDaliLines(product) {
  return ABB_LINES.get(product?.id) || 0;
}

export function daliFieldLineCount(product) {
  if (product?.id === 'crestron-din-dali-2' || product?.id === 'lutron-lqse-2dal-d') return 2;
  if (product?.id === 'crestron-din-dli') return 1;
  return abbDaliLines(product);
}

export function fieldLineLabel(product, loop) {
  return 'DALI ' + (abbDaliLines(product) ? ['A','B'][loop - 1] : loop);
}

export function fieldBudgetLabel(row,capacity) {
  return (row.devices ?? '待核')+' / 64 台 · '+(row.milliamps ?? '待核')+' / '+(capacity ?? '待核')+' mA';
}

export function daliCableSections(product) {
  if (unsignedDaliFields(product)) return [0.5,0.75,1.5];
  return product.id==='crestron-din-dali-2'?[0.5,0.75,0.82,1,1.5]:[0.5,0.75,1,1.5];
}

/** ABB technical data 2CDC507175D0211 Rev A, pp. 2–3, 6. */
export function abbPortTemplates(product) {
  const ports = [];
  const pin = (key, marking, conductor, side, offsetX, io) => {
    ports.push({key, marking, conductor, side, offsetX, io, minWire:0.2, maxWire:4});
  };
  for (let loop=1; loop<=abbDaliLines(product); loop++) {
    const letter = ['A','B'][loop - 1];
    for (const [index, polarity] of ['+','-'].entries()) {
      const number = 2 * loop + 1 + index;
      const terminal = polarity === '+' ? 'PLUS' : 'MINUS';
      pin('DALI'+loop+'_'+terminal, letter+'-'+number+'-DA'+polarity, 'BUS'+polarity, 'top', -28 + (number-3)*7, 'both');
    }
  }
  pin('L_IN','1-L','L','bottom',-28,'in');
  pin('N_IN','2-N','N','bottom',-21,'in');
  for (const [index, polarity] of ['-','+'].entries()) {
    ports.push({key:'BUS'+polarity, marking:'KNX'+polarity, conductor:'BUS'+polarity, side:'bottom', io:'both',
      offsetX:21 + index*5, minWire:0.5, maxWire:0.5});
  }
  return ports;
}

export function normalizeDaliFieldLoops(raw, product) {
  const loops = {};
  for (let i=1; i<=daliFieldLineCount(product); i++) {
    const saved = raw?.[i];
    if (!saved || typeof saved !== 'object') continue;
    const loop = {};
    for (const key of ['plus','minus','name']) {
      if (typeof saved[key] === 'string' && saved[key].trim()) loop[key] = saved[key].trim().slice(0,100);
    }
    for (const key of ['devices','milliamps','meters','section']) {
      if (saved[key] == null || saved[key] === '') continue;
      const value = Number(saved[key]);
      loop[key] = Number.isFinite(value) ? value : -1;
    }
    if (Object.keys(loop).length) loops[i] = loop;
  }
  return loops;
}

export function daliFieldCapacity(product, mod, loop, resolveModule) {
  if (abbDaliLines(product)) return 160;
  if (product.id === 'lutron-lqse-2dal-d') return 128;
  if (product.id === 'crestron-din-dli') return 170;
  const mode = mod.daliPowerMode ?? 'INT';
  if (mode === 'INT') return 150;
  if (mode !== 'EXT') return null;
  const psu = resolveModule(mod.daliLoopSupplies?.[loop]);
  return isDaliLoopSupply(psu) ? psu.psuOutput.milliamps ?? psu.psuOutput.amps * 1000 : null;
}

export function fieldLimitError(product, loop, capacity) {
  if (loop.devices != null && (!Number.isInteger(loop.devices) || loop.devices < 1 || loop.devices > 64)) return '每路应为 1–64 台 DALI 驱动器';
  if (loop.milliamps != null && (!(loop.milliamps > 0) || loop.milliamps > 250)) return '总线总电流须大于 0 且不超过 250 mA';
  if (capacity != null && loop.milliamps > capacity) return '总线总电流超过本路已核供电预算 '+capacity+' mA';
  if (loop.meters != null && !(loop.meters > 0)) return '已填线长须大于 0 m';
  if (loop.section != null && !daliCableSections(product).includes(loop.section)) return '请选择该型号支持的线芯截面积';
  if (abbDaliLines(product) && loop.meters > (ABB_DISTANCES.get(loop.section) ?? 300)) return '总线线长超过厂家规定的截面积对应距离';
  if (unsignedDaliFields(product) && loop.meters > (ABB_DISTANCES.get(loop.section) ?? 300)) return '按厂家线长表选用 0.5、0.75 或 1.5 mm²，分别最多 100、150 或 300 m';
  if (product.id==='crestron-din-dali-2' && loop.section===0.82 && loop.meters>155) return '18 AWG 时控制器至最远驱动器距离超过 155 m';
  if (product.id.startsWith('crestron-') && loop.meters>300) return 'DALI 设备间距离超过 300 m';
  return '';
}

export function validateDaliFields(design, mod, product, resolve) {
  const claims = fieldTerminalClaims(design);
  for (const [index, loop] of Object.entries(mod.daliFieldLoops || {})) {
    const findModule = id => resolve(design.modules.find(m=>m.id===id)?.productId);
    const capacity = daliFieldCapacity(product,mod,index,findModule);
    const issue = fieldLimitError(product,loop,capacity);
    if (issue) throw new Error(fieldLineLabel(product,index)+'：'+issue);
    for (const key of [loop.plus,loop.minus].filter(Boolean)) {
      if ((claims.get(key) || []).length > 1) throw new Error(key+' 已分配给其他芯线或负载');
    }
  }
}

export function wireDaliFieldLoops({design,nodes,ports,port,add,pending}) {
  const claims = fieldTerminalClaims(design);
  for (const mod of design.modules) {
    const gateway = nodes.get(mod.id);
    const product = gateway?.product;
    if (!daliFieldLineCount(product) || gateway.overflow) continue;
    if (abbDaliLines(product)) for (const template of abbPortTemplates(product)) port(mod.id,template.key);
    const unsigned=unsignedDaliFields(product);
    if (unsigned) for (const line of [1,2]) for (const pin of ['LEFT','RIGHT']) port(mod.id,'DALI'+line+'_'+pin);
    for (const [index,loop] of Object.entries(normalizeDaliFieldLoops(mod.daliFieldLoops,product))) {
      const title = mod.id+' '+fieldLineLabel(product,index);
      const report = (code,detail) => pending(code,title+'：'+detail,mod.id);
      const capacity = daliFieldCapacity(product,mod,index,id => nodes.get(id)?.product);
      const error = fieldLimitError(product,loop,capacity);
      if (error) { report('DALI_FIELD_LIMIT',error); continue; }
      if (!loop.plus || !loop.minus || [loop.plus,loop.minus].some(key=>(claims.get(key)||[]).length!==1)) {
        report('DALI_FIELD_TERMINALS','请选择两个不同且空闲的灰色出箱端子。');
        continue;
      }
      const pair = [['PLUS','+',loop.plus],['MINUS','-',loop.minus]].map(([pin,sign,target]) => {
        const suffix = product.id.startsWith('crestron-') ? '_2' : '';
        const key=unsigned?(pin==='PLUS'?'LEFT':'RIGHT'):pin, conductor=unsigned?'DA':'BUS'+sign;
        return {from:port(mod.id,'DALI'+index+'_'+key+suffix), to:fieldTerminalPort(nodes,target,conductor), conductor};
      });
      if (pair.some(p=>!p.from || !p.to)) {report('DALI_FIELD_TERMINALS','出箱端子被移除、设备溢出或接线位待核。'); continue;}
      if (capacity == null || loop.devices == null || loop.milliamps == null || loop.section == null || loop.meters == null) {
        report('DALI_FIELD_BUDGET_REVIEW','请核对驱动器数量、总线总电流、线长、截面积及本路供电额定。');
      }
      if (product.id.startsWith('crestron-') && loop.section && loop.meters &&
        !(product.id==='crestron-din-dali-2' && loop.section===0.82) && loop.section!==1.5) {
        report('DALI_FIELD_CABLE_REVIEW','当前截面积与线长组合需按线缆电阻和现场压降复核。');
      }
      for (const {from,to,conductor} of pair) {
        ports[to.id] = to;
        const destination = loop.name ? ' · '+loop.name : '';
        add(from.id,to.id,{material:'DALI 双线'},{conductor, class:'comms', section:loop.section ?? null,
          scope:title+' → 出箱端子'+destination+' · '+fieldBudgetLabel(loop,capacity)+(loop.meters?' · '+loop.meters+' m':''), moduleId:mod.id, daliLoop:Number(index), daliField:true});
      }
    }
  }
}
