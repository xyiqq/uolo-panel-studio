export const SWITCH_ORIENTATIONS=[['front','端口朝前'],['up','端口朝上'],['down','端口朝下']];
export function normalizeSwitchSettings(value={},product={}) {
  return {
    switchOrientation:SWITCH_ORIENTATIONS.some(([key])=>key===value.switchOrientation)?value.switchOrientation:'front',
    switchPortLabels:Object.fromEntries(Array.from({length:product.networkPorts||0},(_,i)=>[i+1,String(value.switchPortLabels?.[i+1]??'').trim().slice(0,24)])),
  };
}
/** 朝上/下时交换安装高度和深度，外壳仍使用原厂物理尺寸绘制。 */
export function networkSwitchProduct(product,module) {
  if(!product?.networkPorts||!module)return product;
  const settings=normalizeSwitchSettings(module,product),turned=settings.switchOrientation!=='front';
  return {...product,...settings,displayName:module.displayName||'',networkPhysicalHeight:product.height,networkPhysicalDepth:product.depth,
    height:turned?product.depth:product.height,depth:turned?product.height:product.depth};
}
