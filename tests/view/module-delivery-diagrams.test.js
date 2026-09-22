import { describe, it, expect } from 'vitest';
import { renderSystemDiagram } from '../../src/view/system-diagram.js';
import { renderDoorChart } from '../../src/view/documents/door-chart.js';
import { circuitModuleChannels, moduleDeliveryLinks } from '../../src/view/module-delivery-links.js';

const circuit = {id:'C01',name:'客厅',devices:[{moduleId:'K1',channel:7}]};
const design = {name:'测试',circuits:[circuit],modules:[
  {id:'K1',productId:'relay',channels:{7:'C01',8:'C02'}},
  {id:'D1',productId:'dimmer',channels:{3:'C01'}},
  {id:'T1',terminalConnections:{1:{output:'K1:CH7_OUT',loadName:'灯 <客厅>',wireNo:'L07',section:1.5}}},
]};
const net = {moduleFeedBindings:[{moduleId:'K1',breakerId:'Q1',sourceId:'Q1',phase:'L1'}],wires:[
  {moduleFeed:true,moduleId:'K1',from:'Q1:L_OUT',to:'K1:L_IN',section:2.5},
  {terminalConnection:true,moduleId:'K1',terminalId:'T1',from:'K1:CH7_OUT',to:'T1:1',wireNo:'L07',section:1.5},
]};

describe('模块交付关系图',()=>{
  it('共享模块及非第一通道从 channels/devices 合并去重',()=>{
    expect(circuitModuleChannels(design,circuit)).toEqual([{moduleId:'K1',channel:'7'},{moduleId:'D1',channel:'3'}]);
    const rows=moduleDeliveryLinks(design,net);
    expect(rows.filter(r=>r.to==='T1:1')).toHaveLength(1);
    const pages=renderSystemDiagram(design,{nodes:[]},net).pages;
    expect(pages).toHaveLength(2);
    expect(pages[1]).toContain('data-link-from="K1:CH7_OUT" data-link-to="T1:1"');
    expect(pages[1]).toContain('Q1:L_OUT');
    const door=renderDoorChart({design,assembly:{nodes:[]},net});
    expect(door).toContain('K1 CH7 / D1 CH3');
    expect(door).toContain('T1:1');
    expect(door).toContain('L07');
  });
  it('简单模式只保存端子关联也输出完整链路并转义',()=>{
    const simple={...design,uiMode:'simple',circuits:[]};
    const pages=renderSystemDiagram(simple,{nodes:[]},{}).pages;
    expect(pages[1]).toContain('K1:CH7_OUT');
    expect(pages[1]).toContain('灯 &lt;客厅&gt;');
    expect(pages[1]).not.toContain('灯 <客厅>');
  });
  it('大量链路分页无丢失，页码包含附页',()=>{
    const many={...design,circuits:[],modules:[{id:'T1',terminalConnections:Object.fromEntries(Array.from({length:100},(_,i)=>[i+1,{output:`K1:CH${i+1}_OUT`,wireNo:`L${i+1}`,section:1.5}]))}]};
    const pages=renderSystemDiagram(many,{nodes:[]},{}).pages;
    expect(pages.length).toBeGreaterThan(5);
    expect(pages.join('').match(/data-link-from=/g)).toHaveLength(100);
    pages.forEach((page,i)=>expect(page).toContain(`第 ${i+1} / ${pages.length} 页`));
    const door=renderDoorChart({design:many,assembly:{nodes:[]}});
    expect(door.match(/箱门表 · 模块与端子链路/g)).toHaveLength(5);
    expect(door).toContain('L100');
  });
  it('总线使用真实产品预算，不读取存档中不存在的 used',()=>{
    const d={...design,modules:[{id:'PS1',productId:'ps'},{id:'K1',productId:'relay'}],circuits:[],buses:[{id:'BUS1',type:'cresnet',psuModuleIds:['PS1'],deviceModuleIds:['K1'],used:999}]};
    const assembly={nodes:[{product:{id:'ps',psuOutput:{watts:24}}},{product:{id:'relay',busConsumption:{value:3,unit:'W'}}}]};
    const pages=renderSystemDiagram(d,assembly,{}).pages;
    expect(pages.join('')).toContain('预算 3/24 W');
    expect(pages.join('')).not.toContain('999');
  });
  it('完整模块线链包含通道、电表、直流、总线规格和待核问题',()=>{
    const n={wires:[
      {id:'module-wire:K1>M1',from:'K1:CH7_OUT',to:'M1:L_IN',scope:'控制器 → 电表',section:1.5},
      {id:'module-wire:M1>X1',from:'M1:L_OUT',to:'X-C01:L1',scope:'模块链 → 出箱端子',section:2.5},
      {id:'module-wire:PS1>K1',from:'PS1:24V',to:'K1:24V',class:'dc',scope:'24V 直流供电',section:.75},
      {id:'module-wire:GW1>K1',from:'GW1:BUS',to:'K1:BUS',class:'comms',scope:'CRESNET 总线',section:'Cresnet 四芯线'},
    ],wiringIssues:[{code:'BUS_PENDING',text:'通信电源待核 <待选>'}]};
    const pages=renderSystemDiagram({...design,circuits:[],modules:[]},{nodes:[]},n).pages.join('');
    for(const scope of ['控制器 → 电表','模块链 → 出箱端子','24V 直流供电','CRESNET 总线']) expect(pages).toContain(scope.replace('>','&gt;'));
    expect(pages).toContain('Cresnet 四芯线');
    expect(pages).not.toContain('Cresnet 四芯线 mm²');
    expect(pages).toContain('1.5 mm²');
    expect(pages).toContain('配线待核');
    expect(pages).toContain('通信电源待核 &lt;待选&gt;');
  });
});
