/**
 * 按 kind 生成端子模板（P1-2）。
 */
import {isDinDali2} from './dali-power.js';
import {qsLinkCount, QS_RECEIVERS, QS_SUPPLIES, qsTerminalTemplates} from './qs-link.js';
import {addVerifiedLoadPorts} from './crestron-loads.js';
import {appendAp4ComPorts,appendSdm630SerialPorts} from './serial-rs485.js';
import {abbDaliLines, abbPortTemplates, isMdtBusSupply} from './abb-dali.js';

// Schematic plug anchors relative to the module centre, positioned from manufacturer front views.
const receiverNetStarts = new Map([
  ['crestron-din-4dimu4-6513187', -34], ['crestron-din-dali-2', -64.5], ['crestron-din-dli', -21],
  ['crestron-din-8sw8-i', -69], ['crestron-din-4dimflv4', -69], ['crestron-din-2mc2', -44],
  ['crestron-din-1dimu4', -97], ['crestron-din-1dim4', -97],
]);
export function isCresnetReceiver(product) {
  return receiverNetStarts.has(product?.id);
}
export function appendCresnetReceiverPorts(product, addNetBlock) {
  const start = receiverNetStarts.get(product.id);
  if (start == null) return;
  addNetBlock('NET', start, 'in', true);
  addNetBlock('NET2', start + 17, 'both');
}

export function isLunatone24033444(product) {
  return product?.id === 'lunatone-dali-ps-24033444';
}
export function dcInputVoltage(product) {
  const input = String(product?.powerInput || '').replace(/\s/g, '');
  const match = /^(?:(12|24)VDC|DC(12|24))(?:-or-poe)?$/i.exec(input);
  return match ? Number(match[1] || match[2]) : null;
}

/** Load contacts remain separate from the controller's low-voltage supply. */
export function loadPowerInput(product) {
  return product?.loadPowerInput ?? product?.powerInput;
}

export function hasIndependentLoadFeeds(product) {
  return product?.id === 'crestron-din-4dimu4-6513187';
}

export function isCresnetController(product) {
  return product?.id === 'crestron-din-ap4';
}

export function isCresnetChainSupply(product) {
  return product?.id === 'crestron-din-pws50';
}

export function supportsLoadWiring(product) {
  return hasIndependentLoadFeeds(product) || !['unknown', 'none', 'independent-LN'].includes(product?.loadPowerInput);
}

export function acceptsExternalDaliPower(product) {
  return !['internal-only', 'switchable'].includes(product?.daliPowerSupply);
}

