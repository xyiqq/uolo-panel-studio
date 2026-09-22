import {makeSmartProduct} from './_smart-factory.js';
import {MEANWELL_PSU_PRODUCTS} from './psu-meanwell.js';

// User-specified enclosure reference; electrical ratings are not inherited from the PSU.
const reference=MEANWELL_PSU_PRODUCTS.find(product=>product.id==='meanwell-hdr-100-24n');
export const USMART_PRODUCTS=[2,4].map(count=>({
  ...makeSmartProduct({
    id:`usmart-din-tcp-${count}rs485`,brand:'USMART',
    name:`DIN-TCP · ${count}路 RS-485`,sku:`DIN-TCP (${count}×RS-485)`,
    kind:'gateway',zone:'control',protocol:['ethernet','rs485'],
    width:reference.width,height:reference.height,depth:reference.depth,modules:reference.modules,
    color:'#468c91',availability:'用户指定尺寸与接口；电气参数待核',
    source:{file:'用户配置要求：外形参照 HDR-100-24N',url:null,pages:null},
    note:`1 个网口、${count} 个 RS-485 口。按用户要求参照 HDR-100-24N 外形建模：70×90×54.5 mm，预留 4M。端口位置为示意，供电电压、功耗、针脚与电气额定待确认。`,
  }),
  interfaceProfile:'din-tcp',ethernetPorts:1,serialPorts:count,
}));
