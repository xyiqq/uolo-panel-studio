import { afterEach, describe, expect, it, vi } from "vitest";
import { Box3, BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { buildSmartDevice } from "../../src/view/smart-device3d.js";
import { compactModulePlacement } from "../../src/core/modules.js";
import { buildPortTemplates } from "../../src/core/ports.js";
import { routeCabinetWire } from "../../src/view/wire-routing.js";
import { CRESTRON_PRODUCTS } from "../../src/data/products/smart-crestron.js";

// Texture painting is irrelevant to solid-body contact; retain real mesh geometry.
vi.mock("../../src/view/module-face.js", async (original) => ({
  ...await original(),
  paintModuleFace: () => {},
}));

afterEach(() => vi.unstubAllGlobals());

function geometryKit() {
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({}) }) });
  return {
    textures: new Map(), materials: new Map(),
    own: (item) => item,
    geometry: (_key, create) => create(),
    cube(group, width, height, depth, x, y, z, color, radius = 1.2) {
      const geometry = radius
        ? new RoundedBoxGeometry(width, height, depth, 2, Math.min(radius, width / 2, height / 2, depth / 2))
        : new BoxGeometry(width, height, depth);
      const mesh = new Mesh(geometry, new MeshStandardMaterial({ color }));
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    },
    batch() {},
  };
}

function terminalPositions(product) {
  return buildPortTemplates(product).map(({key, side, offsetX}) => ({
    key, side, x: offsetX, y: (product.height / 2 - 5) * (side === "top" ? 1 : -1), z: product.depth + 8,
  }));
}

function boundsForPair(firstSku, secondSku) {
  const products = [firstSku, secondSku].map((sku) => CRESTRON_PRODUCTS.find((p) => p.sku === sku));
  const nodes = products.map((product, index) => ({
    id: `K${index + 1}`, role: "module", module: { id: `K${index + 1}` }, product,
    row: 0, slot: index ? products[0].modules : 0, pinned: true,
  }));
  const assembly = { nodes, occupied: [Array(36).fill(null)], box: { rows: 1, slots: 36, height: 600, topRail: 60, pitch: 150 } };
  compactModulePlacement(assembly, { modules: nodes.map((node) => node.module) });
  return nodes.map((node) => {
    const { group } = buildSmartDevice(geometryKit(), node.product);
    group.position.set(node.x, node.y, 0);
    group.updateMatrixWorld(true);
    const shell = group.children[0];
    const bounds = new Box3().setFromObject(shell);
    // At the front of the shell, a rounded edge must not leave a visible slit.
    const vertices = shell.geometry.attributes.position;
    let frontMin = Infinity, frontMax = -Infinity;
    for (let i = 0; i < vertices.count; i++) {
      if (Math.abs(vertices.getZ(i) - node.product.depth / 2) < 1e-5) {
        frontMin = Math.min(frontMin, vertices.getX(i) + node.x);
        frontMax = Math.max(frontMax, vertices.getX(i) + node.x);
      }
    }
    group.traverse((mesh) => { mesh.geometry?.dispose(); mesh.material?.dispose(); });
    return { bounds, frontMin, frontMax, width: node.product.width };
  });
}

describe("smart module physical shell contact", () => {
  it.each([
    ["DIN-8SW8-I", "DIN-8SW8-I"],
    ["DIN-1DIMU4", "DIN-8SW8-I"],
  ])("keeps %s and %s touching in full-width geometry and front view", (first, second) => {
    const [left, right] = boundsForPair(first, second);
    expect(left.bounds.max.x - left.bounds.min.x).toBeCloseTo(left.width, 5);
    expect(right.bounds.max.x - right.bounds.min.x).toBeCloseTo(right.width, 5);
    expect(right.bounds.min.x - left.bounds.max.x).toBeCloseTo(0, 5);
    expect(right.frontMin - left.frontMax).toBeCloseTo(0, 5);
  });
});

