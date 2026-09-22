import { describe, expect, it } from "vitest";
import { compactModulePlacement } from "../../src/core/modules.js";
import { canPlaceFootprint, placementRows } from "../../src/core/placement-footprint.js";
import { buildAssembly, createDefaultDesign, validateDesign } from "../../src/core/domain.js";
import { makeGenericCabinet } from "../../src/data/cabinets/index.js";

function node(id, kind, row, slot, { pinned = false, width = 18, modules = width / 18, linkModuleId = null } = {}) {
  return { id, role: "module", module: { id, linkModuleId }, product: { kind, width, modules }, row, slot, pinned };
}

function place(nodes, blockers = [], slots = 12) {
  const occupied = Array.from({ length: 3 }, () => Array(slots).fill(null));
  for (const item of [...nodes, ...blockers]) {
    for (let offset = 0; offset < Math.ceil(item.product.modules); offset++) occupied[item.row][item.slot + offset] = item.id;
  }
  return compactModulePlacement({ nodes, occupied, box: { rows: 3, slots, height: 600, topRail: 60, pitch: 150 } }, { modules: nodes.map((item) => item.module) });
}

describe("PT2.5 automatic placement", () => {
  it.each([null, "K1"])("starts on the first row regardless of the relay link %s", (linkModuleId) => {
    const relay = node("K1", "relay", 2, 3, { pinned: true, width: 72 });
    const terminal = node("T1", "terminal", 2, 7, { width: 20.8, linkModuleId });
    place([relay, terminal]);
    expect(terminal).toMatchObject({ row: 0, slot: 0, overflow: false });
    expect(relay).toMatchObject({ row: 2, slot: 3, pinned: true });
  });

  it("fills an earlier free gap instead of following an automatic relay", () => {
    const relay = node("K1", "relay", 1, 0, { width: 144 });
    const terminal = node("T1", "terminal", 1, 8, { width: 20.8, linkModuleId: "K1" });
    place([relay, terminal], [node("C1", "breaker", 0, 2, { width: 180 })]);
    expect(relay.row).toBe(1);
    expect(terminal).toMatchObject({ row: 0, slot: 0 });
  });

  it("uses the first available position even when the terminal is the only module", () => {
    const terminal = node("T1", "terminal", 2, 0, { width: 5.2 });
    const assembly = place([terminal], [node("C1", "breaker", 0, 0, { width: 36 })]);
    expect(terminal).toMatchObject({ row: 0, slot: 2 });
    expect(assembly.occupied[2][0]).toBeNull();
    expect(assembly.occupied[0][2]).toBe("T1");
  });

  it("retains the saved anchor while keeping a pinned terminal touching the strip", () => {
    const first = node("T1", "terminal", 0, 0, { width: 5.2 });
    const pinned = node("T2", "terminal", 0, 5, { pinned: true, width: 5.2 });
    place([first, pinned]);
    expect(pinned).toMatchObject({ row: 0, slot: 5, pinned: true });
    expect(pinned.x-first.x).toBeCloseTo(5.2);
  });

  it("packs adjacent terminals without crossing an intervening breaker", () => {
    const first = node("T1", "terminal", 0, 0, { width: 5.2 });
    const second = node("T2", "terminal", 0, 2, { width: 5.2 });
    place([first, second], [node("C1", "breaker", 0, 1)]);
    expect(second.slot).toBe(2);
    expect(second.x).toBeCloseTo((2 - 6) * 18 + 2.6);
  });

  it("keeps adjacent automatic terminals touching at their real widths", () => {
    const first = node("T1", "terminal", 0, 0, { width: 20.8 });
    const second = node("T2", "terminal", 0, 2, { width: 5.2 });
    place([first, second]);
    expect(second.x - first.x).toBeCloseTo((20.8 + 5.2) / 2);
  });

  it("packs successive pinned gray groups and blue terminals while retaining their saved anchors", () => {
    const terminals = [
      node("T1", "terminal", 0, 1, { pinned: true, width: 41.6 }),
      node("T2", "terminal", 0, 4, { pinned: true, width: 5.2 }),
      node("T3", "terminal", 0, 5, { pinned: true, width: 41.6 }),
      node("T4", "terminal", 0, 8, { pinned: true, width: 5.2 }),
    ];
    const assembly = place(terminals);
    expect(terminals[0].x).toBeCloseTo((1 - 6) * 18 + 41.6 / 2);
    for (let i = 1; i < terminals.length; i++) {
      const previous = terminals[i - 1], current = terminals[i];
      expect(current.x - current.product.width / 2).toBeCloseTo(previous.x + previous.product.width / 2);
      expect(current.pinned).toBe(true);
      const footprint=assembly.occupied.footprints.find(f=>f.id===current.id);
      expect(footprint.left).toBeCloseTo(current.x-current.product.width/2+assembly.box.slots*9);
    }
    expect(terminals.map((terminal) => terminal.slot)).toEqual([1, 4, 5, 8]);
  });

  it("closes empty anchor gaps between terminals on the same rail", () => {
    const terminals = [
      node("T1", "terminal", 0, 0, { pinned: true, width: 5.2 }),
      node("T2", "terminal", 0, 2, { pinned: true, width: 5.2 }),
      node("T3", "terminal", 0, 3, { pinned: true, width: 5.2 }),
    ];
    place(terminals);
    expect(terminals[1].x-terminals[0].x).toBeCloseTo(5.2);
    expect(terminals[2].x - terminals[1].x).toBeCloseTo(5.2);
  });

  it("does not pull pinned terminals across a non-terminal module or between rows", () => {
    const first = node("T1", "terminal", 0, 0, { pinned: true, width: 5.2 });
    const relay = node("K1", "relay", 0, 1, { pinned: true, width: 18 });
    const second = node("T2", "terminal", 0, 2, { pinned: true, width: 5.2 });
    const third = node("T3", "terminal", 1, 3, { pinned: true, width: 5.2 });
    place([first, relay, second, third]);
    expect(second.x).toBeCloseTo((2 - 6) * 18 + 2.6);
    expect(third.x).toBeCloseTo((3 - 6) * 18 + 2.6);
  });
});

