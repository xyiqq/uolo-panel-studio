import {rowAllows} from './row-zones.js';
export const placementRows=(product,box)=>product?.outletCount?Math.max(1,Math.ceil(product.height/box.pitch)):1;
export const placementColumns=product=>Math.max(1,Math.ceil(Number(product?.modules)||Math.ceil((Number(product?.width)||18)/18)));
export const placementWidth=product=>Number(product?.width)>0?Number(product.width):placementColumns(product)*18;

/** Integer slots remain saved anchors; compacted assemblies use actual millimetre bounds. */
export function usePhysicalOccupancy(occupied,excludedIds=new Set()){
  const footprints=[];
  occupied.forEach((line,row)=>line.forEach((id,slot)=>{
    if(id&&!excludedIds.has(id))footprints.push({id,row,left:slot*18,right:(slot+1)*18});
  }));
  Object.defineProperty(occupied,'footprints',{value:footprints,writable:true,configurable:true});
  refreshOccupancyCells(occupied);
}
function refreshOccupancyCells(occupied){
  for(const line of occupied)line.fill(null);
  for(const item of occupied.footprints)for(let s=Math.floor(item.left/18);s<Math.ceil((item.right-1e-7)/18);s++){
    if(occupied[item.row]&&s>=0&&s<occupied[item.row].length)occupied[item.row][s]??=item.id;
  }
}
export function canPlaceFootprint(design,product,box,occupied,pos,id){
  const rows=placementRows(product,box),cols=placementColumns(product),r=pos?.row,s=pos?.slot;
  if(!Number.isInteger(r)||!Number.isInteger(s)||r<0||s<0||r+rows>box.rows)return false;
  if(product.outletCount){const y=placementY(product,box,r);if(y+product.height/2>box.height/2||y-product.height/2<-box.height/2)return false;}
  if(occupied.footprints){
    const left=pos.left??s*18,right=left+placementWidth(product);
    if(left<0||right>box.slots*18+1e-7)return false;
    for(let y=r;y<r+rows;y++)if(!rowAllows(design,product,y)||occupied.footprints.some(f=>f.row===y&&f.id!==id&&left<f.right-1e-7&&right>f.left+1e-7))return false;
    return true;
  }
  if(s+cols>box.slots)return false;
  for(let y=r;y<r+rows;y++)if(!rowAllows(design,product,y)||occupied[y].slice(s,s+cols).some(v=>v&&v!==id))return false;
  return true;
}
export function reserveFootprint(product,box,occupied,pos,id){
  if(occupied.footprints){
    occupied.footprints=occupied.footprints.filter(f=>f.id!==id);
    const left=pos.left??pos.slot*18;
    for(let row=pos.row;row<pos.row+placementRows(product,box);row++)occupied.footprints.push({id,row,left,right:left+placementWidth(product)});
    refreshOccupancyCells(occupied);
    return;
  }
  for(let r=pos.row;r<pos.row+placementRows(product,box);r++)for(let s=pos.slot;s<pos.slot+placementColumns(product);s++)occupied[r][s]=id;
}
export const placementY=(product,box,row)=>box.height/2-box.topRail-(row+(placementRows(product,box)-1)/2)*box.pitch;
