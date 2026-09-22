export const ROW_ZONES = [['mixed','不限'],['power','强电'],['control','弱电 / 控制']];
export function rowZone(design,row) { return ['power','control'].includes(design?.rowZones?.[row])?design.rowZones[row]:'mixed'; }
export function productZone(product) { return product?.zone==='control'?'control':'power'; }
export function rowAllows(design,product,row) { const zone=rowZone(design,row);return zone==='mixed'||zone===productZone(product); }
export function rowZoneIssues(design,assembly) {
  const issues=[];
  for(const n of assembly.nodes||[]) {
    const saved=design.positions?.[n.id]||n.module?.position||n.circuit?.position;
    if(saved&&!rowAllows(design,n.product,saved.row)) issues.push({code:'ROW_ZONE_CONFLICT',level:'error',ref:n.id,message:`${n.id} 手动位置第 ${saved.row+1} 排与器件分区冲突，已尝试移至兼容排；请更新安装位置。`});
    if(n.overflow && Array.isArray(design.rowZones) && design.rowZones.some(z=>['power','control'].includes(z))) issues.push({code:'ROW_ZONE_CAPACITY',level:'error',ref:n.id,message:`${n.id} 没有足够的兼容排空间，请调整分区或箱体。`});
  }
  return issues;
}
