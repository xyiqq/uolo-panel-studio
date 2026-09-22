import {describe,it,expect} from 'vitest';
import {createBreakerPackDesign,createBlankDesign} from '../../src/data/design-templates.js';
import {validateDesign,buildAssembly,buildWiring,allProducts} from '../../src/core/domain.js';
import {compactModulePlacement} from '../../src/core/modules.js';
import {rowAllows,rowZoneIssues} from '../../src/core/row-zones.js';
import {setFeatureVisible,featureVisible} from '../../src/core/feature-settings.js';
import {saveBus,deleteBus} from '../../src/core/bus-editor.js';
import {computeBusBudgets} from '../../src/core/buses.js';
import {auditElectrical} from '../../src/core/audit/electrical.js';
import {buildBom} from '../../src/core/bom.js';

describe('独立开关与分排',()=>{
  it('导入异常可选字段时回退，不破坏旧方案加载',()=>{
    const d=validateDesign(createBlankDesign({rowZones:'power',featureVisibility:{busEditor:'true',electricalAudit:true}}));
    expect(d.rowZones).toEqual([]);expect(featureVisible(d,'busEditor')).toBe(false);expect(featureVisible(d,'electricalAudit')).toBe(true);
  });
  it('开关分别保存，隐藏不清理业务配置，旧方案默认隐藏',()=>{
    const d=createBlankDesign({rowZones:['power','control'],buses:[]});
    expect(featureVisible(d,'busEditor')).toBe(false);
    setFeatureVisible(d,'busEditor',true);setFeatureVisible(d,'electricalAudit',true);setFeatureVisible(d,'busEditor',false);
    const loaded=validateDesign(JSON.parse(JSON.stringify(d)));
    expect(featureVisible(loaded,'electricalAudit')).toBe(true);
    expect(featureVisible(loaded,'busEditor')).toBe(false);
    expect(loaded.rowZones).toEqual(['power','control']);
  });
  it('自动排布和紧邻排布共同遵守强弱电分区，手动冲突可定位',()=>{
    const d=createBreakerPackDesign({count:3});d.rowZones=['power','control','power','control','power','control'];
    d.modules=[{id:'GW1',productId:'reyee-rg-es108gd',position:{row:0,slot:12}},{id:'GW2',productId:'reyee-rg-es105gd'}];
    const a=compactModulePlacement(buildAssembly(d),d);
    expect(a.nodes.every(n=>!n.overflow&&rowAllows(d,n.product,n.row))).toBe(true);
    expect(a.nodes.find(n=>n.id==='GW1').row).toBe(1);
    expect(rowZoneIssues(d,a).some(i=>i.ref==='GW1'&&i.code==='ROW_ZONE_CONFLICT')).toBe(true);
  });
  it('无兼容排则溢出，不能偷偷塞入强电排',()=>{
    const d=createBlankDesign({rowZones:Array(6).fill('power'),modules:[{id:'GW1',productId:'reyee-rg-es105gd'}]});
    const a=compactModulePlacement(buildAssembly(d),d);
    expect(a.nodes.find(n=>n.id==='GW1').overflow).toBe(true);
    expect(rowZoneIssues(d,a).some(i=>i.code==='ROW_ZONE_CAPACITY')).toBe(true);
  });
});

