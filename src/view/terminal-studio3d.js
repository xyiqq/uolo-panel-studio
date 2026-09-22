import * as THREE from 'three';
import {Studio3D} from './studio3d.js';
import {findProduct} from '../core/domain.js';
import {terminalWireSegments} from '../core/terminal-connections.js';
import {terminalWireGeometry, terminalPanelWirePoints, routeCabinetWire, OrthogonalWireCurve} from './wire-routing.js';
import {terminalLabelLayout} from './terminal-label-layout.js';
import {nodeExplosionOffset, connectionInspection, wireTouchesSelection} from './exploded-wiring.js';

export class TerminalStudio3D extends Studio3D {
  /** Full cabinet export, independent of viewport size, selection and exploded inspection. */
  screenshot() { return this.captureDocumentImage({mimeType:'image/png'}); }
  captureDocumentImage({mimeType='image/jpeg'}={}) {
    if(!this.model||this.contextLost)return null;
    const renderer=this.renderer,size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();
    const saved={options:this.options,selected:this.selected,hovered:this.hovered,explosion:this.explosion,explosionTarget:this.explosionTarget,background:this.scene.background,floor:this.floor.visible};
    try {
      this.options={...this.options,isolate:false,exploded:false,explodeScope:'all',door:false,wireMode:'all',selected:null,sim:{...this.options.sim,power:false}};
      this.selected=null;this.hovered=null;this.explosion=0;this.explosionTarget=0;
      this.applyPose(0);this.updateVisibility();this.updateHighlight();this.floor.visible=false;
      this.scene.background=new THREE.Color('#f4f6f4');
      const bounds=this.bounds(false,false),center=bounds.getCenter(new THREE.Vector3());
      const extent=bounds.getSize(new THREE.Vector3()),aspect=1200/1500;
      const halfHeight=Math.max(extent.y,extent.x/aspect)*.56,halfWidth=halfHeight*aspect;
      const distance=Math.max(extent.x,extent.y,extent.z)+1;
      const camera=new THREE.OrthographicCamera(-halfWidth,halfWidth,halfHeight,-halfHeight,.1,distance*4);
      camera.position.set(center.x,center.y,center.z+distance);camera.lookAt(center);
      camera.updateProjectionMatrix();camera.updateMatrixWorld();
      renderer.setPixelRatio(1);renderer.setSize(1200,1500,false);renderer.shadowMap.needsUpdate=true;
      renderer.render(this.scene,camera);
      return renderer.domElement.toDataURL(mimeType,.9);
    } finally {
      this.options=saved.options;this.selected=saved.selected;this.hovered=saved.hovered;this.explosion=saved.explosion;this.explosionTarget=saved.explosionTarget;
      this.scene.background=saved.background;this.applyPose(saved.explosion);this.updateVisibility();this.updateHighlight();this.floor.visible=saved.floor;
      renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);this.shadowDirty=true;this.dirty=true;
    }
  }
  signature(net) {
    return super.signature(net) + JSON.stringify([net.nodes.filter(n=>n.id==='N').map(n=>[n.x,n.y,n.barOrient]),net.assembly.nodes.map(n=>[n.id,n.product.hardwareId || '',n.product.ipAddress || '',n.product.displayName || ''])]);
  }
  build(net, design, runtime, options) {
    this.terminalPoseKey=null;
    this.clearTerminalWires(true);
    this.segments=terminalWireSegments(design,net.assembly,id=>findProduct(design,id),net);
    this.inspection=connectionInspection(net,this.segments,options.selected);
    super.build(net,design,runtime,options);
    this.drawTerminalWires();
  }
  offset(id, amount=this.poseAmount??this.explosion) {
    return nodeExplosionOffset(this.net.nodes.find(n=>n.id===id),amount,this.options,this.inspection?.levels);
  }
  compactChain() {
    return this.inspection?.chain&&(this.options.isolate||(this.options.exploded&&this.options.explodeScope==='selected'));
  }
  displayedPorts(edge) {
    const from=this.net.ports[edge.from];
    let to=this.net.ports[edge.to];
    if(edge.moduleNeutral) {
      const module=this.net.nodes.find(n=>n.id===edge.moduleId);
      if(module) to={...to,node:module.id,x:module.x+module.product.width/2+12,y:module.y-module.product.height/2-12,z:module.product.depth+8,loadNeutralReference:true,side:'top'};
    }
    const localNeutral=edge.moduleNeutral&&(this.options.isolate||(this.options.exploded&&this.options.explodeScope==='selected'));
    if((this.compactChain()||localNeutral)&&(edge.moduleFeed||edge.moduleNeutral)&&!this.inspection.levels.has(from.node)) {
      // A labelled local supply reference replaces the off-screen neutral bar
      // lead in inspection only; the actual electrical edge remains unchanged.
      return [{...from,x:to.x+35,y:to.y+30,z:to.z+this.offset(to.node),side:'bottom',supplyReference:true},to];
    }
    return [from,to];
  }
  applyPose(amount=this.explosion) {
    if(!this.model) return;
    this.poseAmount=amount;
    const single=this.options.explodeScope==='selected'||this.options.isolate;
    super.applyPose(single?0:amount);
    if(single) {
      for(const [id,ref] of this.model.refs) ref.group.position.z=this.offset(id,amount);
      this.model.root.updateMatrixWorld(true);
    }
    this.updateNetWirePose();
    this.drawTerminalWires();
  }
  updateNetWirePose() {
    for(const ref of this.model.wires.values()) {
      const [from,to]=this.displayedPorts(ref.edge);
      const a=from.supplyReference?0:this.offset(from.node),b=this.offset(to.node),key=`${a}:${b}:${this.compactChain()}:${from.x}:${from.y}:${from.z}:${to.x}:${to.y}:${to.z}`;
      if(ref.poseKey===key) continue;
      ref.poseKey=key;
      let curve=routeCabinetWire(from,to,ref.edge.conductor,this.model.box,this.net.nodes.find(n=>n.id==='N')?.x);
      if(this.compactChain()||from.supplyReference) {
        const startY=from.y+(from.side==='bottom'?-13:13),endY=to.y+(to.side==='bottom'?-13:13),z=38;
        curve=new OrthogonalWireCurve([new THREE.Vector3(from.x,from.y,from.z),new THREE.Vector3(from.x,startY,from.z),new THREE.Vector3(from.x,startY,z),new THREE.Vector3(to.x,startY,z),new THREE.Vector3(to.x,endY,z),new THREE.Vector3(to.x,endY,to.z),new THREE.Vector3(to.x,to.y,to.z)]);
      }
      const points=curve.points;
      // Pull endpoint leads with the devices, keeping the cabinet trunk in place.
      points[0].z+=a;points[1].z+=a;points.at(-2).z+=b;points.at(-1).z+=b;
      if(ref.dynamicGeometry) ref.mesh.geometry.dispose();
      ref.mesh.geometry=terminalWireGeometry(points,ref.edge.section);
      if(ref.stripe) {
        if(ref.dynamicGeometry) ref.stripe.geometry.dispose();
        ref.stripe.geometry=new THREE.TubeGeometry(curve,56,ref.radius*.48,4,false);
      }
      ref.dynamicGeometry=true;ref.curve=curve;
    }
  }
  updateVisibility() {
    super.updateVisibility();
    if(!this.model) return;
    const isolate=this.options.isolate&&!!this.resolvePart();
    if(isolate) {
      const context=this.inspection.context;
      for(const [id,part] of this.model.parts) part.visible=context.has(id);
      // The base renderer batches passive hardware into one layer. Keep it hidden
      // and show only the connected passive ports below, not unrelated bars/loads.
      this.model.layers.terminals.visible=false;
    }
    this.model.layers.wires.visible=this.options.wireMode!=='none';
    for(const ref of this.model.wires.values()) {
      const hiddenSupply=[ref.edge.from,ref.edge.to].some(id=>this.net.nodes.find(n=>n.id===this.net.ports[id]?.node)?.role==='service');
      const direct=this.inspection?.wireIds.has(ref.edge.id)??wireTouchesSelection(this.net,ref.edge,this.selected);
      const replaced=this.segments?.some(s=>s.replacedWireId===ref.edge.id);
      const visible=!hiddenSupply&&!replaced&&this.options.wireMode!=='none'&&(isolate?direct:this.options.wireMode==='all'||direct||ref.mesh.visible);
      ref.mesh.visible=visible;
      if(ref.stripe) ref.stripe.visible=visible&&ref.edge.connected;
    }
    this.activePulses=this.activePulses.filter(ref=>ref.mesh.visible);
    this.pulses.forEach((pulse,index)=>pulse.visible=index<this.activePulses.length);
    if(isolate||this.explosionTarget||this.explosion) {
      this.activePulses=[];this.pulses.forEach(p=>p.visible=false);
    }
    this.drawTerminalWires();
  }
  label(text,width=100,height=10,color='#8d2424',identity=text) {
    this.wireLabels ||= new Map();
    const key=JSON.stringify([identity,text,width,height,color]);
    if(!this.wireLabels.has(key)) {
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=96;
      const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1024,96);
      ctx.fillStyle='#fff';ctx.font='42px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,48,1000);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const label=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:true}));
      label.renderOrder=20;label.userData.fieldLabel=true;label.userData.text=text;
      this.wireLabels.set(key,label);
    }
    return this.wireLabels.get(key);
  }
  drawTerminalWires() {
    const {net,design,options}=this;
    if(!net||!design||!this.model) return;
    const poseKey=JSON.stringify([this.poseAmount,this.selected,options.explodeScope,options.exploded,options.isolate,options.wireMode,this.terminalWiresVisible,[...this.model.wires.values()].filter(r=>r.mesh.visible).map(r=>r.edge.id)]);
    if(this.terminalPoseKey===poseKey&&this.terminalWires) return;
    this.terminalPoseKey=poseKey;
    this.clearTerminalWires();
    const group=new THREE.Group();group.name='connection-details';
    this.terminalWires=group;this.scene.add(group);
    const segments=this.segments||[],layout=terminalLabelLayout(segments,net.assembly.box);
    this.terminalMaterial ||= new THREE.MeshStandardMaterial({color:'#d93636',roughness:.5});
    const addWire=(points,section)=>group.add(new THREE.Mesh(terminalWireGeometry(points,section),this.terminalMaterial));
    const detail=!!(options.exploded||options.isolate);
    const detailId=this.compactChain()?net.nodes.find(n=>this.inspection.levels.has(n.id)&&n.role==='module'&&n.product?.kind!=='terminal')?.id||this.selected:this.selected;
    const selectedNode=net.nodes.find(n=>n.id===detailId);
    let detailIndex=0;
    const addDetail=(text,color)=>{
      if(!selectedNode) return;
      const label=this.label(text,190,12,color);
      label.position.set(selectedNode.x+(selectedNode.product?.width||40)/2+108,selectedNode.y+52-detailIndex++*15,Math.max(selectedNode.product?.depth||80,90)+this.offset(detailId)+12);
      group.add(label);
    };
    segments.forEach((s,i)=>{
      const outputId=(s.physicalOutput||s.output).split(':')[0],direct=this.inspection.segmentIds.has(s.id);
      if(this.terminalWiresVisible===false||options.wireMode==='none'||((options.isolate||options.wireMode!=='all')&&!direct)) return;
      const sourceOffset=this.offset(outputId),targetOffset=this.offset(s.terminalId);
      const a=new THREE.Vector3(s.source.x,s.source.y,s.source.z+sourceOffset),b=new THREE.Vector3(s.target.x,s.target.y,s.target.z+targetOffset);
      addWire(terminalPanelWirePoints(a,b,i,Math.min(sourceOffset,targetOffset)),s.section);
      if(detail&&direct) {
        addDetail(`${(s.physicalOutput||s.output).replace('_OUT','')} → ${s.id} · ${s.wireNo||'无线号'} · ${s.section?`${s.section} mm²`:'线径待核'}`,'#8d2424');
      }
      if(!detail&&layout.labels[i]) {
        const f=new THREE.Vector3(s.field.x,s.field.y,s.field.z+targetOffset),{x,y,width,height}=layout.labels[i];
        const label=this.label(s.fieldName,width,height,'#8d2424',s.id);
        addWire([f,new THREE.Vector3(f.x,y-10,f.z),new THREE.Vector3(x,y-10,f.z),new THREE.Vector3(x,y-4.5,f.z)],s.section);
        label.position.set(x,y,f.z);group.add(label);
      }
    });
    // DIN-8SW8 has no N input: this endpoint represents the outgoing load neutral,
    // not a terminal on the relay. Keep its true X-load edge in the electrical net.
    if(options.wireMode!=='none') for(const ref of this.model.wires.values()) {
      if(!ref.mesh.visible||!ref.edge.moduleNeutral) continue;
      const [,port]=this.displayedPorts(ref.edge);
      const marker=new THREE.Mesh(new THREE.SphereGeometry(3,8,6),ref.mesh.material);
      marker.position.set(port.x,port.y,port.z+this.offset(port.node));group.add(marker);
      const label=this.label(`${ref.edge.moduleId} 负载零线（直达负载）`,140,10,'#28546a');
      label.position.copy(marker.position).add(new THREE.Vector3(-70,-13,4));group.add(label);
    }
    if(detail&&options.wireMode!=='none') {
      const shownPorts=new Set();
      for(const ref of this.model.wires.values()) if(ref.mesh.visible&&this.inspection.wireIds.has(ref.edge.id)) {
        const w=ref.edge;addDetail(`${w.from} → ${w.moduleNeutral?`${w.moduleId}负载零线`:w.to} · ${w.conductor} · ${w.section} mm²`,'#28546a');
        if(options.isolate) for(const id of [w.from,w.to]) {
          const port=this.displayedPorts(w)[id===w.from?0:1];
          if(this.model.parts.has(port.node)||shownPorts.has(id)) continue;
          shownPorts.add(id);
          const marker=new THREE.Mesh(new THREE.SphereGeometry(3,8,6),ref.mesh.material);
          marker.position.set(port.x,port.y,port.z+(port.supplyReference?0:this.offset(port.node)));group.add(marker);
          const label=this.label(`${id} ${port.supplyReference?'零线排引入':'接线点'}`,75,9,'#28546a');
          label.position.copy(marker.position).add(new THREE.Vector3(0,10,4));group.add(label);
        }
      }
    }
    if(!detail&&layout.overflow&&this.terminalWiresVisible!==false&&options.wireMode!=='none') {
      const item=layout.overflow,label=this.label(`另 ${item.count} 路：见端子连接`,item.width,item.height);
      label.position.set(item.x,item.y,Math.max(...segments.map(s=>s.field.z)));group.add(label);
    }
    this.dirty=true;
  }
  bounds(focused=false,target=false) {
    if(!this.model) return new THREE.Box3();
    const previous=this.poseAmount??this.explosion;
    if(target) this.applyPose(this.explosionTarget);
    const bounds=super.bounds(focused,false);
    if(this.options.exploded||this.options.isolate) {
      for(const part of this.model.parts.values()) if(part.visible&&this.options.isolate) bounds.union(new THREE.Box3().setFromObject(part));
      if(this.model.layers.wires.visible) for(const ref of this.model.wires.values()) if(ref.mesh.visible) bounds.union(new THREE.Box3().setFromObject(ref.mesh));
      if(this.terminalWires) bounds.union(new THREE.Box3().setFromObject(this.terminalWires));
    }
    if(target) this.applyPose(previous);
    return bounds;
  }
  clearTerminalWires(labels=false) {
    if(this.terminalWires) {
      for(const child of [...this.terminalWires.children]) {
        if(child.userData.fieldLabel) child.removeFromParent();else child.geometry?.dispose();
      }
      this.scene.remove(this.terminalWires);this.terminalWires=null;
    }
    if(labels) {
      for(const label of this.wireLabels?.values()||[]) {label.geometry.dispose();label.material.map.dispose();label.material.dispose();}
      this.wireLabels?.clear();
    }
  }
  releaseModel() {
    for(const ref of this.model?.wires.values()||[]) if(ref.dynamicGeometry) {ref.mesh.geometry.dispose();ref.stripe?.geometry.dispose();}
    super.releaseModel();
  }
  dispose() {this.clearTerminalWires(true);this.terminalMaterial?.dispose();super.dispose();}
}
