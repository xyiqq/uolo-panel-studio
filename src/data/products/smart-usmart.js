import {makeSmartProduct} from './_smart-factory.js';
import {MEANWELL_PSU_PRODUCTS} from './psu-meanwell.js';

// User-specified enclosure reference. The enclosure reference supplies only the
// DIN footprint; the controller's 24 VDC input is explicitly supplied by the user.
const reference=MEANWELL_PSU_PRODUCTS.find(product=>product.id==='meanwell-hdr-100-24n');
if(!reference) throw new Error('USMART DIN-TCP 缺少外形参照 meanwell-hdr-100-24n');
export const USMART_PRODUCTS=[2,4].map(count=>({
  ...makeSmartProduct({
    id:`usmart-din-tcp-${count}rs485`,brand:'USMART',
    name:`DIN-TCP · ${count}路 RS-485`,sku:`DIN-TCP (${count}×RS-485)`,
    kind:'gateway',zone:'control',protocol:['ethernet','rs485'],
    width:reference.width,height:reference.height,depth:reference.depth,modules:reference.modules,
    color:'#303638',powerInput:'24vdc',availability:'用户提供实物照片与接口说明；外形按参照建模，电气额定部分待核',
    source:{file:'用户提供实物照片与接口说明：USMART DIN-TCP',url:null,pages:null},
    note:`24V DC 供电；1 个 LAN 网口、${count} 个 RS-485 口（${count===4?'上方 3 个、下方 1 个':'按 2 路版本端子布局示意'}）。外形参照 HDR-100-24N：70×90×54.5 mm，预留 4M；功耗、端子针脚和通信距离仍待厂家资料确认。`,
  }),
  interfaceProfile:'din-tcp',ethernetPorts:1,ethernetPortLabels:['LAN'],serialPorts:count,
  serialPortLabels:Array.from({length:count},(_,i)=>`485-${i+1}`),
  serialPortLayout:count===4?['top','top','top','bottom']:['top','bottom'],
}));
