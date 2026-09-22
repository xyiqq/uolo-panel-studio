import {Curve,Vector3} from 'three';

// Equal parameter spans keep TubeGeometry samples exactly on every right-angle bend.
export class OrthogonalWireCurve extends Curve {
  constructor(points){super();this.points=points;}
  getPoint(t,target=new Vector3()){
    const scaled=Math.max(0,Math.min(1,t))*(this.points.length-1);
    const i=Math.min(this.points.length-2,Math.floor(scaled));
    return target.copy(this.points[i]).lerp(this.points[i+1],scaled-i);
  }
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
