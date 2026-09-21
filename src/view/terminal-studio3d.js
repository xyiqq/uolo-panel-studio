import * as THREE from 'three';
import {Studio3D} from './studio3d.js';
import {findProduct} from '../core/domain.js';
import {terminalWireSegments} from '../core/terminal-connections.js';

export class TerminalStudio3D extends Studio3D {
  signature(net) {
    return super.signature(net) + JSON.stringify(net.assembly.nodes.map(n=>[n.id,n.product.hardwareId || '']));
  }
  build(net, design, runtime, options) {
    super.build(net, design, runtime, options);
    this.clearTerminalWires();
    const group = new THREE.Group();
    this.terminalWires = group;
    this.scene.add(group);
    const segments = terminalWireSegments(design, net.assembly, id=>findProduct(design,id));
    const material = new THREE.MeshStandardMaterial({color:'#d93636',roughness:.5});
    this.terminalMaterial = material;
    const addWire = points => {
      const path = new THREE.CurvePath();
      for(let i=1;i<points.length;i++) path.add(new THREE.LineCurve3(points[i-1],points[i]));
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(path,60,.9,6,false),material);
      group.add(mesh);
    };
    segments.forEach((s,i)=>{
      if(this.terminalWiresVisible===false || options.isolate || options.exploded) return;
      const a = new THREE.Vector3(s.source.x,s.source.y,s.source.z);
      const b = new THREE.Vector3(s.target.x,s.target.y,s.target.z);
      const lane = Math.min(a.y,b.y)-18-(i%12)*5;
      const z = 3;
      addWire([a,new THREE.Vector3(a.x,a.y-10,a.z),new THREE.Vector3(a.x,a.y-10,z),new THREE.Vector3(a.x,lane,z),new THREE.Vector3(b.x,lane,z),new THREE.Vector3(b.x,b.y-10,z),new THREE.Vector3(b.x,b.y-10,b.z),b]);
      if(s.loadName){
        const f = new THREE.Vector3(s.field.x,s.field.y,s.field.z);
        addWire([f,new THREE.Vector3(f.x,f.y+45,f.z)]);
      }
    });
    this.dirty = true;
  }
  clearTerminalWires(){
    if(!this.terminalWires) return;
    this.terminalWires.traverse(o=>o.geometry?.dispose());
    this.scene.remove(this.terminalWires);
    this.terminalMaterial?.dispose();
    this.terminalWires=null;
  }
  dispose(){this.clearTerminalWires();super.dispose();}
}
