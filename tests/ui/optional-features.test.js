// @vitest-environment jsdom
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {mountOptionalFeatures} from '../../src/ui/optional-features.js';
import {createBlankDesign} from '../../src/data/design-templates.js';
import {validateDesign,buildAssembly,allProducts} from '../../src/core/domain.js';
import {compactModulePlacement} from '../../src/core/modules.js';
import {rowAllows} from '../../src/core/row-zones.js';

beforeEach(()=>{document.body.innerHTML='<div id="features"></div><div id="modal-body"></div>';localStorage.clear();});
const query=selector=>document.querySelector(selector);
const click=selector=>query(selector).click();
const change=(selector,value)=>{const el=query(selector);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};

function fixture(overrides={}) {
  let design=createBlankDesign({featureVisibility:{electricalAudit:true,busEditor:true,rowZoning:true},...overrides});
  const close=vi.fn(()=>{query('#modal-body').innerHTML='';});
  const select=vi.fn(),toast=vi.fn();
  const assembly=()=>compactModulePlacement(buildAssembly(design),design);
  const mount=()=>mountOptionalFeatures({root:query('#features'),getDesign:()=>design,getAssembly:assembly,getNet:()=>({wires:[],moduleFeedBindings:[]}),products:()=>allProducts(design),resolve:id=>allProducts(design).find(p=>p.id===id),commit:fn=>{fn(design);localStorage.setItem('optional-test',JSON.stringify(design));mount();},open:(_title,html)=>{query('#modal-body').innerHTML=html;},close,select,toast});
  mount();
  return {get design(){return design;},assembly,select,close,toast,reload:()=>{design=validateDesign(JSON.parse(localStorage.getItem('optional-test')));mount();}};
}