it("draws four separate DIN-4DIMU4 load groups and both NET blocks at the wiring endpoints", () => {
  const product = CRESTRON_PRODUCTS.find((item) => item.id === "crestron-din-4dimu4-6513187");
  const ports = terminalPositions(product);
  const kit = geometryKit();
  kit.text = vi.fn();
  const { group } = buildSmartDevice(kit, product, [
    ...ports, { key: "N_IN", side: "top", x: 38, y: 42, z: 68 },
  ]);
  const apertures = group.children.filter((mesh) => mesh.material.color?.getHexString() === "141b1c");
  expect(apertures.map((mesh) => mesh.position.toArray())).toEqual(ports.map(({ x, y, z }) => [x, y, z]));
  const topMarkings = kit.text.mock.calls.filter(([, , , , , y]) => y > 0).map(([, label]) => label);
  expect(topMarkings).toEqual([
    "N", "L", "CH1", "D", "N", "L", "CH2", "D",
    "N", "L", "CH3", "D", "N", "L", "CH4", "D",
  ]);
  const netMarkings = kit.text.mock.calls.filter(([, , , , , y]) => y < 0).map(([, label]) => label);
  expect(netMarkings).toEqual(["24", "Y", "Z", "G", "24", "Y", "Z", "G", "NET"]);
  group.traverse((mesh) => { mesh.geometry?.dispose(); mesh.material?.dispose(); });
});

it("draws the DIN-AP4 PWR block separately from both NET blocks", () => {
  const product = CRESTRON_PRODUCTS.find((item) => item.id === "crestron-din-ap4");
  const ports = terminalPositions(product);
  const kit = geometryKit();
  kit.text = vi.fn();
  const { group } = buildSmartDevice(kit, product, ports);
  const apertures = group.children.filter((mesh) => mesh.material.color?.getHexString() === "141b1c");
  expect(apertures.map((mesh) => mesh.position.toArray())).toEqual(ports.map(({ x, y, z }) => [x, y, z]));
  expect(kit.text.mock.calls.map(([, label]) => label)).toEqual([
    "24", "G", "24", "Y", "Z", "G", "24", "Y", "Z", "G", "PWR", "NET","G","TX","RX","RTS","CTS","COM 1",
  ]);
  group.traverse((mesh) => { mesh.geometry?.dispose(); mesh.material?.dispose(); });
});

it("aligns DIN-DALI-2 loop and NET ports with their markings and slide switch", () => {
  const product=CRESTRON_PRODUCTS.find(p=>p.id==='crestron-din-dali-2');
  const ports=terminalPositions(product);
  for(const [mode,switchX] of [['INT',-2.5],['EXT',2.5]]){
    const kit=geometryKit();
    kit.text=vi.fn(); kit.screw=vi.fn();
    const {group,toggle}=buildSmartDevice(kit,{...product,daliPowerMode:mode},ports);
    expect(toggle).toBeNull();
    expect(kit.screw.mock.calls.map(([,x,y,z])=>[x,y,z])).toEqual(ports.filter(p=>p.side==='top').map(p=>[p.x,p.y,p.z]));
    expect(kit.text.mock.calls.filter(([,label])=>label==='DA+'||label==='DA−').map(([,label])=>label))
      .toEqual(['DA+','DA−','DA+','DA−','DA+','DA−','DA+','DA−']);
    expect(group.children.find(m=>m.material.color?.getHexString()==='a7b0a9')?.position.x).toBe(switchX);
    const lowerPins=group.children.filter(m=>m.material.color?.getHexString()==='141b1c');
    expect(lowerPins.map(m=>m.position.toArray())).toEqual(ports.filter(p=>p.side==='bottom').map(p=>[p.x,p.y,p.z]));
    group.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});
  }
});

