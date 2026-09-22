export function normalizePduSettings(raw={},product={}){
  const limits={length:[100,1600],height:[40,120],depth:[20,160]},size={};
  for(const [key,[min,max]] of Object.entries(limits)){
    const value=raw.pduSize?.[key];if(Number.isFinite(value)&&value>=min&&value<=max)size[key]=value;
  }
  return {pduOrientation:raw.pduOrientation==='horizontal'?'horizontal':'vertical',pduSize:size,
    outletLabels:Object.fromEntries(Array.from({length:product.outletCount||0},(_,i)=>[i+1,String(raw.outletLabels?.[i+1]??'').trim().slice(0,24)]))};
}
export function pduInstanceProduct(product,module){
  if(!product?.outletCount)return product;
  const settings=normalizePduSettings(module||{},product),vertical=settings.pduOrientation==='vertical';
  const length=settings.pduSize.length??product.pduPhysicalLength,height=settings.pduSize.height??product.pduPhysicalHeight,depth=settings.pduSize.depth??product.pduPhysicalDepth;
  return {...product,...settings,displayName:module?.displayName||'',pduPhysicalLength:length,pduPhysicalHeight:height,pduPhysicalDepth:depth,
    width:vertical?height:length,height:vertical?length:height,depth,modules:Math.ceil((vertical?height:length)/18)};
}
export const pduOutlets=product=>{
  const length=product.pduPhysicalLength||product.width,step=(length-100)/product.outletCount;
  return Array.from({length:product.outletCount},(_,i)=>({number:i+1,x:-length/2+70+(i+.5)*step,y:3,step}));
};