export function buildPortTemplates(product) {
  const kind = product?.kind;
  const ports = [];
  const add = (key, conductor, side, io, channel, details) => {
    ports.push({ key, conductor, side, io, ...(channel != null ? { channel } : {}), ...details });
  };
  const addNetBlock = (block, startX, powerDirection, useLegacyPowerKeys = false) => {
    for (const [index, pin] of ['24', 'Y', 'Z', 'G'].entries()) {
      const data = pin === 'Y' || pin === 'Z';
      const conductor = pin === '24' ? 'DC+' : pin === 'G' && useLegacyPowerKeys ? 'DC-' : pin;
      const key = useLegacyPowerKeys && !data ? conductor : `${block}_${pin}`;
      const io = pin === '24' || (useLegacyPowerKeys && !data) ? powerDirection : 'both';
      add(key, conductor, 'bottom', io, null, {
        marking: `${block}-${pin}`,
        offsetX: startX + index * 3.5,
        ...(data ? { minWire: 0.33 } : {}),
      });
    }
  };
  if (addVerifiedLoadPorts(product,add)) {
    if(product.id==='eastron-sdm630-modbus-v2') appendSdm630SerialPorts(add);
    else appendCresnetReceiverPorts(product,addNetBlock);
    return ports;
  }
  // RJ45 不作为强电/KNX 总线端子，避免把交换机自动接入电气网络。
  if (product?.networkPorts) return ports;
  if(qsLinkCount(product.id) || QS_SUPPLIES.includes(product.id)) return qsTerminalTemplates(product);

  if (product?.id === 'crestron-din-dli') {
    for (const [i, key] of ['PLUS', 'MINUS', 'PLUS_2', 'MINUS_2'].entries()) {
      const sign = i % 2 ? '-' : '+';
      add(`DALI1_${key}`, `BUS${sign}`, 'top', 'both', 1, {marking:`DA${sign}${i >= 2 ? '(2)' : ''}`, offsetX:-3 + i * 5});
    }
    appendCresnetReceiverPorts(product, addNetBlock);
    return ports;
  }
  if (abbDaliLines(product)) return abbPortTemplates(product);
  if (product.id === 'lutron-lqse-2dal-d') {
    // 369650g, pp. 1, 5–6. The two DALI connectors are to the right of QS.
    for (const line of [1,2]) {
      for (const [index,position] of ['LEFT','RIGHT'].entries()) {
        add('DALI'+line+'_'+position,'DA','top','both',line,
          {marking:'DA'+line+'('+ (index?'右':'左') +')',offsetX:45+(line-1)*12+index*5});
      }
    }
  }
  if(QS_RECEIVERS.includes(product.id))return [...ports,...qsTerminalTemplates(product)];
  if (isMdtBusSupply(product)) {
    for(const [index,pin] of ['L','N','PE'].entries()) add(pin+'_IN',pin,'top','in',null,{offsetX:-27+index*7,marking:pin});
    for(const [index,sign] of ['-','+'].entries()) {
      add('BUS'+sign,'BUS'+sign,'bottom','out',null,{offsetX:-25+index*5,marking:'U1-KNX'+sign});
      add('U2_'+(index?'PLUS':'MINUS'),'DC'+sign,'bottom','out',null,{offsetX:21+index*7,marking:'U2'+sign});
    }
    return ports;
  }
  if (product.id==='meanwell-dlp-04r' || product.id==='tridonic-dali-ps2') {
    const meanwell=product.id==='meanwell-dlp-04r';
    // Front views: DLP-04-SPEC p.4; Tridonic 28000876 p.3.
    const pins=meanwell
      ? [['BUS+','BUS+','top','2-DA+',5],['BUS-','BUS-','top','1-DA-',10],
        ['N_IN','N','bottom','4-AC/N',-4],['L_IN','L','bottom','3-AC/L',6]]
      : [['N_IN','N','top','N',3],['L_IN','L','top','L',9],
        ['DA_LEFT','DA','bottom','DA(左)',-3],['DA_RIGHT','DA','bottom','DA(右)',3]];
    for (const [key,conductor,side,marking,offsetX] of pins) {
      add(key,conductor,side,key.endsWith('_IN')?'in':'out',null,
        {marking,offsetX,...(meanwell?{}:{minWire:0.25,maxWire:2.5})});
    }
    return ports;
  }

  if (isDinDali2(product)) {
    // Four screws per loop: DA+ / DA- repeated on the second 2-pin plug.
    for (const loop of [1, 2]) {
      const startX = loop === 1 ? -72 : -48;
      for (const pair of [0, 1]) {
        for (const [index, sign] of ['+', '-'].entries()) {
          const key = sign === '+' ? 'PLUS' : 'MINUS';
          add(`DALI${loop}_${key}${pair ? '_2' : ''}`, `BUS${sign}`, 'top', 'both', loop,
            {marking:`DALI${loop}-DA${sign}${pair ? '(2)' : ''}`, offsetX:startX + pair * 12 + index * 5, minWire:0.08, maxWire:3.31});
        }
      }
    }
    addNetBlock('NET', -64.5, 'in', true);
    addNetBlock('NET2', -46.5, 'both');
    return ports;
  }

  if (isLunatone24033444(product)) {
    // D0077 p.4, front view. Keep legacy output keys for stored wire edits.
    const rating = {minWire:0.5, maxWire:2.5};
    for (const [index, sign] of ['+', '-'].entries()) {
      add(`BUS${sign}`, `BUS${sign}`, 'top', 'out', null, {...rating, marking:`DA${sign}`, offsetX:index ? 5 : -5});
    }
    for (const [index, pin] of ['N','L'].entries()) {
      add(`${pin}_IN`, pin, 'bottom', 'in', null, {...rating, marking:pin, offsetX:index ? 5 : -5});
    }
    return ports;
  }

  if (hasIndependentLoadFeeds(product)) {
    // Front view: N/L/D for each channel, with both leads of N on its pass-through terminal.
    for (let channel = 1; channel <= 4; channel++) {
      const x = (channel - 2.5) * 14.4;
      const rating = { minWire: 0.08, maxWire: 2.5 };
      add(`CH${channel}_N`, 'N', 'top', 'both', channel, { ...rating, marking: `CH${channel}-N`, offsetX: x - 4.8 });
      add(`CH${channel}_IN`, 'L', 'top', 'in', channel, { ...rating, marking: `CH${channel}-L`, offsetX: x });
      add(`CH${channel}_OUT`, 'L', 'top', 'out', channel, { ...rating, marking: `CH${channel}-D`, offsetX: x + 4.8 });
    }
    // Doc. 9454A front view shows two paralleled 24/Y/Z/G connectors.
    addNetBlock('NET', -34, 'in', true);
    addNetBlock('NET2', -17, 'both');
    return ports;
  }

  if (isCresnetController(product)) {
    // Doc. 8559 front view shows PWR 24/G to the left of the two NET connectors.
    add('DC+', 'DC+', 'bottom', 'in', null, { marking: 'PWR-24', offsetX: -72 });
    add('DC-', 'DC-', 'bottom', 'in', null, { marking: 'PWR-G', offsetX: -68.5 });
    addNetBlock('NET', -62, 'out');
    addNetBlock('NET2', -45, 'out');
    appendAp4ComPorts(add);
    return ports;
  }

  if (isCresnetChainSupply(product)) {
    // Doc. 6667B p.2: the top-left block is the mains input, the next its pass-through.
    for (const [index, pin] of ['L', 'N', 'PE'].entries()) {
      add(`${pin}_IN`, pin, 'top', 'in', null, { marking: `AC-IN-${pin}`, offsetX: -40.5 + index * 5, maxWire: 2.5 });
    }
    for (const [index, pin] of ['L', 'N', 'PE'].entries()) {
      add(`${pin}_THRU`, pin, 'top', 'out', null, { marking: `AC-THRU-${pin}`, offsetX: -21.5 + index * 5, maxWire: 2.5 });
    }
    addNetBlock('NET', 5, 'out', true);
    addNetBlock('NET2', 21, 'out');
    addNetBlock('NET3', 37, 'out');
    return ports;
  }

  if (["mcb", "rcbo", "rccb", "spd", "isolator", "changeover"].includes(kind)) {
    const poles = product.poles || 1;
    const labels =
      poles === 1
        ? ["L"]
        : poles === 2
          ? ["L", "N"]
          : poles === 3
            ? ["L1", "L2", "L3"]
            : ["L1", "L2", "L3", "N"];
    for (const cond of labels) {
      const c = cond.startsWith("L") ? "L" : cond;
      add(`${cond}_IN`, c === "L" ? "L" : cond, "top", "in");
      add(`${cond}_OUT`, c === "L" ? "L" : cond, "bottom", "out");
    }
    return ports;
  }

  if (["relay", "dimmer", "contactor", "timer"].includes(kind)) {
    if (dcInputVoltage(product)) {
      add("DC+", "DC+", "top", "in");
      add("DC-", "DC-", "top", "in");
    }
    if (supportsLoadWiring(product)) {
      add("L_IN", "L", "top", "in");
      if(product.id !== 'crestron-din-8sw8-i') add("N_IN", "N", "top", "in");
      const ch = product.channels || 1;
      for (let i = 1; i <= ch; i++) {
        add(`CH${i}_IN`, "L", "top", "in", i);
        add(`CH${i}_OUT`, "OUT", "bottom", "out", i);
      }
    }
    if (product.protocol?.some((p) => ["knx", "cresnet", "qslink", "dali"].includes(p)) || product.powerInput === "bus") {
      add("BUS+", "BUS+", "top", "both");
      add("BUS-", "BUS-", "top", "both");
    }
    return ports;
  }

  if (kind === "psu") {
    if (!product.custom || product.powerInput === undefined || product.powerInput === 'LN') {
      add("L_IN", "L", "top", "in");
      add("N_IN", "N", "top", "in");
    }
    if (product.protocol?.some((p) => ["dali", "knx"].includes(p))) {
      add("BUS+", "BUS+", "bottom", "out");
      add("BUS-", "BUS-", "bottom", "out");
    } else if (!product.custom || product.psuOutput?.voltage) {
      add("DC+", "DC+", "bottom", "out");
      add("DC-", "DC-", "bottom", "out");
    }
    return ports;
  }

  if (kind === "gateway") {
    if (dcInputVoltage(product)) {
      add("DC+", "DC+", "top", "in");
      add("DC-", "DC-", "top", "in");
    }
    // The USMART photo identifies the connectors, but not the pin order or polarity.
    if (product.interfaceProfile === 'din-tcp') return ports;
    if (product.powerInput === "LN") {
      add("L_IN", "L", "top", "in");
      add("N_IN", "N", "top", "in");
    }
    if (!product.custom || product.powerInput === undefined || product.powerInput === 'bus' || product.protocol?.some(p => ['knx', 'cresnet', 'qslink', 'dali'].includes(p))) {
      add("BUS+", "BUS+", "bottom", "both");
      add("BUS-", "BUS-", "bottom", "both");
    }
    return ports;
  }

  if (kind === "meter") {
    if (!supportsLoadWiring(product)) return ports;
    add("L_IN", "L", "top", "in");
    add("L_OUT", "L", "bottom", "out");
    add("N_IN", "N", "top", "in");
    add("N_OUT", "N", "bottom", "out");
    add("A", "A", "bottom", "both");
    add("B", "B", "bottom", "both");
    return ports;
  }

  if (kind === "terminal") {
    const cond = product.conductor === "N" ? "N" : "L";
    const poles = Math.max(1, Number(product.poles) || Number(product.channels) || 1);
    for (let i = 1; i <= poles; i++) {
      const suffix = poles > 1 ? String(i) : "";
      add(`FIELD${suffix}`, cond, "top", "in", poles > 1 ? i : undefined);
      add(`PANEL${suffix}`, cond, "bottom", "out", poles > 1 ? i : undefined);
    }
    return ports;
  }

  return ports;
}
