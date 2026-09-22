import { makeSmartProduct } from './_smart-factory.js';

// 锐捷睿易官网：5/8口采用2025版ES100彩页，16口采用ES116G-E彩页。
// 尺寸由厂家 W/D/H 转为本项目 W/H/D；不沿用旧品牌的外形参数。
const compactSource={file:'锐捷睿易 RG-ES100系列产品彩页（2025-11）',pages:'4',url:'https://cp.ruijiery.com/uploadfile/article/202511218085140-%E3%80%90%E4%BA%A7%E5%93%81%E5%BD%A9%E9%A1%B5%E3%80%91rg-es100%E7%B3%BB%E5%88%97%20%E4%BA%A4%E6%8D%A2%E6%9C%BA.pdf'};
const rackSource={file:'锐捷睿易 RG-ES116G-E 产品彩页',pages:'5–6',url:'https://cp.ruijiery.com/uploadfile/article/202405087070629-rg-es116g-e%E4%BA%A7%E5%93%81%E5%BD%A9%E9%A1%B5.pdf'};
export const NETWORK_SWITCH_PRODUCTS = [
  [5,'RG-ES105GD',119,24,75,5],
  [8,'RG-ES108GD',160,24,75,5],
  [16,'RG-ES116G-E',280,44,126,12],
].map(([ports,sku,width,height,depth,watts])=>({
  ...makeSmartProduct({id:`reyee-${sku.toLowerCase()}`,sku,name:`${ports}口交换机`,brand:'锐捷睿易',kind:'gateway',zone:'control',protocol:['ethernet'],channels:0,powerInput:ports===16?'ac-inlet':'external-adapter',width,height,depth,modules:Math.ceil(width/18),color:'#3c3c3e',source:ports===16?rackSource:compactSource,
    availability:'外形、端口和供电已按锐捷睿易官网资料核验',
    note:`锐捷睿易非 PoE、非网管交换机；${ports===16?'支持桌面、壁挂及机架安装；内置电源，后部交流插口 100–240V AC。':'金属小机身；前部 DC 插口，外置 5V DC / 1A 适配器。'}柜内需托板或支架；模位仅为横向预留，不代表原生 DIN 安装，电源线及网线弯曲空间另预留。`}),
  networkPorts:ports,networkPortRows:ports===16?2:1,mounting:'shelf',maxPowerW:watts,poe:false,managed:false,
}));

NETWORK_SWITCH_PRODUCTS.push({
  ...makeSmartProduct({id:'reyee-rg-eg210g-p-e-v2',sku:'RG-EG210G-P-E V2',name:'10口PoE一体网关',brand:'锐捷睿易',kind:'gateway',zone:'control',protocol:['ethernet','poe'],channels:0,
    powerInput:'external-adapter',width:202,height:28,depth:108,modules:12,color:'#3c3c3e',
    availability:'外形、接口与供电已按官网 V2 彩页核验',
    source:{file:'RG-EG210G-P-E V2 产品彩页',pages:'2、4、9',url:'https://cp.ruijiery.com/UploadFile/Article/202408132024721-RG-EG210G-P-E%20V2%E4%BA%A7%E5%93%81%E5%BD%A9%E9%A1%B5.pdf'},
    note:'10个千兆电口：6个固定LAN、3个LAN/WAN可切换、1个固定WAN；前8口支持802.3af/at，整机PoE预算110W、单口上限30W。外置54V DC / 2.4A适配器。202×108×28mm为V2机身尺寸（高度不含脚垫），柜内需托板及电源、线缆空间。'}),
  networkPorts:10,networkPortRows:1,networkProfile:'eg210gpe-v2',networkDeviceLabel:'10口PoE一体网关',networkLabelColumns:5,
  networkPortNames:['LAN0','LAN1','LAN2','LAN3','LAN4','LAN5','LAN6/WAN3','LAN7/WAN2','LAN8/WAN1','WAN0'],
  poePorts:[1,2,3,4,5,6,7,8],poeBudgetW:110,poePortMaxW:30,adapterVoltage:54,adapterAmps:2.4,
  searchAliases:'210GPE 210G-P-E RG-EG210G-P-E V2',mounting:'shelf',maxPowerW:130,poe:true,managed:true,
});

// 保留已保存方案的模块编号、备注和位置，只迁移本轮被替换的三款设备。
const PREVIOUS_SWITCHES={'tplink-tl-sg105':0,'tplink-tl-sg108':1,'tplink-tl-sg116':2};
export function migrateNetworkSwitches(design) {
  for(const mod of Array.isArray(design?.modules)?design.modules:[]) {
    if(!mod||typeof mod!=='object')continue;
    if(Object.hasOwn(PREVIOUS_SWITCHES,mod.productId)){
      const oldSku=mod.productId.slice(7).toUpperCase(),p=NETWORK_SWITCH_PRODUCTS[PREVIOUS_SWITCHES[mod.productId]];
      mod.productId=p.id;
      if(typeof mod.label==='string')mod.label=mod.label.replace(oldSku,p.sku);
    }
    const p=NETWORK_SWITCH_PRODUCTS.find(p=>p.id===mod.productId);
    if(p && [`${mod.id} ${p.sku}`,`${mod.id} ${p.sku} · ${p.networkPorts}口千兆交换机`].includes(mod.label))mod.label=`${mod.id} ${p.name}`;
  }
  return design;
}