describe('可选工具 DOM 验收',()=>{
  it('三个入口独立开关，保存重载后隐藏不删除总线或分排配置',()=>{
    const f=fixture({rowZones:['power','control'],buses:[{id:'DC1',type:'dc',label:'保留配置'}]});
    click('[data-feature-settings]');
    change('[data-visible="electricalAudit"]',false);
    change('[data-visible="busEditor"]',false);
    expect(query('[data-feature="rowZoning"]').hidden).toBe(false);
    expect(query('[data-feature="busEditor"]').hidden).toBe(true);
    click('[data-feature-done]');f.reload();
    expect(query('[data-feature="electricalAudit"]').hidden).toBe(true);
    expect(query('[data-feature="busEditor"]').hidden).toBe(true);
    expect(f.design.buses[0].id).toBe('DC1');expect(f.design.rowZones).toEqual(['power','control']);
    click('[data-feature-settings]');change('[data-visible="busEditor"]',true);
    expect(query('[data-feature="busEditor"]').hidden).toBe(false);
  });

  it('总线表单校验不提交，保存重载保留规格、关联和长度，删除先确认且保留器件',()=>{
    const f=fixture({modules:[{id:'PS1',productId:'meanwell-hdr-30'},{id:'GW1',productId:'crestron-din-ap4'}]});
    click('[data-feature="busEditor"]');click('[data-bus-new]');click('[data-bus-save]');
    expect(query('[role="alert"]').textContent).toContain('名称');expect(f.design.buses).toEqual([]);
    change('#bus-label','照明控制');change('[data-bus-psu="PS1"]',true);change('[data-bus-member="GW1"]',true);
    change('#bus-section','1.5');change('#bus-cable','RVV 2×1.5');change('#bus-length','12');click('[data-bus-save]');
    expect(f.design.buses).toHaveLength(1);const id=f.design.buses[0].id;
    expect(f.design.modules.every(m=>m.busId===id)).toBe(true);
    f.reload();click('[data-feature="busEditor"]');click(`[data-bus-edit="${id}"]`);
    expect(query('#bus-cable').value).toBe('RVV 2×1.5');expect(query('#bus-length').value).toBe('12');expect(query('[data-bus-member="GW1"]').checked).toBe(true);
    change('#bus-label','未保存修改');click('[data-bus-cancel]');expect(f.design.buses[0].label).toBe('照明控制');
    click(`[data-bus-delete="${id}"]`);click('[data-bus-cancel]');expect(f.design.buses).toHaveLength(1);
    click(`[data-bus-delete="${id}"]`);click('[data-bus-confirm]');f.reload();
    expect(f.design.buses).toHaveLength(0);expect(f.design.modules).toHaveLength(2);expect(f.design.modules.every(m=>!m.busId)).toBe(true);
  });

  it('更改预算单位或协议清空旧容量，避免 W 与 mA 静默混算',()=>{
    const f=fixture();click('[data-feature="busEditor"]');click('[data-bus-new]');change('#bus-label','测试');
    change('#bus-capacity','24');change('#bus-unit','mA');expect(query('#bus-capacity').value).toBe('');
    change('#bus-capacity','250');change('#bus-type','knx');expect(query('#bus-capacity').value).toBe('');expect(query('#bus-voltage').value).toBe('30');
    click('[data-bus-save]');expect(f.design.buses[0]).toMatchObject({type:'knx',budgetUnit:'mA',capacity:null,voltage:30});
  });

  it('电气校核将总线错误定位至编辑表单，将器件错误定位至检查器',()=>{
    const f=fixture({buses:[{id:'DC1',type:'dc',label:'无电源总线',psuModuleIds:[],deviceModuleIds:[]}],modules:[{id:'GW1',productId:'reyee-rg-es105gd'}],rowZones:Array(6).fill('power')});
    click('[data-feature="electricalAudit"]');
    expect(query('.feature-summary').textContent).toContain('项错误');
    const locate=ref=>[...document.querySelectorAll('[data-issue]')].find(el=>el.textContent===`定位 ${ref}`);
    locate('DC1').click();expect(query('#bus-label').value).toBe('无电源总线');
    click('[data-feature="electricalAudit"]');locate('GW1').click();expect(f.select).toHaveBeenCalledWith('GW1');expect(f.close).toHaveBeenCalled();
  });

  it('分排取消不改变方案，兼容手动位置保存重载后仍保留',()=>{
    const f=fixture({modules:[{id:'GW1',productId:'reyee-rg-es105gd',position:{row:1,slot:0}}]});
    click('[data-feature="rowZoning"]');change('[data-row-zone="0"]','power');click('[data-feature-done]');expect(f.design.rowZones).toBeUndefined();
    click('[data-feature="rowZoning"]');change('[data-row-zone="0"]','power');change('[data-row-zone="1"]','control');click('[data-row-save]');f.reload();
    expect(f.design.rowZones.slice(0,2)).toEqual(['power','control']);expect(f.design.modules[0].position).toEqual({row:1,slot:0});
    expect(f.assembly().nodes.every(n=>n.overflow||rowAllows(f.design,n.product,n.row))).toBe(true);
  });

  it('分排空间不足持续显示错误并可定位，释放手动位置后兼容重排',()=>{
    const f=fixture({modules:[{id:'GW1',productId:'reyee-rg-es105gd',position:{row:0,slot:0}}],positions:{GW1:{row:0,slot:0}}});
    click('[data-feature="rowZoning"]');
    document.querySelectorAll('[data-row-zone]').forEach(el=>change(`[data-row-zone="${el.dataset.rowZone}"]`,'power'));
    click('[data-row-save]');expect(query('[role="alert"]').textContent).toContain('空间不足');expect(f.assembly().nodes.find(n=>n.id==='GW1').overflow).toBe(true);
    query('[data-row-issue="GW1"]').click();expect(f.select).toHaveBeenCalledWith('GW1');
    click('[data-feature="rowZoning"]');change('[data-row-zone="1"]','control');change('#row-release',true);click('[data-row-save]');f.reload();
    expect(f.design.positions).toEqual({});expect(f.design.modules[0].position).toBeNull();expect(f.assembly().nodes.find(n=>n.id==='GW1')).toMatchObject({row:1,overflow:false});
  });
});
