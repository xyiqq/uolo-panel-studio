import {daliCresnetWatts,daliPowerMode} from '../core/dali-power.js';

export function daliSettingsSummary(module,product){
  const mode=daliPowerMode(module);
  const watts=daliCresnetWatts(product,mode);
  return `DALI POWER · ${['INT','EXT'].includes(mode)?mode:'拨档待核'} · Cresnet 供电时 ${watts!=null?watts+' W':'功耗待核'}`;
}
