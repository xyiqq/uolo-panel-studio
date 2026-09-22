export const OPTIONAL_FEATURES = [
  ['electricalAudit','电气校核'],['busEditor','总线编辑'],['rowZoning','强弱电分排'],
];
export function featureVisible(design,key) {return design?.featureVisibility?.[key]===true;}
export function setFeatureVisible(design,key,value) {
  if(!OPTIONAL_FEATURES.some(([k])=>k===key))throw new Error('未知功能');
  design.featureVisibility={...design.featureVisibility,[key]:!!value};
}
export function normalizeOptionalSettings(design) {
  if(!design||typeof design!=='object')return design;
  if(design.rowZones!==undefined)design.rowZones=Array.isArray(design.rowZones)?design.rowZones.slice(0,12).map(zone=>['power','control'].includes(zone)?zone:'mixed'):[];
  if(design.featureVisibility!==undefined)design.featureVisibility=Object.fromEntries(OPTIONAL_FEATURES.map(([key])=>[key,design.featureVisibility?.[key]===true]));
  return design;
}
