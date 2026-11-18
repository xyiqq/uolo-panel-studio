// DIN-4DIMU4 (6513187), Crestron SIMPL Dimmer Load Control / BridgeConfigurationIn.
export const DIMMER_BRIDGE_MODES = Object.freeze(['0000', '1100', '0011', '1010', '1110', '1001', '1101', '1111', '1122']);
export const DIMMER_JUMPER_PARTS = Object.freeze({ L: '2065817', N: '2065818', D: '2065819' });

export function normalizeDimmerBridgeMode(mode = '0000') {
  const code = Number.isInteger(mode) ? String(mode).padStart(4, '0') : mode;
  return DIMMER_BRIDGE_MODES.includes(code) ? code : null;
}

/** The first member of each output group is its programming channel. */
export function dimmerOutputGroups(mode = '0000') {
  const code = normalizeDimmerBridgeMode(mode);
  if (code === null) return null;
  const groups = new Map();
  for (const [index, digit] of [...code].entries()) {
    const channel = index + 1;
    const key = digit === '0' ? channel : digit;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(channel);
  }
  return [...groups.values()];
}

export function dimmerBridgeLabel(mode) {
  const groups = dimmerOutputGroups(mode);
  if (!groups) return '无效桥接组合';
  return groups.filter(group => group.length > 1)
    .map(group => group.map(channel => `CH${channel}`).join(' + ')).join(' / ') || '四路独立';
}

/** Doc. 9454A, p. 19: the supplied jumpers connect adjacent channels. */
export function dimmerGroupUsesIncludedJumpers(group) {
  return group.every((channel, index) => channel === group[0] + index);
}
