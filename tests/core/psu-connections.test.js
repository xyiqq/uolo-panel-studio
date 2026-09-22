import {describe,it,expect} from 'vitest';
import {psuConnections,savePsuConnections} from '../../src/core/psu-connections.js';
import {createDefaultDesign,validateDesign} from '../../src/core/domain.js';
import {SMART_PRODUCTS} from '../../src/data/products/smart-index.js';

const psu=SMART_PRODUCTS.find(p=>p.id==='meanwell-hdr-100-24n');
const fixture=()=>({...createDefaultDesign(),modules:[{id:'PS1',productId:psu.id},{id:'GW1',productId:'crestron-din-ap4'},{id:'GW2',productId:'usmart-din-tcp-2rs485'}],buses:[]});
describe('电源下端模块选择',()=>{
  it('保存多选到总线且导入后保留，取消选择清理旧关联',()=>{
    let d=fixture();savePsuConnections(d,'PS1',psu,['GW1','GW2']);
    d=validateDesign(JSON.parse(JSON.stringify(d)));
    expect(psuConnections(d,'PS1')).toEqual(['GW1','GW2']);
    expect(d.buses[0]).toMatchObject({type:'dc',voltage:24,psuModuleIds:['PS1']});
    d.modules[1].busId=d.buses[0].id;
    savePsuConnections(d,'PS1',psu,['GW2']);
    expect(psuConnections(d,'PS1')).toEqual(['GW2']);
    expect(d.modules[1].busId).toBeNull();
    savePsuConnections(d,'PS1',psu,[]);
    expect(psuConnections(d,'PS1')).toEqual([]);
  });
  it('不覆盖已有线径或总线规则，也不隐式并联电源',()=>{
    const d=fixture();savePsuConnections(d,'PS1',psu,['GW1']);
    d.buses[0].section=.75;d.buses[0].maxDevices=10;
    savePsuConnections(d,'PS1',psu,['GW1','GW2']);
    expect(d.buses[0]).toMatchObject({section:.75,maxDevices:10});
    d.modules.push({id:'PS2',productId:psu.id});
    const before=JSON.stringify(d);
    expect(()=>savePsuConnections(d,'PS2',psu,['GW1'])).toThrow('已有同类电源');
    expect(JSON.stringify(d)).toBe(before);
  });
});