it("routes Cresnet Y, Z and G to the physical NET terminals on separate lanes", () => {
  const controller = terminalPositions(CRESTRON_PRODUCTS.find((item) => item.id === "crestron-din-ap4"));
  const dimmer = terminalPositions(CRESTRON_PRODUCTS.find((item) => item.id === "crestron-din-4dimu4-6513187"));
  const lanes = ["Y", "Z", "G"].map((pin) => {
    const from = controller.find((port) => port.key === `NET_${pin}`);
    const to = dimmer.find((port) => port.key === `NET2_${pin}`);
    const points = routeCabinetWire(from, to, pin, { width: 520 }).points;
    expect(points[0].toArray()).toEqual([from.x, from.y, from.z]);
    expect(points.at(-1).toArray()).toEqual([to.x, to.y, to.z]);
    expect(points[3].y).toBe(points[4].y);
    expect(points[3].z).toBe(points[4].z);
    return [points[3].y, points[3].z];
  });
  expect(new Set(lanes.map(([y]) => y)).size).toBe(3);
  expect(new Set(lanes.map(([, z]) => z)).size).toBe(3);
});

it("draws the PWS50 mains input, pass-through and three NET connectors at their wire anchors", () => {
  const product = CRESTRON_PRODUCTS.find(p => p.id === "crestron-din-pws50");
  const ports = terminalPositions(product);
  const kit = geometryKit();
  kit.text = vi.fn();
  const { group } = buildSmartDevice(kit, product, ports);
  const apertures = group.children.filter(mesh => mesh.material.color?.getHexString() === "141b1c");
  expect(apertures.map(mesh => mesh.position.toArray())).toEqual(ports.map(({x,y,z}) => [x,y,z]));
  expect(kit.text.mock.calls.filter(([, , , , , y]) => y > 0).map(([, text]) => text))
    .toEqual(["L","N","⏚","L","N","⏚"]);
  expect(kit.text.mock.calls.filter(([, , , , , y]) => y < 0).map(([, text]) => text))
    .toEqual(["FUSE","24","Y","Z","G","24","Y","Z","G","24","Y","Z","G","NET"]);
  group.traverse(mesh => { mesh.geometry?.dispose(); mesh.material?.dispose(); });
});

it("keeps all four cores visible on a Cresnet cascade sharing a row", () => {
  const a={x:-20,y:42,z:66,side:"bottom"}, b={x:40,y:42,z:66,side:"bottom"};
  const lanes=["DC+","Y","Z","DC-"].map(c => {
    const points=routeCabinetWire(a,b,c,{width:520},0,true).points;
    expect(points[0].toArray()).toEqual([a.x,a.y,a.z]);
    expect(points.at(-1).toArray()).toEqual([b.x,b.y,b.z]);
    return points[3];
  });
  expect(new Set(lanes.map(p=>p.y)).size).toBe(4);
  expect(new Set(lanes.map(p=>p.z)).size).toBe(4);
});

describe("USMART DIN-TCP serial terminals", () => {
  it.each([[4, 3, 1], [2, 1, 1]])("%s-port unit follows serialPortLayout: %s on top, %s underneath", async (count, top, bottom) => {
    const { USMART_PRODUCTS } = await import("../../src/data/products/smart-usmart.js");
    const product = USMART_PRODUCTS.find((p) => p.serialPorts === count);
    const kit = geometryKit(), terminals = [];
    const cube = kit.cube;
    kit.cube = (group, width, height, depth, x, y, z, color, ...rest) => {
      if (color === "#20a84b") terminals.push(y);
      return cube(group, width, height, depth, x, y, z, color, ...rest);
    };
    const { group } = buildSmartDevice(kit, product);
    expect(terminals.filter((y) => y > 0)).toHaveLength(top);
    expect(terminals.filter((y) => y < 0)).toHaveLength(bottom);
    expect(terminals.every((y) => Math.abs(y) > product.height / 2)).toBe(true);
    group.traverse((mesh) => { mesh.geometry?.dispose(); mesh.material?.dispose(); });
  });
});
