import { afterEach, describe, expect, it, vi } from "vitest";
import { Box3, BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { buildSmartDevice } from "../../src/view/smart-device3d.js";
import { compactModulePlacement } from "../../src/core/modules.js";
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
