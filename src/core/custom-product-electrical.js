/** Optional custom electrical fields use the same model as the catalogue. */
export function normalizeCustomElectrical(product) {
  const result = {};
  for (const key of ['powerInput', 'loadPowerInput']) {
    if (product[key] === undefined) continue; // Preserve legacy product behaviour.
    if (product[key] === null) { result[key] = null; continue; }
    const value = product[key] || 'unknown';
    // Imported products may use older spellings or manufacturer descriptions.
    if (typeof value !== 'string' || value.length > 100) throw new Error('供电方式必须为最多 100 字的文本');
    result[key] = value;
  }
  const numeric = (value, label, max, zero = false) => {
    if (value == null || value === '') return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (!zero && value === 0) || value > max) throw new Error(`${label}必须为${zero ? '非负' : '正'}数，最大 ${max}`);
    return value;
  };
  for (const [key, label, max] of [['channelAmps', '通道电流', 1000], ['channelWatts', '通道功率', 100000], ['powerConsumptionW', '整机总功耗', 100000]]) {
    if (product[key] !== undefined) result[key] = numeric(product[key], label, max, key === 'powerConsumptionW');
  }
  if (product.channels != null && (!Number.isInteger(product.channels) || product.channels < 0 || product.channels > 64)) throw new Error('通道数必须为 0–64 的整数');
  if (product.busConsumption != null) {
    if (!['W', 'mA'].includes(product.busConsumption.unit)) throw new Error('模块功耗单位仅支持 W 或 mA');
    const value = numeric(product.busConsumption.value, '模块总功耗', 100000, true);
    result.busConsumption = value == null ? null : { unit: product.busConsumption.unit, value };
  }
  if (product.psuOutput != null) {
    if (product.kind !== 'psu') throw new Error('仅电源模块可填写 PSU 输出');
    const output = {};
    for (const [key, label, max] of [['voltage', '输出电压', 1000], ['amps', '输出电流', 1000], ['watts', '输出功率', 100000], ['milliamps', '输出毫安', 1000000]]) {
      const value = numeric(product.psuOutput[key], label, max);
      if (value != null) output[key] = value;
    }
    const tolerance = value => Math.max(1e-9, value * 1e-6);
    if (output.amps != null && output.milliamps != null && Math.abs(output.amps * 1000 - output.milliamps) > tolerance(output.milliamps)) throw new Error('PSU 输出电流 A 与 mA 不一致，请核对厂家资料');
    const amps = output.amps ?? (output.milliamps == null ? null : output.milliamps / 1000);
    if (output.voltage != null && amps != null && output.watts != null && output.watts > output.voltage * amps + tolerance(output.voltage * amps)) throw new Error('PSU 输出功率超过电压 × 电流，请核对厂家额定或留空待核');
    result.psuOutput = Object.keys(output).length ? output : null;
  }
  const source = product.source || {};
  const url = (product.sourceURL ?? source.url ?? '').trim();
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('厂家资料链接不是有效网址'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || url.length > 1000) throw new Error('资料链接仅支持不含账号密码的 HTTP / HTTPS 网址');
  }
  for (const key of ['file', 'pages']) if (source[key] != null && (typeof source[key] !== 'string' || source[key].length > 200)) throw new Error('资料名称和页码最多 200 字');
  result.sourceURL = url;
  result.source = { ...source, file: source.file?.trim() || '用户器件库', pages: source.pages?.trim() || '待核', url: url || null };
  return result;
}
