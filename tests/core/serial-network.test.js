import {it,expect} from 'vitest';
import {createBreakerPackDesign} from '../../src/data/design-templates.js';
import {allProducts,buildWiring,findProduct,validateDesign} from '../../src/core/domain.js';
import {saveBus} from '../../src/core/bus-editor.js';
import {removeModule,linkChannelTerminal} from '../../src/core/modules.js';
import {SDM630_V2,rs485PlanIssue} from '../../src/core/serial-rs485.js';
import {computeBusBudgets} from '../../src/core/bus-budget.js';
import {fieldTerminalClaims} from '../../src/core/field-terminals.js';
import {saveTerminalRows} from '../../src/core/terminal-connections.js';
import {buildBom} from '../../src/core/bom.js';

const mixed={id:'NET',type:'cresnet',label:'混合网段',controllerModuleId:'AP',chainSupplyModuleId:'PS',
  deviceModuleIds:['R1','GW','DLI'],chainPowerMeters:8,cableMeters:12};
function fixture(){
  const d=createBreakerPackDesign({count:1,productId:'A9D32610'});
  d.modules=[{id:'AP',productId:'crestron-din-ap4',rs485Meters:['W2','W1'],rs485MetersLength:1200},
    {id:'PS',productId:'crestron-din-pws50',protectId:'C01'},
    {id:'R1',productId:'crestron-din-8sw8-i'},{id:'GW',productId:'crestron-din-dali-2'},
    {id:'DLI',productId:'crestron-din-dli'},...['W1','W2'].map(id=>({id,productId:SDM630_V2}))];
  saveBus(d,mixed,id=>findProduct(d,id));
  return validateDesign(JSON.parse(JSON.stringify(d)));
}
it('resolves receiver-specific Cresnet budgets, and keeps both serial pairs and references on their own ports',()=>{
  const d=fixture();
  const master=d.modules[0];
  expect(master.rs485Meters).toEqual(['W2','W1']);
  const net=buildWiring(d);
  expect(net.wires.filter(w=>w.rs485).map(w=>[w.from,w.to])).toEqual([
    ['AP:COM1_TX','W2:RS485_A'],['AP:COM1_RTS','W2:RS485_B'],['AP:COM1_G','W2:RS485_G'],
    ...['A','B','G'].map(p=>['W2:RS485_'+p,'W1:RS485_'+p])]);
  expect(net.wires.filter(w=>w.cresnet)).toHaveLength(15);
  expect(net.ports['W2:RS485_A'].y).toBeLessThan(net.ports['W2:L1_IN'].y);
  expect(buildBom(d,net.assembly,net).wires.filter(w=>w.color==='rs485')).toMatchObject([{meters:1200}]);
  expect(computeBusBudgets(d,allProducts(d))[0].used).toBeCloseTo(20.4);
  d.modules.find(m=>m.id==='GW').daliPowerMode='EXT';
  expect(computeBusBudgets(d,allProducts(d))[0].used).toBeCloseTo(13.4);
  d.modules.find(m=>m.id==='GW').daliPowerMode='invalid';
  expect(buildWiring(d).wires.filter(w=>w.cresnet)).toHaveLength(0);
});
it('reserves removed intermediate positions when IDs are reused until the route is explicitly edited',()=>{
  const d=fixture();
  const oldLink='module-wire:AP:COM1_TX>W2:RS485_A';
  d.states.W2=false;d.wireOverrides[oldLink]=1.5;d.disconnected.push(oldLink);
  removeModule(d,'W2');removeModule(d,'GW');
  expect(d.states.W2).toBeUndefined();expect(d.wireOverrides[oldLink]).toBeUndefined();expect(d.disconnected).not.toContain(oldLink);
  d.modules.push({id:'W2',productId:SDM630_V2},{id:'GW',productId:'crestron-din-dali-2'});
  const net=buildWiring(validateDesign(JSON.parse(JSON.stringify(d))));
  expect(net.wires.some(w=>w.rs485||w.cresnet)).toBe(false);
  expect(net.wiringIssues.map(i=>i.code)).toEqual(expect.arrayContaining(['CRESNET_CHAIN_MEMBER_UNRESOLVED','RS485_CONNECTION_UNRESOLVED']));
});
it('withholds invalid serial networks and disallows a generic bus claiming an allocated COM port',()=>{
  const d=fixture(), m=d.modules[0];
  const generic={id:'SER',type:'rs485',label:'串口',deviceModuleIds:['W1']};
  expect(()=>saveBus(d,generic,id=>findProduct(d,id))).toThrow('COM1');
  for(const [ids,length] of [[['W1','W1'],10],[['DLI'],1],[['W1'],1201]]) {
    m.rs485Meters=ids;m.rs485MetersLength=length;
    expect(buildWiring(d).wires.some(w=>w.rs485)).toBe(false);
  }
  d.modules.push({id:'AP2',productId:m.productId,rs485Meters:['W1']});
  m.rs485MetersLength=30;expect(buildWiring(d).wires.some(w=>w.rs485)).toBe(false);
  expect(rs485PlanIssue(d,m,[])).toBe('');
  d.modules=d.modules.filter(m=>m.id!=='AP2');m.rs485Meters=[];
  saveBus(d,generic,id=>findProduct(d,id));
  expect(buildWiring(d).wiringIssues.some(i=>i.code==='BUS_PINOUT_UNVERIFIED')).toBe(true);
});
it('counts the master toward the 32-node serial limit and rejects a positive length beyond the manufacturer rating',()=>{
  const master={id:'P',productId:'crestron-din-ap4',rs485MetersLength:1200};
  const meters=Array.from({length:32},(_,i)=>({id:'W'+i,productId:SDM630_V2}));
  const d={modules:[master,...meters],buses:[]},ids=meters.map(m=>m.id);
  expect(rs485PlanIssue(d,master,ids.slice(1))).toBe('');
  expect(rs485PlanIssue(d,master,ids)).toContain('32');
  expect(rs485PlanIssue(d,{...master,rs485MetersLength:1200.01},ids.slice(1))).toContain('1200');
});
it('reserves field slices for signal pairs against phase assignments and releases references when the strip is removed',()=>{
  const d=fixture(),gw=d.modules.find(m=>m.id==='GW');
  d.modules.push({id:'T1',productId:'phoenix-pt25-gy-4'});
  gw.daliFieldLoops={1:{plus:'T1:1',minus:'T1:2'}};
  expect(()=>linkChannelTerminal(d,'R1',1,'T1')).toThrow('信号');
  expect(()=>saveTerminalRows(d,[{terminalId:'T1',pole:1,output:'R1:CH1_OUT'}],id=>findProduct(d,id))).toThrow('信号');
  expect(fieldTerminalClaims(d).get('T1:2')[0].field).toBe('dali-1-minus');
  removeModule(d,'T1');expect(gw.daliFieldLoops[1]).toMatchObject({plus:'',minus:''});
});
