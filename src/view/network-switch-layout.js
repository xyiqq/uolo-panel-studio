/** 官网面板布局：小机型单排，ES116G-E 左侧双排、每列上下成对编号。 */
export function networkSwitchPortLayout(product) {
  if(product.networkProfile==='eg210gpe-v2')return Array.from({length:10},(_,i)=>({number:i+1,x:-product.width/2+24+i*16+(i>=8?6:0),y:0,name:product.networkPortNames?.[i]}));
  const dual=product.networkPortRows===2;
  return Array.from({length:product.networkPorts},(_,i)=>({
    number:i+1,
    x:-product.width/2+(dual?32:18)+(dual?Math.floor(i/2):i)*(dual?16:15.7),
    y:dual?(i%2===0?8:-8):1,
  }));
}
