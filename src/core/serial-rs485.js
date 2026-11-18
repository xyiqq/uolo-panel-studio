// DIN-AP4 Doc. 8559 COM pin table. SDM630 protocol §2.3 shows A idle low and B idle high.
export const SDM630_V2 = 'eastron-sdm630-modbus-v2';
const AP4 = 'crestron-din-ap4';
const pins = [['TX', 'A'], ['RTS', 'B'], ['G', 'G']];
export const rs485CableNote = '使用屏蔽双绞线，首末端各接 120 Ω、至少 0.25 W 的终端电阻。全线最长 1200 m，含主机最多 32 个节点。各表须设置唯一 Modbus 地址并与主机统一串口参数。';

export function appendAp4ComPorts(add) {
  // Only COM 1 is used by the serial topology. RX and CTS are idle in RS-485 mode.
  for (const [index, pin] of ['G','TX','RX','RTS','CTS'].entries()) {
    add(`COM1_${pin}`, pin, 'bottom', 'both', null, {marking:`COM1-${pin}`, offsetX:-18 + index * 3.5});
  }
}

export function appendSdm630SerialPorts(add) {
  for (const [index, pin] of ['B','A','G'].entries()) {
    add(`RS485_${pin}`, pin, 'top', 'both', null, {marking:`RS485-${pin}`, offsetX:-20 + index * 5, inset:26});
  }
}

export function rs485PlanIssue(design, master, ids) {
  if (!Array.isArray(ids) || ids.some(id => !id || !design.modules.some(m => m.id === id && m.productId === SDM630_V2))) {
    return '请重新选择有端子资料的 SDM630-Modbus V2，并核对串接顺序。';
  }
  if (new Set(ids).size !== ids.length) return '同一块表在一条线上只能出现一次。';
  if (!ids.length) return '';
  if (ids.length > 31) return '一个 RS-485 网段含主机最多 32 个节点。';
  if (master.rs485MetersLength != null && !(master.rs485MetersLength > 0 && master.rs485MetersLength <= 1200)) return 'RS-485 总线长须大于零且不超过 1200 m。';
  const involved = new Set([master.id, ...ids]);
  if (design.modules.some(m => m.id !== master.id && m.productId === AP4 && Array.isArray(m.rs485Meters) && m.rs485Meters.some(id => involved.has(id)))) {
    return '所选电表的 RS-485 端口已接入另一台主机。';
  }
  if ((design.buses || []).some(b => b.type === 'rs485' &&
      ([...(b.deviceModuleIds || []), ...(b.psuModuleIds || [])].some(id => involved.has(id)) ||
       design.modules.some(m => m.busId === b.id && involved.has(m.id))))) return '请先解除该设备原有的 RS-485 总线分配。';
  return '';
}

export function wireSerialMeters({design, nodes, port, add, pending}) {
  for (const m of design.modules) {
    if (m.productId !== AP4 || !m.rs485Meters?.length) continue;
    const ids = m.rs485Meters;
    const error = rs485PlanIssue(design, m, ids);
    if (error || [m.id, ...ids].some(id => !nodes.get(id) || nodes.get(id).overflow)
        || pins.some(([apPin,meterPin])=>!port(m.id,'COM1_'+apPin) || ids.some(id=>!port(id,'RS485_'+meterPin)))) {
      pending('RS485_CONNECTION_UNRESOLVED', error || 'RS-485 主机或电表尚未装入机柜。', m.id);
      continue;
    }
    if (m.rs485MetersLength == null) pending('RS485_LENGTH_UNVERIFIED',m.id+'：请核对 COM1 至末台电表的实际总线长。',m.id);
    let previous = m.id;
    for (const id of ids) {
      for (const [apPin, meterPin] of pins) {
        const fromKey = previous === m.id ? 'COM1_' + apPin : 'RS485_' + meterPin;
        const from = port(previous, fromKey), to = port(id, 'RS485_' + meterPin);
        add(from.id, to.id, {material:meterPin === 'G' ? 'RS-485 信号参考芯 G' : 'RS-485 屏蔽双绞线'}, {
          rs485:true, serialMaster:m.id, moduleId:id, conductor:'RS485-' + meterPin, class:'comms', section:null,
          scope:'COM1 · Modbus RTU · ' + (meterPin === 'G' ? '信号参考' : '差分数据'),
        });
      }
      previous = id;
    }
  }
}
