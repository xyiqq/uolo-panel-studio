import * as THREE from 'three';
import {Studio3D} from './studio3d.js';
import {findProduct} from '../core/domain.js';
import {terminalWireSegments} from '../core/terminal-connections.js';

export class TerminalStudio3D extends Studio3D {
  signature(net) {
    return super.signature(net) + JSON.stringify([net.nodes.filter(n=>n.id==='N').map(n=>[n.x,n.y,n.barOrient]),net.assembly.nodes.map(n=>[n.id,n.product.hardwareId || '',n.product.ipAddress || '',n.product.displayName || ''])]);
  }
  build(net, design, runtime, options) {
    super.build(net, design, runtime, options);
    this.drawTerminalWires();
  }
  applyPose(amount=this.explosion) {
    super.applyPose(amount);
    if(this.terminalWires) this.drawTerminalWires();
  }
  drawTerminalWires() {
    const {net,design,options}=this;
    if(!net || !design || !this.model) return;
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
      if(this.terminalWiresVisible===false || options.isolate) return;
      const a = new THREE.Vector3(s.source.x,s.source.y,s.source.z);
      const b = new THREE.Vector3(s.target.x,s.target.y,s.target.z);
      const sourceOffset=this.model.refs.get(s.output.split(':')[0])?.group.position.z || 0;
      const targetOffset=this.model.refs.get(s.terminalId)?.group.position.z || 0;
      a.z+=sourceOffset;b.z+=targetOffset;
      const lane = Math.min(a.y,b.y)-18-(i%12)*5;
      const z = 3+Math.min(sourceOffset,targetOffset);
      addWire([a,new THREE.Vector3(a.x,a.y-10,a.z),new THREE.Vector3(a.x,a.y-10,z),new THREE.Vector3(a.x,lane,z),new THREE.Vector3(b.x,lane,z),new THREE.Vector3(b.x,b.y-10,z),new THREE.Vector3(b.x,b.y-10,b.z),b]);
      {
        const f = new THREE.Vector3(s.field.x,s.field.y,s.field.z+targetOffset);
        const labelY=f.y+32+Math.floor(i/4)*14;
        const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;
        const ctx=canvas.getContext('2d');ctx.fillStyle='#8d2424';ctx.fillRect(0,0,512,64);
        ctx.fillStyle='#ffffff';ctx.font='28px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s.fieldName,256,32,490);
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
        const label=new THREE.Mesh(new THREE.PlaneGeometry(76,9),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:true}));
        // Stagger labels in separate lanes so adjacent 5.2mm terminals stay legible.
        const lx=(i%4-1.5)*(net.assembly.box.width-80)/4;
        const routeY=labelY-10;
        addWire([f,new THREE.Vector3(f.x,routeY,f.z),new THREE.Vector3(lx,routeY,f.z),new THREE.Vector3(lx,labelY-4.5,f.z)]);
        label.position.set(lx,labelY,f.z);label.renderOrder=20;label.userData.fieldLabel=true;group.add(label);
      }
    });
    this.dirty = true;
  }
  clearTerminalWires(){
    if(!this.terminalWires) return;
    this.terminalWires.traverse(o=>{o.geometry?.dispose();if(o.userData.fieldLabel){o.material.map?.dispose();o.material.dispose()}});
    this.scene.remove(this.terminalWires);
    this.terminalMaterial?.dispose();
    this.terminalWires=null;
  }
  dispose(){this.clearTerminalWires();super.dispose();}
}
