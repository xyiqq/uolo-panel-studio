/** 只解析当前本地方案的定位链接，不加载、迁移或覆盖其他方案。 */
export function resolveDesignLink(locationHref, design) {
  const result=(status,message='',designId=null,circuitId=null)=>({status,message,designId,circuitId});
  let url;
  try {url=new URL(locationHref);} catch {return result('invalid','方案链接无效，请检查完整网址。');}
  if(!/\/d(?:\/|$)/.test(url.pathname))return result('none');
  const match=url.pathname.match(/\/d\/([^/]+)\/?$/);
  if(!match||!['http:','https:'].includes(url.protocol))return result('invalid','方案链接格式无效，应为 /d/方案ID。');
  let designId;
  try {designId=decodeURIComponent(match[1]);} catch {return result('invalid','方案链接中的 ID 编码无效。');}
  if(!designId.trim()||url.searchParams.getAll('c').length>1)return result('invalid','方案或回路 ID 无效，请重新生成链接。');
  const circuitId=url.searchParams.get('c');
  if(!design||design.designId!==designId)return result('design-missing','本机没有该链接对应的方案，请先导入对应方案 JSON，再重新打开链接。在线链接不会自动上传或同步方案。',designId,circuitId);
  if(circuitId!==null&&!(design.circuits||[]).some(c=>c.id===circuitId))return result('circuit-missing','该回路不存在或已被删除，请核对当前方案版本并重新生成标签。',designId,circuitId);
  return result('resolved',circuitId===null?'已打开本机对应方案。':`已定位回路 ${circuitId}。`,designId,circuitId);
}
