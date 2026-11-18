// Manufacturer interface maxima per output, independent of the switched load.
const ratings={
  'crestron-din-4dimflv4':{ma:60,sinkOnly:true},
  'lutron-lqse-4t10-d':{ma:50,sinkOnly:false},
};
export const driverDirections={source:'驱动器供流',sink:'驱动器吸流',mixed:'同路混合供流与吸流'};
export function normalizeAnalogCurrent(pair) {
  const options={};
  if(pair.driverRole!=null && pair.driverRole!=='')options.driverRole=Object.hasOwn(driverDirections,pair.driverRole)?pair.driverRole:'invalid';
  if(pair.interfaceMa!=null && pair.interfaceMa!==''){
    const value=typeof pair.interfaceMa==='string'&&pair.interfaceMa.trim()!==''?Number(pair.interfaceMa):pair.interfaceMa;
    options.interfaceMa=Number.isFinite(value)?value:'invalid';
  }
  return options;
}
export function analogCurrentStatus(product,pair={}) {
  const rating=ratings[product?.id];
  if(!rating)return null;
  const {driverRole,interfaceMa}=normalizeAnalogCurrent(pair);
  const ma=interfaceMa==null?'电流待核':interfaceMa==='invalid'?'电流无效':interfaceMa+' mA';
  const role=driverDirections[driverRole] || (driverRole?'方向无效':'方向待核');
  const limit=rating.ma+' mA';
  const detail=role+' · '+ma+' / '+limit;
  let error='';
  if(driverRole==='invalid'||driverRole==='mixed')error='同一路现场驱动器须采用一致的供流或吸流方向';
  else if(rating.sinkOnly && driverRole==='sink')error='该控制器只吸流，现场驱动器须供流';
  else if(interfaceMa==='invalid' || interfaceMa<0)error='接口总电流须为非负有限数值';
  else if(interfaceMa>rating.ma)error='现场驱动器接口总电流超过每路 '+limit;
  return {detail,error,pending:!error && (!driverRole || interfaceMa==null),
    capability:rating.sinkOnly?'控制器只吸流，最大 '+limit+'/路':'控制器可供流或吸流，最大 '+limit+'/路'};
}
