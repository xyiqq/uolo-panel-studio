export function preferredInstallPosition(slots, saved = 'auto') {
  if (saved === 'auto') return 'auto';
  const match = /^(\d+)_(\d+)$/.exec(saved);
  if (!match) return 'auto';
  const row = Number(match[1]), slot = Number(match[2]);
  const next = slots.find(p => p.row === row && p.slot >= slot)
    || slots.find(p => p.row === row)
    || slots.find(p => p.row > row) || slots[0];
  return next ? `${next.row}_${next.slot}` : 'auto';
}

export function readInstallPosition(kind, slots) {
  try { return preferredInstallPosition(slots, localStorage.getItem(`panel-studio-install-${kind}`) || 'auto'); }
  catch { return 'auto'; }
}

export function rememberInstallPosition(select, kind) {
  select.addEventListener('change', () => {
    try { localStorage.setItem(`panel-studio-install-${kind}`, select.value); } catch { /* Storage may be unavailable. */ }
  });
}
