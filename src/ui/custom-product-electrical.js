export function customElectricalFields(product, field, escape) {
  const input = (id, value, max, min = 0) => `<input id="${id}" type="number" min="${min}" max="${max}" step="any" value="${escape(value ?? '')}" placeholder="留空待核">`;
  const select = (id, value, options) => {
    const choices = options.some(([key]) => key === value) ? options : [...options, [value, `原型号：${value}`]];
    return `<select id="${id}">${choices.map(([key, label]) => `<option value="${escape(key)}"${value === key ? ' selected' : ''}>${escape(label)}</option>`).join('')}</select>`;
  };
  const legacy = [['legacy', '沿用原型号（未录入）']];
  const power = [['unknown', '待核'], ['LN', '交流 L/N'], ['12VDC', '12V DC'], ['24VDC', '24V DC'], ['bus', '总线供电'], ['poe', 'PoE'], ['none', '无需供电']];
  return `<h3>电气参数与来源</h3><p>控制电源仅给模块本身供电；负载供电给灯具或设备。未知参数留空或选待核，不按外形推定。</p>
    <div class="field-grid">${field('模块控制供电', select('lib-control-power', product.powerInput ?? 'legacy', [...(product.powerInput == null ? legacy : []), ...power]))}${field('灯具 / 设备负载供电', select('lib-load-power', product.loadPowerInput ?? 'legacy', [...(product.loadPowerInput == null ? legacy : []), ...power.filter(([key]) => ['unknown', 'LN', 'none'].includes(key))]))}</div>
    <div class="field-grid">${field('每通道额定电流 A', input('lib-channel-amps', product.channelAmps, 1000))}${field('每通道额定负载 W', input('lib-channel-watts', product.channelWatts, 100000))}</div>
    ${field('整机总输入功耗 W（不含所控负载）', input('lib-total-watts', product.powerConsumptionW, 100000))}
    <div class="field-grid">${field('控制电源 / 总线预算消耗（单独核实）', input('lib-consumption-value', product.busConsumption?.value, 100000))}${field('预算消耗单位', select('lib-consumption-unit', product.busConsumption?.unit || 'W', [['W', 'W'], ['mA', 'mA']]))}</div>
    <p>整机功耗不自动计入总线预算，也不代表柜内散热；预算只使用上方单独填写的消耗。</p>
    <div id="lib-psu-fields"><div class="field-grid">${field('PSU 输出电压 V', input('lib-psu-voltage', product.psuOutput?.voltage, 1000))}${field('PSU 输出电流 A', input('lib-psu-amps', product.psuOutput?.amps ?? (product.psuOutput?.milliamps == null ? null : product.psuOutput.milliamps / 1000), 1000))}</div>${field('PSU 额定输出功率 W', input('lib-psu-watts', product.psuOutput?.watts, 100000))}</div>
    <div class="field-grid">${field('厂家资料名称 / 文件名', `<input id="lib-source-file" maxlength="200" value="${escape(product.source?.file || '')}">`)}${field('资料页码 / 章节', `<input id="lib-source-pages" maxlength="200" value="${escape(product.source?.pages || '')}">`)}</div>`;
}

export function readCustomElectrical(root, kind) {
  const value = id => root.querySelector(`#${id}`).value;
  const number = id => {
    const element = root.querySelector(`#${id}`);
    if (element.validity?.badInput) throw new Error('电气参数必须为有效数字');
    return element.value === '' ? null : element.valueAsNumber;
  };
  const consumption = number('lib-consumption-value');
  const output = kind === 'psu' ? { voltage: number('lib-psu-voltage'), amps: number('lib-psu-amps'), watts: number('lib-psu-watts') } : null;
  return {
    powerInput: value('lib-control-power') === 'legacy' ? undefined : value('lib-control-power'),
    loadPowerInput: value('lib-load-power') === 'legacy' ? undefined : value('lib-load-power'),
    channelAmps: number('lib-channel-amps'), channelWatts: number('lib-channel-watts'), powerConsumptionW: number('lib-total-watts'),
    busConsumption: consumption == null ? null : { value: consumption, unit: value('lib-consumption-unit') },
    psuOutput: output && Object.values(output).some(v => v != null) ? output : null,
    source: { file: value('lib-source-file'), pages: value('lib-source-pages'), url: value('lib-source') },
  };
}
