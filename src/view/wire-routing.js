import {Curve,Vector3,TubeGeometry} from 'three';

// Match the cabinet wire radius and keep every elbow on a sampled ring.
export function terminalWireGeometry(points, section = 1.5) {
  const clean = points.filter((p,i) => !i || !p.equals(points[i-1]));
  const radius = Math.min(3.2, Math.sqrt((Number(section) || 1.5)/Math.PI)*.65+.55);
  return new TubeGeometry(new TerminalWireCurve(clean), (clean.length-1)*8, radius, 8, false);
}

export function terminalPanelWirePoints(a,b,index=0,depthOffset=0) {
  const lane = Math.min(a.y,b.y)-18-(index%12)*5;
  // Cabinet backplate is at z=3; use the same z=38 wire plane as cabinet wiring.
  const z = 38 + depthOffset;
  return [a,new Vector3(a.x,a.y-10,a.z),new Vector3(a.x,a.y-10,z),
    new Vector3(a.x,lane,z),new Vector3(b.x,lane,z),new Vector3(b.x,b.y-10,z),
    new Vector3(b.x,b.y-10,b.z),b];
}

// Equal parameter spans keep TubeGeometry samples exactly on every right-angle bend.
export class OrthogonalWireCurve extends Curve {
  constructor(points){super();this.points=points;}
  getPoint(t,target=new Vector3()){
    const scaled=Math.max(0,Math.min(1,t))*(this.points.length-1);
    const i=Math.min(this.points.length-2,Math.floor(scaled));
    return target.copy(this.points[i]).lerp(this.points[i+1],scaled-i);
  }
}
// TubeGeometry uses arc-length sampling by default, which skips short elbow segments.
class TerminalWireCurve extends OrthogonalWireCurve {
  getPointAt(t,target){return this.getPoint(t,target);}
  getTangentAt(t,target){return this.getTangent(t,target);}
}
export function routeCabinetWire(from,to,conductor,box,neutralX=0){
  const lane=conductor==='PE'?box.width/2-23:conductor==='N'?(neutralX>0?box.width/2-43:-box.width/2+27):-box.width/2+45+Math.max(0,['L1','L2','L3'].indexOf(conductor))*8;
  const startY=from.y+(from.side==='bottom'?-13:13);
  const endY=to.y+(to.side==='bottom'?-13:13);
  const z=38;
  const p=(x,y,z)=>new Vector3(x,y,z);
  return new OrthogonalWireCurve([
    p(from.x,from.y,from.z),p(from.x,startY,from.z),p(from.x,startY,z),
    p(lane,startY,z),p(lane,endY,z),p(to.x,endY,z),p(to.x,endY,to.z),p(to.x,to.y,to.z),
  ]);
}
