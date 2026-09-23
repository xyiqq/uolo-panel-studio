import {describe,it,expect} from 'vitest';
import {UOLO_CABINETS} from '../../src/data/cabinets/uolo.js';
import {allCabinets,findCabinet,CABINETS} from '../../src/data/cabinets/index.js';
import {resolveCabinet,validateDesign,buildAssembly} from '../../src/core/domain.js';
import {compactModulePlacement} from '../../src/core/modules.js';
import {createBlankDesign} from '../../src/data/design-templates.js';
import {computeSpace} from '../../src/core/space.js';
import {wireDuctRects} from '../../src/view/wire-ducts3d.js';

// Measured from the DWG blocks 配电箱76…160: outer, inner, rows, mounting-zone height.
const DRAWING = {
  76:[720,850,760,4,140],93:[700,1020,930,5,138],110:[700,1190,1100,6,136.7],
  127:[700,1360,1270,7,135.7],145:[700,1530,1450,8,136.2],160:[720,1690,1600,9,133.3],
};

describe('UOLO 线槽箱', () => {
  it.each(Object.entries(DRAWING))('63/%s 与图纸尺寸一致：40mm 线槽、550mm 安装区、导轨居中', (key,[ow,oh,h,rows,zone]) => {
    const cab=findCabinet(`UOLO-63x${key}`);
    expect(cab.outer.slice(0,2)).toEqual([ow,oh]);
    expect([cab.width,cab.height,cab.rows]).toEqual([630,h,rows]);
    expect(cab.wireDucts.zoneHeight).toBeCloseTo(zone,0);
    expect(cab.topRail).toBeCloseTo(40+cab.wireDucts.zoneHeight/2,6);
    expect(cab.topRail+(rows-1)*cab.pitch+cab.wireDucts.zoneHeight/2+40).toBeCloseTo(h,6);
    expect(cab.slots*18).toBeLessThanOrEqual(cab.wireDucts.zoneWidth);
  });

  it('线槽矩形互不重叠且不压住导轨安装区',()=>{
    for(const cab of UOLO_CABINETS){
      const rects=wireDuctRects(cab);
      expect(rects).toHaveLength(4+cab.rows-1);
      for(let row=0;row<cab.rows;row++){
        const y=cab.height/2-cab.topRail-row*cab.pitch,half=cab.wireDucts.zoneHeight/2;
        for(const r of rects.filter(r=>!r.vertical))expect(Math.abs(r.y-y)).toBeGreaterThanOrEqual(half+r.h/2-1e-6);
      }
      for(const r of rects.filter(r=>r.vertical))expect(Math.abs(r.x)+r.w/2).toBeCloseTo(cab.width/2,6);
    }
  });

  it('不影响现有箱体：玛德克与通用箱无线槽，原有顺序在前',()=>{
    expect(Object.values(CABINETS).every(c=>!c.wireDucts)).toBe(true);
    const list=allCabinets({});
    expect(list.slice(0,3).map(c=>c.id)).toEqual(Object.keys(CABINETS));
    expect(list.filter(c=>c.wireDucts).map(c=>c.id)).toEqual(UOLO_CABINETS.map(c=>c.id));
    expect(resolveCabinet('MH144')).toMatchObject({id:'MH144',rows:6,pitch:175,topRail:155});
    expect(resolveCabinet('MH144').wireDucts).toBeUndefined();
    expect(resolveCabinet('UOLO-63x110').wireDucts.width).toBe(40);
  });

  it('选用 UOLO 箱可通过校验、装配与空间计算，模块落在导轨上',()=>{
    const d=validateDesign(createBlankDesign({cabinet:'UOLO-63x110',modules:[{id:'K1',productId:'crestron-din-8sw8-i'}]}));
    const a=compactModulePlacement(buildAssembly(d),d);
    expect(a.box.id).toBe('UOLO-63x110');
    for(const n of a.nodes)expect(Math.abs(n.x)+n.product.width/2).toBeLessThanOrEqual(a.box.width/2-a.box.wireDucts.width+1e-6);
    expect(computeSpace(d,a).currentFit.cabinet.id).toBe('UOLO-63x110');
  });
});

