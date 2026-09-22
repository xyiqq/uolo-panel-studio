/** 以横装机身坐标定义；竖装顺时针90°后匹配用户实物图：左侧两斜孔、右侧三横孔。 */
export const PDU_SOCKET_HOLES = [
  ...[-6,0,6].map(x=>({x,y:7,width:2.2,height:7.2,angle:0,kind:'straight'})),
  {x:-7,y:-7,width:2.2,height:7.2,angle:Math.PI/6,kind:'angled'},
  {x:7,y:-7,width:2.2,height:7.2,angle:-Math.PI/6,kind:'angled'},
];
export function socketHolePolygon(hole){
  const c=Math.cos(hole.angle),s=Math.sin(hole.angle);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{
    const dx=x*hole.width/2,dy=y*hole.height/2;
    return {x:hole.x+dx*c-dy*s,y:hole.y+dx*s+dy*c};
  });
}