describe("physical module adjacency", () => {
  it.each([false, true])("packs consecutive 159 mm / 9M relays with pinned=%s", (pinned) => {
    const modules = [0, 9, 18].map((slot, index) => node(`K${index + 1}`, "relay", 0, slot, { pinned, width: 159, modules: 9 }));
    const assembly = place(modules, [], 36);
    expect(modules[0].x - 159 / 2).toBe(-324);
    for (let i = 1; i < modules.length; i++) {
      expect(modules[i].x - 159 / 2).toBeCloseTo(modules[i - 1].x + 159 / 2);
      expect(modules[i].slot).toBe(i * 9);
      expect(assembly.occupied[0].slice(i * 9, i * 9 + 9)).toEqual(Array(9).fill(modules[i].id));
    }
    compactModulePlacement(assembly, { modules: modules.map((item) => item.module) });
    expect(modules[2].x - modules[0].x).toBeCloseTo(318);
  });

  it("packs a 216 mm dimmer and 159 mm relays into the same physical run", () => {
    const modules = [
      node("D1", "dimmer", 0, 0, { pinned: true, width: 216, modules: 12 }),
      node("K1", "relay", 0, 12, { pinned: true, width: 159, modules: 9 }),
      node("K2", "relay", 0, 21, { pinned: true, width: 159, modules: 9 }),
    ];
    place(modules, [], 36);
    for (let i = 1; i < modules.length; i++) {
      expect(modules[i].x - modules[i].product.width / 2).toBeCloseTo(modules[i - 1].x + modules[i - 1].product.width / 2);
    }
  });

  it.each([false, true])("preserves an intervening slot, occupied by a breaker=%s", (withBreaker) => {
    const modules = [
      node("K1", "relay", 0, 0, { pinned: true, width: 159, modules: 9 }),
      node("K2", "relay", 0, 10, { pinned: true, width: 159, modules: 9 }),
      node("K3", "relay", 0, 19, { pinned: true, width: 159, modules: 9 }),
    ];
    place(modules, withBreaker ? [node("C1", "breaker", 0, 9)] : [], 36);
    expect(modules[1].x - 159 / 2).toBeCloseTo((10 - 18) * 18);
    expect(modules[1].x - 159 / 2 - (modules[0].x + 159 / 2)).toBeCloseTo(21);
    expect(modules[2].x - modules[1].x).toBeCloseTo(159);
  });

  it("keeps terminals and different rows outside the relay run", () => {
    const modules = [
      node("K1", "relay", 0, 0, { pinned: true, width: 159, modules: 9 }),
      node("T1", "terminal", 0, 9, { pinned: true, width: 5.2 }),
      node("K2", "relay", 0, 10, { pinned: true, width: 159, modules: 9 }),
      node("K3", "relay", 1, 19, { pinned: true, width: 159, modules: 9 }),
    ];
    place(modules, [], 36);
    expect(modules[1].x - 5.2 / 2).toBeCloseTo((9 - 18) * 18);
    expect(modules[2].x - 159 / 2).toBeCloseTo((10 - 18) * 18);
    expect(modules[3].x - 159 / 2).toBeCloseTo((19 - 18) * 18);
  });
});

