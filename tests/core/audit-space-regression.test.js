import {describe,it,expect} from 'vitest';
import {auditElectrical} from '../../src/core/audit/electrical.js';
import {auditSmart} from '../../src/core/audit/smart.js';
import {computeSpace} from '../../src/core/space.js';
const cabinet={id:'box',rows:3,slots:12,pitch:150,depth:150,rowClearance:105,maxDeviceDepth:125,slotWidth:18};
const product={id:'device',width:36,height:90,depth:60,heatW:2};
const assembly=p=>({box:cabinet,nodes:[{id:'M1',product:{...product,...p}}]});
const codes=issues=>issues.map(i=>i.code);
describe('空间审计与推荐一致',()=>{
  it('已知尺寸合适，但温升仍待核',()=>{
    const a=assembly({});
    expect(computeSpace({},a,[cabinet]).recommendations[0].fits).toBe(true);
    expect(auditSmart({},a).filter(i=>i.level==='error')).toEqual([]);
    expect(codes(auditSmart({},a))).toContain('SPACE_THERMAL_REVIEW');
  });
  it.each([[{height:106},'SPACE_HEIGHT'],[{depth:126},'SPACE_DEPTH'],[{width:217},'SPACE_WIDTH']])('尺寸超限拒绝推荐且定位器件 %o',(change,code)=>{
    const a=assembly(change);
    expect(computeSpace({},a,[cabinet]).recommendations[0].fits).toBe(false);
    expect(auditSmart({},a)).toEqual(expect.arrayContaining([expect.objectContaining({code,ref:'M1',level:'error'})]));
  });
  it('未知尺寸不作零，热耗明确待核',()=>{
    const a=assembly({height:null,depth:null,heatW:null});
    expect(computeSpace({},a,[cabinet])).toMatchObject({heightUnknown:1,depthUnknown:1,heatUnknown:1});
    expect(computeSpace({},a,[cabinet]).recommendations[0]).toMatchObject({fits:false,dimensionsKnown:false});
    expect(codes(auditSmart({},a))).toEqual(expect.arrayContaining(['PRODUCT_HEIGHT_UNKNOWN','PRODUCT_DEPTH_UNKNOWN','PRODUCT_HEAT_UNKNOWN']));
  });
  it('控制区竖向PDU按候选排距重算，不重复计入强电区',()=>{
    const a=assembly({outletCount:8,pduOrientation:'vertical',height:400,width:100,zone:'control'});
    const space=computeSpace({spareRatio:0},a,[{...cabinet,id:'wide-pitch',pitch:200,rows:2}]);
    expect(space.rowsPower).toBe(0);expect(space.rowsNeeded).toBe(3);
    expect(space.recommendations[0]).toMatchObject({fits:true,rowsPower:0,rowsNeeded:2});
  });
  it('候选箱体使用自己的模宽',()=>{
    const a=assembly({width:220});
    const results=computeSpace({spareRatio:0},a,[cabinet,{...cabinet,id:'wide',slotWidth:20}]).recommendations;
    expect(results.find(r=>r.cabinet.id==='box').fits).toBe(false);
    expect(results.find(r=>r.cabinet.id==='wide').fits).toBe(true);
  });
});
function electrical({extraUnknown=false,wire={},watts=220,pf=1,voltage=220,breakerAmps=6}={}){
  const design={modules:[{id:'K1',feed:'shared',channels:{1:'C1',...(extraUnknown?{2:'C2'}:{})}}],circuits:[{id:'C1',loadIds:['L1'],pf,voltage}],loads:[{id:'L1',watts}]};
  const a={nodes:[{id:'K1',product:{kind:'relay',powerInput:'LN',channelAmps:5,totalAmps:10}},{id:'B1',product:{amps:breakerAmps,residual:30}}]};
  return auditElectrical(design,a,{moduleFeedBindings:[{moduleId:'K1',breakerId:'B1'}],wires:[{id:'N1',to:'K1:N_IN',...wire}]});
}
describe('电气校核边界',()=>{
  it('停用导线或火线不能满足零线要求',()=>{
    expect(codes(electrical({wire:{connected:false}}))).toContain('MODULE_NEUTRAL_MISSING');
    expect(codes(electrical({wire:{conductor:'L1'}}))).toContain('MODULE_NEUTRAL_MISSING');
    expect(codes(electrical())).not.toContain('MODULE_NEUTRAL_MISSING');
  });
  it('部分未知不掩盖已知负荷总和超载',()=>{
    expect(codes(electrical({watts:3300,extraUnknown:true}))).toEqual(expect.arrayContaining(['MODULE_TOTAL_OVERCURRENT','CHANNEL_LOAD_UNKNOWN']));
  });
  it.each([{watts:-1},{pf:2},{pf:Infinity},{voltage:24}])('非法输入待核 %o',input=>{
    expect(codes(electrical(input))).toContain('CHANNEL_LOAD_UNKNOWN');
    expect(codes(electrical(input))).not.toContain('CHANNEL_OVERCURRENT');
  });
  it('上游保护器额定未知时待核',()=>{expect(codes(electrical({breakerAmps:null}))).toContain('MODULE_PROTECTION_UNKNOWN');});
});
