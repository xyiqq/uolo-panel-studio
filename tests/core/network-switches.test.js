import {it,expect} from 'vitest';
import {NETWORK_SWITCH_PRODUCTS} from '../../src/data/products/network-switches.js';
import {createBlankDesign} from '../../src/data/design-templates.js';
import {buildAssembly,buildWiring,validateDesign} from '../../src/core/domain.js';
import {buildPortTemplates} from '../../src/core/ports.js';
import {buildBom} from '../../src/core/bom.js';
import {networkSwitchPortLayout} from '../../src/view/network-switch-layout.js';
it('5/8/16口交换机可保存上架和进入BOM，不生成强电或虚构总线端子',()=>{
  for(const p of NETWORK_SWITCH_PRODUCTS){
    const d=validateDesign(createBlankDesign({modules:[{id:'GW1',productId:p.id}]}));
    const a=buildAssembly(d),n=buildWiring(d,a);
    expect(a.nodes.find(n=>n.id==='GW1').product.width).toBe(p.width);
    expect(a.nodes.find(n=>n.id==='GW1').overflow).toBeFalsy();
    expect(buildPortTemplates(p)).toEqual([]);
    expect(n.wires.some(w=>w.from.startsWith('GW1:')||w.to.startsWith('GW1:'))).toBe(false);
    expect(buildBom(d,a,n).items.some(i=>i.sku===p.sku)).toBe(true);
  }
  expect(NETWORK_SWITCH_PRODUCTS.map(p=>p.networkPorts)).toEqual([5,8,16,10]);
  expect(NETWORK_SWITCH_PRODUCTS.map(p=>p.sku)).toEqual(['RG-ES105GD','RG-ES108GD','RG-ES116G-E','RG-EG210G-P-E V2']);
  expect(NETWORK_SWITCH_PRODUCTS.every(p=>p.brand==='锐捷睿易')).toBe(true);
});

it('210GPE使用V2官方10口布局，8口PoE与110W总预算，备注及接口名保留',()=>{
  const p=NETWORK_SWITCH_PRODUCTS.find(p=>p.networkProfile==='eg210gpe-v2');
  expect(p).toMatchObject({width:202,height:28,depth:108,networkPorts:10,poeBudgetW:110,poePortMaxW:30,adapterVoltage:54,adapterAmps:2.4});
  expect(p.poePorts).toEqual([1,2,3,4,5,6,7,8]);expect(p.networkPortNames[9]).toBe('WAN0');
  const d=validateDesign(createBlankDesign({modules:[{id:'GW1',productId:p.id,displayName:'二楼网络中心',switchOrientation:'up',switchPortLabels:{10:'光猫上联'}}]}));
  const node=buildAssembly(d).nodes.find(n=>n.id==='GW1');
  expect(node.product).toMatchObject({height:108,depth:28,displayName:'二楼网络中心',switchPortLabels:{10:'光猫上联'}});
});

it('旧交换机方案升级为睿易，编号、备注和手动位置保留',()=>{
  const raw=createBlankDesign({modules:[{id:'GW1',productId:'tplink-tl-sg105',label:'GW1 TL-SG105',displayName:'影音柜',position:{row:1,slot:2}}]});
  const d=validateDesign(raw);
  expect(d.modules[0]).toMatchObject({id:'GW1',productId:'reyee-rg-es105gd',label:'GW1 5口交换机',displayName:'影音柜',position:{row:1,slot:2}});
  expect(raw.modules[0].productId).toBe('tplink-tl-sg105');
});

it.each(['up','down'])('端口%s时正确交换安装高度和深度，逐口信息保存重载无损',orientation=>{
  const p=NETWORK_SWITCH_PRODUCTS[2];
  const d=validateDesign(createBlankDesign({modules:[{id:'GW1',productId:p.id,switchOrientation:orientation,switchPortLabels:{1:'客厅AP',16:'上联路由器'}}]}));
  const saved=validateDesign(JSON.parse(JSON.stringify(d))),node=buildAssembly(saved).nodes.find(n=>n.id==='GW1');
  expect(node.product).toMatchObject({height:126,depth:44,networkPhysicalHeight:44,networkPhysicalDepth:126,switchOrientation:orientation,switchPortLabels:{1:'客厅AP',16:'上联路由器'}});
  expect(saved.modules[0].switchPortLabels).toHaveProperty('8','');
});

it('网口布局遵循单排与双排实际外壳，所有编号唯一且位于机身内',()=>{
  for(const p of NETWORK_SWITCH_PRODUCTS){
    const ports=networkSwitchPortLayout(p);
    expect(new Set(ports.map(x=>x.number)).size).toBe(p.networkPorts);
    expect(new Set(ports.map(x=>x.y)).size).toBe(p.networkPortRows);
    for(const port of ports){expect(Math.abs(port.x)+7.1).toBeLessThan(p.width/2);expect(Math.abs(port.y)+6.4).toBeLessThan(p.height/2);}
  }
});
