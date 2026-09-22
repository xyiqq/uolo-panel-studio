import {pA,rA} from './three-shim.js';
import {pduOutlets} from '../core/pdu-settings.js';
import {PDU_SOCKET_HOLES} from './pdu-socket-layout.js';

/** GNE系列参考外观：铝壳、蓝色端盖、带护罩总开、逐位国标五孔。 */
export function buildPduDevice(kit,p,label,texture){
  const shell=new pA(),outer=new pA(),length=p.pduPhysicalLength||p.width,h=p.pduPhysicalHeight||44,d=p.pduPhysicalDepth||44;
  const vertical=p.pduOrientation==='vertical';
  kit.cube(shell,length-28,h,d,0,0,d/2+6,'#354047',.8,.45);
  for(const side of [-1,1]){
    kit.cube(shell,5,h+1,d+1,side*(length/2-16),0,d/2+6,'#238daf',.5,.35);
    kit.cube(shell,14,4,15,side*(length/2-7),h/2-2,d-2,'#a1a9ad',.4,.2);
    kit.screw(shell,side*(length/2-7),h/2-2,d+6,2);
    kit.cube(shell,length-35,1,1,0,side*(h/2-4),d+6.3,'#68747a',.1,.5);
  }
  const control=-length/2+43;
  kit.cube(shell,28,h-4,1,control,0,d+6.7,'#2188a6',1);
  kit.cube(shell,15,19,2,control,-1,d+8,'#17242b',1);
  kit.cube(shell,11,14,2,control,-1,d+9.5,'#3e8e66',.7);
  kit.text(shell,'I / O',10,3,control,-1,d+11,'#f5faf4','#3e8e66');
  const cover=kit.cube(shell,19,23,4,control,-1,d+10,'#adcbd5',1);
  cover.material=kit.own(new rA({color:'#c8e6ee',transparent:true,opacity:.18,roughness:.15,depthWrite:false}));
  kit.text(shell,'BULL 公牛',25,3.8,control,h/2-5,d+8,'#ffffff','#2188a6');
  for(const outlet of pduOutlets(p)){
    const face=kit.cube(shell,Math.min(37,outlet.step-3),h-5,1.2,outlet.x,0,d+7,'#1e272d',1.2);
    face.userData.pduOutlet=outlet.number;
    for(const slot of PDU_SOCKET_HOLES){
      const hole=kit.cube(shell,slot.width,slot.height,.7,outlet.x+slot.x,slot.y,d+8,'#070c10',.25);
      hole.rotation.z=slot.angle;
    }
  }
  kit.batch(shell);
  if(vertical)shell.rotation.z=-Math.PI/2;
  outer.add(shell);
  // 标签独立于机壳旋转，竖装后文字仍水平可读。
  for(const outlet of pduOutlets(p)){
    const width=vertical?h-3:Math.min(outlet.step-3,45),height=9;
    const tex=texture(kit,{...p,faceRole:'pdu-outlet-label',outletNumber:outlet.number,outletText:p.outletLabels?.[outlet.number]||''},width,height);
    const x=vertical?0:outlet.x,y=vertical?-outlet.x-outlet.step/2+7:-h/2+5.5;
    kit.decal(outer,tex,width,height,x,y,d+9);
  }
  if(p.displayName){
    const width=vertical?h-2:30,tex=texture(kit,{...p,faceRole:'module-note'},width,7);
    kit.decal(outer,tex,width,7,vertical?0:control,vertical?length/2-17:h/2+5,d+9.2);
  }
  if(label)kit.text(outer,label,vertical?Math.max(h,40):length,6,0,-(vertical?length:h)/2-9,d+9,'#dbe4e0','#1c292f');
  outer.userData.pduOrientation=vertical?'vertical':'horizontal';
  return {group:outer,toggle:null,led:null};
}
