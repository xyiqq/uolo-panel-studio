/**
 * 导轨占位辅助。width 优先用公开资料物理宽；modules = ceil(width/18) 或官方模位数。
 */
export function dinRail({ modules, widthMm, heightMm = 90, depthMm = 58, source = null }) {
  const modulesN = Number(modules);
  const width = widthMm != null ? widthMm : modulesN * 18;
  const mods = Number.isFinite(modulesN) && modulesN > 0 ? modulesN : Math.max(1, Math.ceil(width / 18));
  return {
    modules: mods,
    width,
    height: heightMm,
    depth: depthMm,
    ...(source ? { source } : {}),
  };
}
