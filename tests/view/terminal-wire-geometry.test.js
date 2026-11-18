import {it,expect} from 'vitest';
import {Vector3} from 'three';
import {routeDimmerJumper,terminalWireGeometry,terminalPanelWirePoints} from '../../src/view/wire-routing.js';

it('panel wire stays clear of the backplate and samples every elbow at full radius',()=>{
  const points=terminalPanelWirePoints(new Vector3(100,-100,65),new Vector3(-90,150,40));
  expect(Math.min(...points.map(p=>p.z))).toBe(38);
  const geometry=terminalWireGeometry(points,2.5);
  const {path,tubularSegments,radialSegments,radius}=geometry.parameters;
  const vertices=geometry.getAttribute('position');
  for(let i=0;i<=tubularSegments;i++) {
    const center=path.getPoint(i/tubularSegments);
    for(let j=0;j<=radialSegments;j++) {
      const vertex=new Vector3().fromBufferAttribute(vertices,i*(radialSegments+1)+j);
      expect(vertex.distanceTo(center)).toBeCloseTo(radius,4);
    }
  }
  points.forEach((p,i)=>expect(path.getPoint(i/(points.length-1)).distanceTo(p)).toBeLessThan(1e-8));
  geometry.dispose();
});

it('coincident bends and exploded depth remain finite',()=>{
  const points=terminalPanelWirePoints(new Vector3(5,0,38),new Vector3(5,100,38),0,50);
  expect(points[2].z).toBe(88);
  const geometry=terminalWireGeometry(points);
  expect([...geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
  geometry.dispose();
});

it('leaves an upper DIM output through the top of the module',()=>{
  const start = new Vector3(15, 30, 68);
  const points = terminalPanelWirePoints(start, new Vector3(-10, -30, 40), 0, 0, 'top');
  expect(points[0]).toEqual(start);
  expect(points[1].y).toBeGreaterThan(start.y);
  expect(points[2].z).toBe(38);
});

it('draws factory jumpers locally on separate L, N and D lanes',()=>{
  const from = {x:0, y:100, z:68}, to = {x:14.4, y:100, z:68};
  const curves = ['L', 'N', 'D'].map(terminal => routeDimmerJumper(from, to, terminal));
  for (const {points} of curves) {
    expect(points[0]).toMatchObject(from);
    expect(points.at(-1)).toMatchObject(to);
    expect(points.every(p => p.x >= from.x && p.x <= to.x && p.z === from.z)).toBe(true);
  }
  expect(new Set(curves.map(({points}) => points[1].y)).size).toBe(3);
});
