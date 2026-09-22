import {it,expect} from 'vitest';
import {Vector3} from 'three';
import {terminalWireGeometry,terminalPanelWirePoints} from '../../src/view/wire-routing.js';

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