describe('compacted terminal free space',()=>{
  function fixture(){
    const box={...makeGenericCabinet(3,44,200),id:'USR-CAB-test44',custom:true};
    const d=createDefaultDesign({includeMain:false,includeSpd:false});
    Object.assign(d,{includeMain:false,includeSpd:false,circuits:[],customCabinets:[box],cabinet:box.id,modules:[{id:'D0',productId:'crestron-din-1dim4'},{id:'D00',productId:'crestron-din-1dim4'}],positions:{D0:{row:0,slot:0},D00:{row:0,slot:12}}});
    let slot=24;
    for(let i=1;i<=10;i++){
      const gray=i%2===1;
      d.modules.push({id:`T${i}`,productId:`phoenix-pt25-${gray?'gy-8':'bu-1'}`});
      d.positions[`T${i}`]={row:0,slot};slot+=gray?3:1;
    }
    d.modules.push({id:'T11',productId:'phoenix-pt25-gy-8'});d.positions.T11={row:1,slot:0};
    return d;
  }
  const geometry=a=>a.nodes.map(n=>({id:n.id,row:n.row,slot:n.slot,x:n.x,overflow:n.overflow}));
  it('offers actual first-row gaps and preserves legacy pinned terminals after save/reload',()=>{
    const d=fixture(),a=buildAssembly(d),t=a.nodes.find(n=>n.id==='T11');
    expect(canPlaceFootprint(d,t.product,a.box,a.occupied,{row:0,slot:39},t.id)).toBe(true);
    expect(canPlaceFootprint(d,t.product,a.box,a.occupied,{row:0,slot:25},t.id)).toBe(false);
    const original=a.nodes.filter(n=>/^T/.test(n.id)&&n.id!=='T11').map(n=>({id:n.id,x:n.x}));
    d.positions.T11={row:0,slot:39};
    const saved=buildAssembly(validateDesign(JSON.parse(JSON.stringify(d))));
    expect(saved.nodes.find(n=>n.id==='T11')).toMatchObject({row:0,slot:39,overflow:false});
    expect(saved.nodes.filter(n=>/^T/.test(n.id)&&n.id!=='T11').map(n=>({id:n.id,x:n.x}))).toEqual(original);
    const line=saved.nodes.filter(n=>n.row===0).sort((a,b)=>a.x-b.x);
    for(let i=1;i<line.length;i++)expect(line[i].x-line[i].product.width/2).toBeGreaterThanOrEqual(line[i-1].x+line[i-1].product.width/2-1e-6);
    const terminals=line.filter(n=>n.product.kind==='terminal');
    for(let i=1;i<terminals.length;i++)expect(terminals[i].x-terminals[i].product.width/2).toBeCloseTo(terminals[i-1].x+terminals[i-1].product.width/2);
    const before=geometry(saved);
    compactModulePlacement(saved,d);
    expect(geometry(saved)).toEqual(before);
    expect(geometry(buildAssembly(validateDesign(JSON.parse(JSON.stringify(d)))))).toEqual(before);
  });
  it('automatically reuses the first-row gap without bypassing row zones',()=>{
    const d=fixture();delete d.positions.T11;
    expect(buildAssembly(d).nodes.find(n=>n.id==='T11').row).toBe(0);
    d.rowZones=['power','mixed','mixed'];
    const a=buildAssembly(d),t=a.nodes.find(n=>n.id==='T11');
    expect(t.row).not.toBe(0);
    expect(canPlaceFootprint(d,t.product,a.box,a.occupied,{row:0,slot:39},t.id)).toBe(false);
  });
  it('preserves compact runs when module creation order differs from slot order',()=>{
    const d=fixture();d.positions.T11={row:0,slot:39};
    const before=buildAssembly(d);
    d.modules.reverse();
    const reordered=buildAssembly(d);
    const coords=a=>Object.fromEntries(a.nodes.map(n=>[n.id,[n.row,n.x]]));
    expect(coords(reordered)).toEqual(coords(before));
  });
  it('continues to reserve every row crossed by a vertical PDU',()=>{
    const d=fixture();d.modules=[{id:'PDU1',productId:'bull-gne-1080'}];d.positions={PDU1:{row:0,slot:0}};
    d.customCabinets=[{...makeGenericCabinet(5,44,200),id:d.cabinet,custom:true}];
    const a=buildAssembly(d),p=a.nodes[0];
    expect(p.overflow).toBe(false);
    const terminal={kind:'terminal',width:5.2,modules:5.2/18};
    for(let row=0;row<placementRows(p.product,a.box);row++)expect(canPlaceFootprint(d,terminal,a.box,a.occupied,{row,slot:1},'T1')).toBe(false);
    expect(canPlaceFootprint(d,terminal,a.box,a.occupied,{row:2,slot:3},'T1')).toBe(true);
  });
});
