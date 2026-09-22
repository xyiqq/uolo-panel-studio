import { productSku } from './domain.js';

// Delivery quantities describe the layout only. Catalog parameters stay in the internal BOM.
const DEVICE_NAMES = {
  mcb:'断路器', rcbo:'带漏电保护断路器', rccb:'漏电保护器', spd:'浪涌保护器',
  relay:'继电控制模块', dimmer:'调光模块', contactor:'接触器', timer:'定时控制器',
  meter:'计量模块', kwh:'计量模块', psu:'电源模块', gateway:'通信模块',
  switch:'网络交换机', networkSwitch:'网络交换机', 'network-switch':'网络交换机',
  pdu:'电源分配单元', terminal:'接线端子', fuse:'熔断器', isolator:'隔离开关',
};
const ACCESSORIES = {
  'DIN-RAIL':{name:'安装导轨',unit:'根',location:'箱内安装；长度与固定方式待现场确认'},
  'N-BAR':{name:'零线端子排',unit:'组',location:'零线连接；规格待确认'},
  'PE-BAR':{name:'保护接地端子排',unit:'组',location:'保护接地连接；规格待确认'},
  'X-TERM':{name:'出箱端子连接点',unit:'点',location:'按方案导体连接点统计；实物端子数量与规格待确认'},
  'BLANK-COVER':{name:'空位遮盖',unit:'模位',location:'按布置空位估算；盖板实际规格与数量待确认'},
  'WIRE-MARKER':{name:'导线标识',unit:'个',location:'按导线两端估算；标识耗材规格待确认'},
};
export const BOM_DELIVERY_NOTE='本清单仅统计布置中的通用设备类别与数量。模型不代表实际采购设备；厂家、型号、额定参数和价格未自动填写，须按实物或确认后的选型另行补充。';

function deviceName(product={}) {
  if(product.outletCount) return '电源分配单元';
  if(product.kind==='gateway' && product.networkPorts) return '网络通信设备';
  return DEVICE_NAMES[product.kind] || '设备（类型待核）';
}
function nodePosition(node) {
  const position=Number.isInteger(node.row)&&node.row>=0&&!node.overflow?`第 ${node.row+1} 排`:'位置待确认';
  return `${node.id || '未编号器件'} · ${position}`;
}

/** Safe shared view for the printed BOM and CSV; never forward catalog names, notes or specifications. */
export function buildBomDelivery(bom, {assembly}={}) {
  const nodesBySku=new Map();
  for(const node of assembly?.nodes || []) {
    if(!node.product) continue;
    const key=productSku(node.product)||node.product.id||node.id;
    if(!nodesBySku.has(key)) nodesBySku.set(key,[]);
    nodesBySku.get(key).push(node);
  }
  const items=(bom?.items||[]).filter(item=>Number.isFinite(item.qty)&&item.qty>0).map(item=>{
    const nodes=nodesBySku.get(item.sku)||[];
    if(nodes.length) return {name:[...new Set(nodes.map(n=>deviceName(n.product)))].join(' / '),qty:item.qty,unit:'个',location:nodes.map(nodePosition).join('；')};
    if(assembly?.box && item.sku===(assembly.box.id||'CABINET')) return {name:'配电箱体',qty:item.qty,unit:'台',location:'安装位置及实际尺寸待确认'};
    const accessory=ACCESSORIES[item.sku];
    return {name:accessory?.name||'设备（类型待核）',qty:item.qty,unit:accessory?.unit||'个',location:accessory?.location||'用途与安装位置待确认'};
  });
  const wireGroups=new Map();
  for(const w of bom?.wires||[]) {
    const external=w.lengthKind==='external';
    const bus=!w.lengthKind;
    const row={
      name:bus?'总线电缆':external?'出箱电缆芯线':'箱内连接导线',
      qty:Number.isFinite(w.meters)&&w.meters>=0?w.meters:null,
      unit:'m',
      location:bus?'按方案录入长度汇总；走向、实长及线缆规格待核':external?'按回路长度逐芯估算，非成品多芯电缆采购米数；实长及规格待核':'按布置端点距离和余量估算；实长、截面及规格待核',
    };
    const previous=wireGroups.get(row.name);
    if(previous) previous.qty=previous.qty===null||row.qty===null?null:previous.qty+row.qty;
    else wireGroups.set(row.name,row);
  }
  const wires=[...wireGroups.values()].map(row=>({...row,qty:row.qty===null?null:Number(row.qty.toFixed(2))}));
  return {items,wires,note:BOM_DELIVERY_NOTE};
}
