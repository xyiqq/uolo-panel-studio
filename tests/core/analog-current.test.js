import {describe,expect,it} from 'vitest';
import {buildWiring,validateDesign} from '../../src/core/domain.js';
import {createBreakerPackDesign} from '../../src/data/design-templates.js';
import {wireRows} from '../../src/core/handover.js';

const flv='crestron-din-4dimflv4',lutron='lutron-lqse-4t10-d';
function fixture(productId,ch1,ch2={driverRole:'source',interfaceMa:12.5}) {
  const d=createBreakerPackDesign({count:3,productId:'A9D32610',name:'0–10V'});
  d.modules=[{id:'D1',productId,channels:{1:'C01',2:'C02'},feed:'perChannel',protectId:productId===lutron?'C03':null,analogCircuitClass:'pelv',
    analogTerminals:{1:{plus:'T1:1',minus:'T1:2',...ch1},2:{plus:'T1:3',minus:'T1:4',...ch2}}},
    {id:'T1',productId:'phoenix-pt25-gy-4'}];
  return validateDesign(JSON.parse(JSON.stringify(d)));
}
describe('0–10 V driver interface compatibility',()=>{
  it.each([[flv,'source',60],[lutron,'source',50],[lutron,'sink',50]])('delivers both signals and persists the rated maximum for %s %s %d mA',(id,driverRole,interfaceMa)=>{
    const d=fixture(id,{driverRole,interfaceMa:String(interfaceMa)}),n=buildWiring(d);
    expect(d.modules[0].analogTerminals[1]).toMatchObject({driverRole,interfaceMa});
    expect(n.wiringIssues.some(i=>i.code.startsWith('MODULE_ANALOG_'))).toBe(false);
    const printed=wireRows(n).filter(row=>String(row[0]).startsWith('D1:CH1_')&&row[5]==='signal');
    expect(printed).toHaveLength(2);
    expect(printed.every(row=>row[9].includes(interfaceMa+' mA / '+interfaceMa+' mA'))).toBe(true);
  });
  it.each([[flv,'sink',1],[flv,'source',60.01],[lutron,'sink',50.01],[lutron,'mixed',2],[lutron,'unrecognized',3],[lutron,'source',-1],[lutron,'source','malformed']])('saves and isolates an incompatible pair for %s %s %s',(id,driverRole,interfaceMa)=>{
    const n=buildWiring(fixture(id,{driverRole,interfaceMa}));
    expect(n.wiringIssues).toContainEqual(expect.objectContaining({code:'MODULE_ANALOG_INCOMPATIBLE',level:'error',circuit:'C01'}));
    const signal=wireRows(n).filter(row=>row[5]==='signal');
    expect(signal.map(row=>row[0])).toEqual(['D1:CH2_PLUS','D1:CH2_MINUS']);
    expect(n.wires.some(w=>w.from==='D1:CH1_OUT')).toBe(true);
  });
  it('retains legacy pairs with explicit pending interface data in the delivered wires',()=>{
    const n=buildWiring(fixture(flv,{}));
    expect(n.wiringIssues).toContainEqual(expect.objectContaining({code:'MODULE_ANALOG_CURRENT_UNKNOWN',level:'pending'}));
    expect(n.wires.find(w=>w.from==='D1:CH1_PLUS').scope).toContain('方向待核 · 电流待核 / 60 mA');
  });
});
