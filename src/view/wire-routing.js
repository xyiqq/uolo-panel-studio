import {Curve,Vector3,TubeGeometry} from 'three';

// Match the cabinet wire radius and keep every elbow on a sampled ring.
export function terminalWireGeometry(points, section = 1.5) {
  const clean = points.filter((p,i) => !i || !p.equals(points[i-1]));
  const radius = Math.min(3.2, Math.sqrt((Number(section) || 1.5)/Math.PI)*.65+.55);
  return new TubeGeometry(new TerminalWireCurve(clean), (clean.length-1)*8, radius, 8, false);
}

export function terminalPanelWirePoints(a,b,index=0,depthOffset=0,sourceSide='bottom') {
  const lane = Math.min(a.y,b.y)-18-(index%12)*5;
  const sourceExitY = a.y + (sourceSide === 'top' ? 10 : -10);
  // Cabinet backplate is at z=3; use the same z=38 wire plane as cabinet wiring.
  const z = 38 + depthOffset;
  return [a,new Vector3(a.x,sourceExitY,a.z),new Vector3(a.x,sourceExitY,z),
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
/** Keep the module's short jumpers local, with separate L/N/D lanes. */
export function routeDimmerJumper(from, to, terminal) {
  const y = Math.max(from.y, to.y) + { L: 11, N: 7, D: 15 }[terminal];
  return new OrthogonalWireCurve([
    new Vector3(from.x, from.y, from.z), new Vector3(from.x, y, from.z),
    new Vector3(to.x, y, to.z), new Vector3(to.x, to.y, to.z),
  ]);
}

function signalLane(conductor, cresnet, daliLoop, fromKey) {
  const serial = ['RS485-A','RS485-B','RS485-G'].indexOf(conductor);
  if (serial !== -1) return serial;
  const qs = ['COM','MUX','/MUX'].indexOf(conductor);
  if (qs !== -1) return qs;
  if (conductor === '0-10V+' || conductor === '0-10V-') return conductor === '0-10V+' ? 0 : 1;
  if (conductor === 'DA' && [1,2].includes(daliLoop)) return (daliLoop-1)*2 + (fromKey?.endsWith('_RIGHT') ? 1 : 0);
  if ((daliLoop === 1 || daliLoop === 2) && ['BUS+', 'BUS-'].includes(conductor)) {
    return (daliLoop - 1) * 2 + (conductor === 'BUS-' ? 1 : 0);
  }
  if (cresnet && conductor === 'DC+') return 3;
  if (cresnet && conductor === 'DC-') return 2;
  return ['Y', 'Z', 'G'].indexOf(conductor);
}

export function hasSignalLane(edge) {
  return signalLane(edge.conductor, edge.cresnet, edge.daliLoop,edge.from) >= 0;
}

function routeSignalWire(from, to, index) {
  const offset = 13 + index * 5;
  const startY = from.y + (from.side === 'bottom' ? -offset : offset);
  const endY = to.y + (to.side === 'bottom' ? -offset : offset);
  const laneY = from.side === 'top' && to.side === 'top' ? Math.max(startY, endY) + 4 : Math.min(startY, endY) - 4;
  const z = 43 + index * 5;
  return new OrthogonalWireCurve([
    new Vector3(from.x, from.y, from.z), new Vector3(from.x, startY, from.z),
    new Vector3(from.x, startY, z), new Vector3(from.x, laneY, z),
    new Vector3(to.x, laneY, z), new Vector3(to.x, endY, z),
    new Vector3(to.x, endY, to.z), new Vector3(to.x, to.y, to.z),
  ]);
}

export function routeCabinetWire(from,to,conductor,box,neutralX=0,cresnet=false,daliLoop){
  const index = signalLane(conductor, cresnet, daliLoop,from.key||from.id);
  if (index !== -1) return routeSignalWire(from, to, index);
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