describe('UOLO 线槽标准：任意内部尺寸', () => {
  it('按内部尺寸自动推算排数、安装区与外形，排数和边距可手动指定', async () => {
    const {makeDuctCabinet,suggestDuctRows}=await import('../../src/data/cabinets/uolo.js');
    const auto=makeDuctCabinet({innerWidth:800,innerHeight:1300});
    expect(auto.rows).toBe(suggestDuctRows(1300));expect(auto.rows).toBe(7);
    expect(auto.outer.slice(0,2)).toEqual([870,1390]);
    expect(auto.wireDucts.zoneWidth).toBe(720);expect(auto.slots).toBe(40);
    expect(auto.topRail+(auto.rows-1)*auto.pitch+auto.wireDucts.zoneHeight/2+40).toBeCloseTo(1300,6);
    const manual=makeDuctCabinet({innerWidth:800,innerHeight:1300,rows:6,sideMargin:50,endMargin:60});
    expect(manual.rows).toBe(6);expect(manual.outer.slice(0,2)).toEqual([900,1420]);
    expect(manual.wireDucts.zoneHeight).toBeCloseTo((1300-40*7)/6,6);
  });

  it('排数过多或宽度不足时给出原因',async()=>{
    const {makeDuctCabinet}=await import('../../src/data/cabinets/uolo.js');
    expect(()=>makeDuctCabinet({innerWidth:630,innerHeight:760,rows:6})).toThrow('需减少排数');
    expect(()=>makeDuctCabinet({innerWidth:150,innerHeight:760})).toThrow('不足 6P');
  });

  it('导入方案时自定义箱体的线槽参数须与尺寸自洽，否则只丢弃线槽',async()=>{
    const {makeDuctCabinet}=await import('../../src/data/cabinets/uolo.js');
    const {validateCustomCabinet}=await import('../../src/core/domain.js');
    const cab={...makeDuctCabinet({innerWidth:700,innerHeight:1200}),id:'USR-CAB-x',brand:'自定义',custom:true};
    expect(validateCustomCabinet(cab).wireDucts.width).toBe(40);
    const bad=validateCustomCabinet({...cab,wireDucts:{...cab.wireDucts,zoneHeight:10}});
    expect(bad.wireDucts).toBeUndefined();expect(bad.rows).toBe(cab.rows);
  });
});

describe('优诺线槽三维几何', () => {
  it('线槽不与箱体侧板、顶底板及安装背板共面（避免闪烁）', async () => {
    const {addWireDucts}=await import('../../src/view/wire-ducts3d.js');
    for(const cab of UOLO_CABINETS){
      const boxes=[];
      addWireDucts((_g,w,h,d,x,y,z)=>boxes.push({x0:x-w/2,x1:x+w/2,y0:y-h/2,y1:y+h/2,z0:z-d/2,z1:z+d/2}),null,cab);
      expect(boxes).toHaveLength(3*(4+cab.rows-1));
      const sx=cab.width/2-3,sy=cab.height/2-3;
      for(const b of boxes){
        expect(b.x0).toBeGreaterThan(-sx);expect(b.x1).toBeLessThan(sx);
        expect(b.y0).toBeGreaterThan(-sy);expect(b.y1).toBeLessThan(sy);
        expect(b.z0).toBeGreaterThan(3.75);
      }
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        const a=boxes[i],b=boxes[j];
        const overlap=(p0,p1,q0,q1)=>Math.min(p1,q1)-Math.max(p0,q0);
        const ox=overlap(a.x0,a.x1,b.x0,b.x1),oy=overlap(a.y0,a.y1,b.y0,b.y1),oz=overlap(a.z0,a.z1,b.z0,b.z1);
        expect(ox>1e-6&&oy>1e-6&&oz>1e-6,`duct boxes ${i} and ${j} intersect`).toBe(false);
        const touching=[ox,oy,oz].filter(o=>Math.abs(o)<1e-6).length===1&&[ox,oy,oz].filter(o=>o>1e-6).length===2;
        expect(touching,`duct boxes ${i} and ${j} share a face`).toBe(false);
      }
    }
  });
});

describe('优诺线槽箱深度', () => {
  it('默认箱体深 150 mm、线槽深 80 mm，线槽深度不得达到箱体深度', async () => {
    const {makeDuctCabinet}=await import('../../src/data/cabinets/uolo.js');
    for(const cab of UOLO_CABINETS){expect(cab.depth).toBe(150);expect(cab.wireDucts.depth).toBe(80);expect(cab.source).not.toContain('待核');}
    expect(()=>makeDuctCabinet({innerWidth:630,innerHeight:1100,depth:120,ductDepth:120})).toThrow('小于箱体深度');
  });
});
