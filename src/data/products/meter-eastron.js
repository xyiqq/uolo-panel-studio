import {makeSmartProduct} from './_smart-factory.js';

export const SDM630_V2=makeSmartProduct({
  id:'eastron-sdm630-modbus-v2',brand:'Eastron',name:'SDM630-Modbus V2',sku:'SDM630-Modbus V2',
  kind:'meter',channels:1,zone:'control',poles:4,amps:100,width:72,height:100,depth:66,modules:4,
  protocol:['rs485'],powerInput:'3P4W',meter:{type:'direct'},
  availability:'已核验 · 三相四线直入式',
  note:'三相四线 230/400 V 直入式电表，最大 100 A。1–4 为 L1/L2/L3/N 输入，5–8 为对应输出，PE 直通负载。RS-485 端子与强电计量分开。',
  source:{file:'Eastron SDM630 Series Datasheet',url:'https://www.eastrongroup.com/eastrongroup/2024/08/10/eastronsdm630seriesdinrailmounted;threephase;100adatasheet.pdf',pages:'p2 Wiring Diagram · 3P4W'},
});