describe('总线编辑和预算',()=>{
  const products=[{id:'ps',kind:'psu',psuOutput:{voltage:24,watts:24}},{id:'dev',kind:'gateway',busConsumption:{unit:'mA',value:500}}];
  const resolve=id=>products.find(p=>p.id===id);
  const fixture=()=>({modules:[{id:'PS1',productId:'ps'},{id:'GW1',productId:'dev'}],buses:[]});
  const input={type:'dc',label:'24V 控制电源',voltage:24,budgetUnit:'W',capacity:null,psuModuleIds:['PS1'],deviceModuleIds:['GW1'],section:1.5,cableSpec:'RVV 2×1.5',cableMeters:12};
  it('保存同步双向关联、单位换算，删除清理关联但保留模块',()=>{
    const d=fixture(),b=saveBus(d,input,resolve);
    expect(d.modules.every(m=>m.busId===b.id)).toBe(true);
    expect(computeBusBudgets(d,products)[0]).toMatchObject({used:12,capacity:24,usedKnown:true,unit:'W'});
    deleteBus(d,b.id);expect(d.modules).toHaveLength(2);expect(d.modules.every(m=>m.busId===null)).toBe(true);
  });
  it('失败不部分写入，不允许跨总线重复归属',()=>{
    const d=fixture();saveBus(d,input,resolve);const before=structuredClone(d);
    expect(()=>saveBus(d,{...input,id:'B2'},resolve)).toThrow('其他总线');expect(d).toEqual(before);
    expect(()=>saveBus(d,{...input,id:d.buses[0].id,section:-1},resolve)).toThrow();expect(d).toEqual(before);
  });
  it('未知设备消耗不当成零，多电源不默认并联，缺电压不混算',()=>{
    const d=fixture();saveBus(d,input,resolve);
    expect(computeBusBudgets(d,[products[0],{id:'dev'}])[0]).toMatchObject({used:null,usedKnown:false});
    d.buses[0].psuModuleIds.push('PS2');d.modules.push({id:'PS2',productId:'ps'});
    expect(computeBusBudgets(d,products)[0].capacity).toBeNull();
    d.buses[0].voltage=null;
    expect(computeBusBudgets(d,products)[0].used).toBeNull();
    d.buses[0].type='dali';d.buses[0].capacity=20;
    expect(computeBusBudgets(d,products)[0].capacity).toBeNull();
  });
  it('线缆规格与长度保存重载进入 BOM，同协议不同规格不合并',()=>{
    const d=createBlankDesign();d.buses=[{id:'B1',type:'dc',label:'1',cableSpec:'RVV 2×1.5',section:1.5,cableMeters:10},{id:'B2',type:'dc',label:'2',cableSpec:'RVV 2×2.5',section:2.5,cableMeters:20}];
    const loaded=validateDesign(JSON.parse(JSON.stringify(d))),a=buildAssembly(loaded),bom=buildBom(loaded,a,buildWiring(loaded,a));
    const wires=bom.wires.filter(w=>w.note.includes('总线电缆'));
    expect(wires).toHaveLength(2);expect(wires.map(w=>w.meters)).toEqual([10,20]);expect(wires[0].note).toContain('RVV 2×1.5');
  });
  it('部分消耗未知时仍报告已知负荷下限超预算，未知总量不变成零',()=>{
    const d=fixture();d.modules.push({id:'GW2',productId:'unknown'});
    saveBus(d,{...input,capacity:10},resolve);
    d.buses[0].deviceModuleIds.push('GW2');
    expect(computeBusBudgets(d,products)[0]).toMatchObject({used:null,usedKnown:false,knownUsed:12,capacity:10,overBudget:true});
    d.buses[0].capacity=24;
    expect(computeBusBudgets(d,products)[0]).toMatchObject({used:null,usedKnown:false,overBudget:false});
  });
});

describe('电气规则正反例',()=>{
  function check({watts=220,channelAmps=5,totalAmps=10,breakerAmps=6,neutral=true,unknown=false}={}){
    const design={modules:[{id:'K1',productId:'relay',channels:{1:'C1'},feed:'shared'}],circuits:[{id:'C1',voltage:220,pf:1,loadIds:['L1']}],loads:unknown?[]:[{id:'L1',watts,enabled:true}],buses:[]};
    const nodes=[{id:'K1',product:{id:'relay',kind:'relay',powerInput:'LN',channelAmps,totalAmps}},{id:'C1',product:{kind:'rcbo',amps:breakerAmps,residual:30}}];
    const net={moduleFeedBindings:[{moduleId:'K1',breakerId:'C1'}],wires:neutral?[{id:'N',to:'K1:N_IN'}]:[]};
    return auditElectrical(design,{nodes},net).map(i=>i.code);
  }
  it('正常配合无超载、缺零错误',()=>{expect(check()).toEqual([]);});
  it('定位通道超载、总额定超载、保护不匹配与缺零',()=>{
    expect(check({watts:3300,channelAmps:5,totalAmps:10,breakerAmps:16,neutral:false})).toEqual(expect.arrayContaining(['CHANNEL_OVERCURRENT','MODULE_TOTAL_OVERCURRENT','MODULE_PROTECTION_RATING','MODULE_NEUTRAL_MISSING']));
  });
  it('未录入负荷和额定明确待核',()=>{expect(check({unknown:true,totalAmps:null})).toEqual(expect.arrayContaining(['CHANNEL_LOAD_UNKNOWN','MODULE_TOTAL_UNKNOWN','MODULE_PROTECTION_UNKNOWN']));});
  it('直流80%提醒有明确阈值，未知预算保持待核',()=>{
    const inspect=b=>auditElectrical({modules:[],buses:[]},{nodes:[]},{},[b]).map(i=>i.code);
    expect(inspect({type:'dc',utilization:.81,usedKnown:true,capacityKnown:true})).toContain('DC_RESERVE');
    expect(inspect({type:'dc',utilization:.8,usedKnown:true,capacityKnown:true})).not.toContain('DC_RESERVE');
    expect(inspect({type:'dc',usedKnown:false,capacityKnown:true})).toContain('BUS_PARAMETERS_UNKNOWN');
  });
});
