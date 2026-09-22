import {rowAllows} from './row-zones.js';
export const placementRows=(product,box)=>product?.outletCount?Math.max(1,Math.ceil(product.height/box.pitch)):1;
export const placementColumns=product=>Math.max(1,Math.ceil(Number(product?.modules)||Math.ceil((Number(product?.width)||18)/18)));
export function canPlaceFootprint(design,product,box,occupied,pos,id){
  const rows=placementRows(product,box),cols=placementColumns(product),r=pos?.row,s=pos?.slot;
  if(!Number.isInteger(r)||!Number.isInteger(s)||r<0||s<0||r+rows>box.rows||s+cols>box.slots)return false;
  if(product.outletCount){const y=placementY(product,box,r);if(y+product.height/2>box.height/2||y-product.height/2<-box.height/2)return false;}
  for(let y=r;y<r+rows;y++)if(!rowAllows(design,product,y)||occupied[y].slice(s,s+cols).some(v=>v&&v!==id))return false;
  return true;
}
export function reserveFootprint(product,box,occupied,pos,id){
  for(let r=pos.row;r<pos.row+placementRows(product,box);r++)for(let s=pos.slot;s<pos.slot+placementColumns(product);s++)occupied[r][s]=id;
}
export const placementY=(product,box,row)=>box.height/2-box.topRail-(row+(placementRows(product,box)-1)/2)*box.pitch;
