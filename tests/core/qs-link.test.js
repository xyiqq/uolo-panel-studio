import {describe,it,expect} from 'vitest';
import {createBreakerPackDesign,materializeTemplate,snapshotDesignTemplate} from '../../src/data/design-templates.js';
import {validateDesign,buildWiring,findProduct} from '../../src/core/domain.js';
import {QS_HARNESS,qsProblems,qsSummary,ethernetProblem,qsTerminalTemplates} from '../../src/core/qs-link.js';
import {savePsuConnections} from '../../src/core/psu-connections.js';
import {removeModule} from '../../src/core/modules.js';
import {saveBus} from '../../src/core/bus-editor.js';

function design() {
  const d=createBreakerPackDesign({count:5,productId:'A9D32610',name:'QSX'});
  d.modules=[
    {id:'P1',productId:'lutron-hqp7-2',qsConfig:{supplyId:'PS',nextProcessorId:'P2',ethernetMeters:12,links:{
      1:{members:['D1','D2'],terminalId:'T1',meters:24,fieldSupplyId:'@link',fieldPdu:20,fieldMa:350,fieldDevices:12,fieldOutputs:48},
      2:{members:['D3'],terminalId:'T2',meters:60,fieldSupplyId:'PF',fieldPdu:16,fieldMa:600,fieldDevices:10,fieldOutputs:72}}}},
    {id:'P2',productId:'lutron-hqp7-1'},
    {id:'PS',productId:QS_HARNESS,protectId:'C01'},{id:'PF',productId:'lutron-qsps-dh-1-75',protectId:'C02'},
    {id:'D1',productId:'lutron-lqse-4s10-d',protectId:'C03'},
    {id:'D2',productId:'lutron-lqse-4t10-d',protectId:'C04'}, {id:'D3',productId:'lutron-lqse-2dal-d',protectId:'C05'},
    ...['T1','T2'].map(id=>({id,productId:'phoenix-pt25-gy-4'}))];
  return validateDesign(d);
}
const problems=d=>qsProblems(d,d.modules[0],pid=>findProduct(d,pid));
describe('Lutron HomeWorks QS wired links',()=>{
  it('restores independent processor and field power groups, separate link budgets and the sequenced three-wire receiver chain',()=>{
    const d=materializeTemplate(snapshotDesignTemplate(design(),'QS'));
    expect(problems(d)).toEqual({errors:[],pending:[]});
    const n=buildWiring(d),w=n.wires.filter(w=>w.qsLink);
    expect(w.map(w=>w.from+'>'+w.to)).toEqual(expect.arrayContaining([
      'PS:DC+>P1:DC+','PS:MINUS2>P1:DC-','PS:PLUS2>P1:PWR_L1','P1:QS1_2>T1:2',
      'P1:QS1_3>D1:QS_3','D1:QS_3>D2:QS_3','D2:QS_3>T1:3','P1:QS2_4>D3:QS_4','D3:QS_4>T2:4',
      'D3:QS_1>PF:DC-','PF:MINUS2>T2:1','PF:DC+>T2:2','P1:ETH2>P2:ETH1']));
    expect(w.every(w=>n.ports[w.from]&&n.ports[w.to])).toBe(true);
    expect(w.some(w=>w.from==='P1:QS2_2'||w.to==='P1:PWR_L2')).toBe(false);
    expect(n.ports['D1:QS_2']).toBeUndefined();
    expect(n.ports['P1:L1_IN']).toBeUndefined();
    expect(n.ports['D1:CH1_IN']).toMatchObject({side:'bottom',displayTag:'D1.Z1-L'});
    expect(n.ports['D2:CH4_MINUS']).toMatchObject({side:'top',conductor:'0-10V-'});
    expect(n.ports['D3:DALI1_LEFT']).toMatchObject({conductor:'DA'});
    expect(n.wires.filter(w=>w.to==='D2:PE_IN')).toHaveLength(1);
    expect(n.internal.some(l=>l.a==='P1:PWR_L2'&&l.b==='P1:QS2_2')).toBe(true);
    expect(qsSummary(d.modules[0])[0].detail).toContain('28 / 75 PDU，600 / 2500 mA');
  });
  it('preserves missing budgets as pending and rejects crossed power groups, oversize links and reused PT slices',()=>{
    const d=design(), host=d.modules[0],l=host.qsConfig.links[1];
    l.fieldMa=null;
    expect(problems(d).pending.join(' ')).toContain('mA');
    Object.assign(l,{fieldPdu:75,fieldMa:1001,fieldDevices:99,fieldOutputs:512,meters:611});
    expect(problems(d).errors).toHaveLength(5);
    d.modules.find(m=>m.id==='T1').terminalConnections={1:{output:'D1:CH2_OUT'}};
    expect(problems(d).errors.join(' ')).toContain('T1:1 已被占用');
    host.qsConfig.supplyId='PF';
    expect(problems(d).errors.join(' ')).toContain('QSPS-DH-1-75-H');
    const n=buildWiring(d);
    expect(n.wires.filter(w=>w.qsLink && w.class!=='network')).toHaveLength(0);
  });
  it('uses the installed receiver’s 600 m limit on a switching link and 610 m on a DALI link',()=>{
    const d=design(), links=d.modules[0].qsConfig.links;
    links[1].meters=601;links[2].meters=610;
    expect(problems(d).errors).toEqual(['QS L1 累计线长须大于 0 且不超过 600 m']);
  });
  it('prohibits duplicate members and concurrent generic PSU assignment',()=>{
    const d=design();d.modules[0].qsConfig.links[2].members.push('D1');
    expect(problems(d).errors.join(' ')).toContain('归属冲突');
    expect(()=>savePsuConnections(d,'PF',findProduct(d,'lutron-qsps-dh-1-75'),['P2'])).toThrow('QS');
    expect(()=>savePsuConnections(d,'ANOTHER',{kind:'psu',psuOutput:{voltage:24}},['P1'])).toThrow('QS');
  });
  it('prevents conflicting assignments in both edit directions and with imported legacy module.busId assignments',()=>{
    const d=design(),resolve=id=>findProduct(d,id);
    const input={id:'DCX',type:'dc',psuModuleIds:['PF'],deviceModuleIds:['P2']};
    expect(()=>saveBus(d,input,resolve)).toThrow('HQP7');
    expect(()=>saveBus(d,{id:'QX',type:'qslink',psuModuleIds:[],deviceModuleIds:['D1']},resolve)).toThrow('QS');
    expect(d.buses).toHaveLength(0);
    d.modules.find(m=>m.id==='P2').busId='DCX';
    d.buses=[{...input,deviceModuleIds:[]}];
    const n=buildWiring(d);
    expect(n.wires.filter(w=>w.busId==='DCX'||(w.qsLink&&w.class!=='network'))).toHaveLength(0);
    expect(n.wiringIssues.some(i=>i.code==='QS_BUS_CONFLICT')).toBe(true);
    expect(problems(d).errors.join(' ')).toContain('直流出线');
  });
  it.each(['D1','D2','P2','PF','PS'])('breaks saved references when %s is deleted and its slot ID is reused',id=>{
    const d=design(),old=d.modules.find(m=>m.id===id);
    removeModule(d,id);d.modules.push({...old,qsConfig:null});
    const reopened=materializeTemplate(snapshotDesignTemplate(d,'删除后重开'));
    const edges=buildWiring(reopened).wires.filter(w=>w.qsLink);
    expect(edges.some(w=>w.from.startsWith(id+':')||w.to.startsWith(id+':'))).toBe(false);
    if(id==='D1'||id==='D2')expect(edges.some(w=>w.from.startsWith('P1:QS1_')||w.to.startsWith('T1:'))).toBe(false);
    if(id==='P2')expect(ethernetProblem(reopened,reopened.modules[0])).toBeTruthy();
    else expect(problems(reopened).errors.length).toBeGreaterThan(0);
  });
  it('requires each Ethernet segment to be at most 100 m and at most five processors per uncircled chain',()=>{
    const d={modules:Array.from({length:5},(_,i)=>({id:'P'+i,productId:'lutron-hqp7-1',qsConfig:{nextProcessorId:i===4?'':'P'+(i+1),ethernetMeters:100}}))};
    const check=()=>ethernetProblem(d,d.modules[0]);
    expect(check()).toBe('');
    d.modules[4].qsConfig.nextProcessorId='P0';expect(check()).toContain('成环');
    d.modules[4].qsConfig.nextProcessorId='P5';d.modules.push({id:'P5',productId:'lutron-hqp7-1'});expect(check()).toContain('五台');
    d.modules[1].qsConfig.ethernetMeters=101;expect(check()).toContain('100');
    expect(qsTerminalTemplates({id:'lutron-hqp7-1'}).some(p=>p.key==='QS2_1')).toBe(false);
  });
});
