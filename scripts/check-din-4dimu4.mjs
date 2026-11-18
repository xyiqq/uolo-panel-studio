// Run with the Vite dev server, a current npm run build, and Chrome available.
// Requires Poppler pdfinfo/pdftoppm and either pdftotext or Python with pypdf.
// PANEL_URL, PDF_BROWSER, and PDF_PYTHON can override local tools.
// Pass --bridge to exercise the two separate bridge groups in mode 1122.
// Pass --cresnet to exercise the DIN-AP4 data link with independent dimmer feeds.
// Pass --cresnet-chain to exercise a DIN-PWS50 and three daisy-chained dimmers.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { chromium } from 'playwright';

const bridgeMode = process.argv.includes('--bridge') ? '1122' : null;
const directCresnet = process.argv.includes('--cresnet');
const withChain = process.argv.includes('--cresnet-chain');
assert.ok([bridgeMode, directCresnet, withChain].filter(Boolean).length <= 1, 'Run one wiring scenario at a time');
const withCresnet = directCresnet || withChain;
const out = '.playwright-cli/din-4dimu4' + (bridgeMode ? '-bridge' : withChain ? '-cresnet-chain' : withCresnet ? '-cresnet' : '');
const baseUrl = process.env.PANEL_URL || 'http://127.0.0.1:5173/';
const phases = ['L1', 'L2', 'L3', 'L1'];
const circuits = ['C01', 'C02', 'C03', 'C04'];
const channelGroups = bridgeMode ? [[1, 2], [3, 4]] : withChain ? [[1]] : [[1], [2], [3], [4]];
const feeds = channelGroups.map(([channel]) => [channel, circuits[channel - 1]]);
const moduleId = 'D1';
const productId = 'crestron-din-4dimu4-6513187';
const controllerId = 'GW1';
const chainSupplyId = 'PS1';
const dimmerIds = withChain ? [moduleId, 'D2', 'D3'] : [moduleId];
const monitoredIds = withChain ? [...dimmerIds, controllerId, chainSupplyId] : dimmerIds;
const terminal = 'XT1:2';
const terminalChannel = bridgeMode ? 3 : withChain ? 1 : 2;
const terminalCircuit = circuits[terminalChannel - 1];
const terminalOutput = `D1:CH${terminalChannel}_OUT`;
const monitoredWire = ({ from, to }) => monitoredIds.some(id => from.startsWith(id + ':') || to.startsWith(id + ':'));
const key = ({ from, to, conductor, wireClass, circuit }) => [from, to, conductor, wireClass, circuit].join('|');
const directWires = [
  { conductor: 'Y', section: 0.33 },
  { conductor: 'Z', section: 0.33 },
  { conductor: 'G', section: 0.82 },
].map(({ conductor, section }) => ({
  from: `${controllerId}:NET_${conductor}`, to: `${moduleId}:NET2_${conductor}`,
  fromTag: `${controllerId}.NET-${conductor}`, toTag: `${moduleId}.NET2-${conductor}`,
  conductor, section, wireClass: 'comms', circuit: '',
}));

const chainWire = (from, to, fromKey, toKey, fromPin, toPin, conductor, section, wireClass) => ({
  from: `${from}:${fromKey}`, to: `${to}:${toKey}`, fromTag: `${from}.${fromPin}`, toTag: `${to}.${toPin}`,
  conductor, section, wireClass, circuit: '',
});
const chainWires = [
  ...['Y', 'Z', 'G'].map(pin => chainWire(controllerId, chainSupplyId, `NET_${pin}`, pin === 'G' ? 'DC-' : `NET_${pin}`,
    `NET-${pin}`, `NET-${pin}`, pin, pin === 'G' ? 0.82 : 0.33, 'comms')),
  ...dimmerIds.flatMap((id, index) => {
    const downstreamPins = [
      { pin: '24', key: 'DC+', conductor: 'DC+', section: 0.82, wireClass: 'dc' },
      { pin: 'Y', key: 'NET_Y', conductor: 'Y', section: 0.33, wireClass: 'comms' },
      { pin: 'Z', key: 'NET_Z', conductor: 'Z', section: 0.33, wireClass: 'comms' },
      { pin: 'G', key: 'DC-', conductor: 'DC-', section: 0.82, wireClass: 'dc' },
    ];
    return downstreamPins.map(({ pin, key, conductor, section, wireClass }) =>
      chainWire(dimmerIds[index - 1] || chainSupplyId, id, `NET2_${pin}`, key, `NET2-${pin}`, `NET-${pin}`, conductor, section, wireClass));
  }),
];
const cresnetWires = withChain ? chainWires : directWires;

function expectedWires(physicalTerminal = false, groups = channelGroups) {
  const assignments = withChain
    ? dimmerIds.map((id, index) => ({ id, group: [1], branch: index }))
    : groups.map(group => ({ id: moduleId, group, branch: group[0] - 1 }));
  const wires = assignments.flatMap(({ id, group: [channel, ...members], branch }) => {
    const circuit = circuits[branch];
    const phase = phases[branch];
    const endpoint = physicalTerminal && id === moduleId && channel === terminalChannel ? terminal : `X-${circuit}:${phase}`;
    return [
      { from: `${circuit}:${phase}_OUT`, to: `${id}:CH${channel}_IN`, conductor: phase },
      { from: `${circuit}:N_OUT`, to: `${id}:CH${channel}_N`, conductor: 'N' },
      { from: `${id}:CH${channel}_OUT`, to: endpoint, conductor: phase },
      { from: `${id}:CH${members.at(-1) || channel}_N`, to: `X-${circuit}:N`, conductor: 'N' },
      ...members.flatMap(member => [['IN', phase], ['N', 'N'], ['OUT', phase]].map(([port, conductor]) => ({
        from: `${id}:CH${channel}_${port}`, to: `${id}:CH${member}_${port}`, conductor,
      }))),
    ].map(({ from, to, conductor }) => ({ from, to, conductor, circuit, wireClass: 'power' }));
  });
  if (withChain) {
    wires.push(
      { from: 'C04:L1_OUT', to: 'PS1:L_IN', conductor: 'L1', wireClass: 'power', circuit: 'C04' },
      { from: 'C04:N_OUT', to: 'PS1:N_IN', conductor: 'N', wireClass: 'power', circuit: 'C04' },
      { from: 'PE:PE-C04', to: 'PS1:PE_IN', conductor: 'PE', wireClass: 'power', circuit: 'C04' },
    );
  } else {
    for (const conductor of ['DC+', 'DC-']) {
      wires.push({ from: `PS1:${conductor}`, to: `D1:${conductor}`, conductor, wireClass: 'dc', circuit: '' });
    }
  }
  if (withCresnet) wires.push(...cresnetWires);
  return wires;
}

function parseWireCsv(text) {
  const rows = text.replace(/^\uFEFF/u, '').trimEnd().split('\r\n').map(line =>
    [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(match => match[1].replaceAll('""', '"')));
  const fields = ['起点', '终点', '导体', '线类', '回路', '起点标签', '终点标签', '线材', '线段截面mm2'];
  const header = rows.shift();
  const positions = fields.map(field => header.indexOf(field));
  assert.ok(positions.every(index => index >= 0), 'Missing wire CSV columns');
  return rows.map(row => {
    const [from, to, conductor, wireClass, circuit, fromTag, toTag, material, section] = positions.map(index => row[index]);
    return { from, to, conductor, wireClass, circuit, fromTag, toTag, material, section };
  });
}

function extractPdfPages(path) {
  const result = spawnSync('pdftotext', ['-raw', '-enc', 'UTF-8', path, '-'], { encoding: 'utf8' });
  if (!result.error) {
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.split('\f');
  }
  if (result.error.code !== 'ENOENT') throw result.error;
  const python = process.env.PDF_PYTHON || (process.platform === 'win32' ? 'py' : 'python3');
  const code = 'import sys; from pypdf import PdfReader; sys.stdout.buffer.write("\\f".join(p.extract_text() for p in PdfReader(sys.argv[1]).pages).encode("utf-8"))';
  return execFileSync(python, ['-c', code, path], { encoding: 'utf8' }).split('\f');
}

function compact(text) {
  return text.normalize('NFKC').replace(/\s+/gu, '');
}

const checkWires = (actual, expected, description) => {
  assert.deepEqual(actual.filter(monitoredWire).map(key).sort(), expected.map(key).sort(), description);
};

async function openModule(page, id) {
  await page.locator('#manage-modules').click();
  await page.locator(`[data-mod-edit="${id}"]`).click();
}

async function loadDesign(page, fixture) {
  await page.locator('#file').setInputFiles({
    name: 'DIN-4DIMU4.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.waitForFunction(id => window.__PANEL_STATE__.design().designId === id, fixture.designId);
}

async function getWiringRows(page) {
  await page.locator('[data-tab="wiring"]').click();
  await page.locator('#all-wires').check();
  return page.locator('#pane tr[data-wire-from]').evaluateAll(rows => rows.map(row => {
    return { from: row.dataset.wireFrom, to: row.dataset.wireTo, conductor: row.cells[0].textContent.trim() };
  }));
}

async function checkCresnetSchematic(schematic, wires) {
  for (const { from, to, wireClass } of wires) {
    const row = schematic.locator(`[data-schematic-from="${from}"][data-schematic-to="${to}"][data-schematic-class="${wireClass}"]`);
    assert.equal(await row.isVisible(), true, `The schematic must show ${from} → ${to} as ${wireClass}`);
  }
}

async function selectWiringSchematic(page, id) {
  await page.locator('[data-tab="assembly"]').click();
  await page.locator(`[data-part="${id}"]`).click();
  await page.locator('[data-tab="wiring"]').click();
}

async function configureCresnet(page) {
  await page.locator('[data-feature="busEditor"]').click();
  await page.locator('[data-bus-new]').click();
  await page.locator('#bus-type').selectOption('cresnet');
  await page.locator('#bus-label').fill(withChain ? 'DIN-AP4 → DIN-PWS50 → DIN-4DIMU4' : 'DIN-AP4 → DIN-4DIMU4');
  await page.locator('#bus-controller').selectOption(controllerId);
  if (withChain) {
    await page.locator('#bus-chain-supply').selectOption(chainSupplyId);
    await page.locator('#bus-chain-length').fill('18');
    await page.locator('#bus-length').fill('24');
  }
  const memberSelection = withChain ? [dimmerIds[0], dimmerIds[2], dimmerIds[1]] : dimmerIds;
  for (const id of memberSelection) await page.locator(`[data-bus-member="${id}"]`).check();
  if (withChain) await page.locator('[data-bus-move-up="D2"]').click();
  const saveError = page.locator('.feature-error').filter({ hasText: /\S/u });
  const saved = Promise.race([
    page.locator('[data-bus-new]').waitFor({ state: 'visible' }),
    saveError.waitFor({ state: 'visible' }).then(async () => {
      throw new Error(await saveError.innerText());
    }),
  ]);
  await page.locator('[data-bus-save]').click();
  await saved;
  const busId = await page.evaluate(() => window.__PANEL_STATE__.design().buses.find(bus => bus.type === 'cresnet')?.id);
  assert.ok(busId, 'The Cresnet bus editor must save the network');
  await page.locator('#close-modal').click();
  return busId;
}

async function checkCresnetSettings(page, busId) {
  await page.locator('[data-feature="busEditor"]').click();
  await page.locator(`[data-bus-edit="${busId}"]`).click();
  assert.equal(await page.locator('#bus-type').inputValue(), 'cresnet');
  assert.equal(await page.locator('#bus-controller').inputValue(), controllerId);
  if (withChain) {
    assert.equal(await page.locator('#bus-chain-supply').inputValue(), chainSupplyId);
    assert.equal(await page.locator('#bus-chain-length').inputValue(), '18');
    assert.equal(await page.locator('#bus-length').inputValue(), '24');
  }
  const members = await page.locator('[data-bus-member]:checked').evaluateAll(boxes => boxes.map(box => box.dataset.busMember));
  assert.deepEqual(members, dimmerIds, 'The saved device order must survive reload');
  await page.locator('#close-modal').click();
}

async function checkNonadjacentDraft(browser, fixture, errors) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
  try {
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl);
    await page.waitForFunction(() => window.__PANEL_STATE__);
    await loadDesign(page, { ...fixture, designId: 'din-4dimu4-nonadjacent-acceptance' });
    await openModule(page, moduleId);
    await page.locator('#mod-bridge-mode').selectOption('1010');
    for (const channel of [1, 2, 4]) {
      await page.locator(`[data-mod-ch="${channel}"]`).selectOption(circuits[channel - 1]);
    }
    await page.locator('#mod-save').click();
    await page.locator('#modal').waitFor({ state: 'hidden' });
    await openModule(page, 'PS1');
    await page.locator('[data-psu-target="D1"]').check();
    await page.locator('#mod-save').click();
    await page.locator('#modal').waitFor({ state: 'hidden' });

    const draft = await page.evaluate(async id => {
      const panel = window.__PANEL_STATE__;
      const { simulate } = await import('/src/core/domain.js');
      const circuits = simulate(panel.net(), panel.design(), { power: true }).circuits;
      return { module: panel.design().modules.find(module => module.id === id), issues: panel.net().wiringIssues, circuits };
    }, moduleId);
    assert.equal(draft.module.bridgeMode, '1010');
    assert.ok(draft.issues.some(issue => issue.code === 'MODULE_DIMMER_BRIDGE_JUMPER_UNVERIFIED' && issue.moduleId === moduleId),
      'Nonadjacent group must show an unresolved jumper requirement');
    const expected = expectedWires(false, [[2], [4]]);
    const displayKey = ({ from, to, conductor }) => `${from}|${to}|${conductor}`;
    const wires = await getWiringRows(page);
    assert.deepEqual(wires.filter(monitoredWire).map(displayKey).sort(), expected.map(displayKey).sort(),
      'The nonadjacent group contributes no wires while ungrouped channels and DC remain available');
    assert.deepEqual(wires.filter(wire => wire.to.startsWith('X-C01:')).map(wire => wire.conductor), ['PE'],
      'The pending branch must not bypass the dimmer directly to the load');
    assert.equal(draft.circuits.C01.powered, false);
    assert.equal(draft.circuits.C01.neutralOk, false);
    assert.ok(draft.circuits.C02.powered && draft.circuits.C04.powered);
    await page.locator('#terminal-connections-tab').click();
    const options = page.locator(`[data-key="${terminal}"] [data-field="output"] option`);
    const dimmerChoices = (await options.evaluateAll(entries => entries.map(option => option.value)))
      .filter(value => value.startsWith(`${moduleId}:`));
    assert.deepEqual(dimmerChoices.sort(), ['D1:CH2_OUT', 'D1:CH4_OUT'],
      'The gray terminal picker only offers the active independent DIM outputs');
  } finally {
    await page.close();
  }
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PDF_BROWSER || 'chrome', headless: true });
try {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 }, acceptDownloads: true });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.__PANEL_STATE__);
  const fixture = await page.evaluate(async ({ phases, productId, bridgeMode, withCresnet, withChain, controllerId, dimmerIds }) => {
    const { createBreakerPackDesign } = await import('/src/data/design-templates.js');
    const scenario = bridgeMode ? '双组桥接' : withChain ? 'Cresnet 串接' : withCresnet ? 'Cresnet 控制线' : '四路独立馈电';
    const count = withChain ? 4 : 5;
    const design = createBreakerPackDesign({ count, productId: 'A9D32610', name: `DIN-4DIMU4 ${scenario}验收` });
    design.designId = 'din-4dimu4-' + (bridgeMode ? 'bridge-' : withChain ? 'cresnet-chain-' : withCresnet ? 'cresnet-' : '') + 'acceptance';
    design.includeSpd = false;
    design.circuits.forEach((circuit, index) => {
      circuit.phase = phases[index] || 'L2';
      circuit.name = index < count - 1 ? `测试灯具 ${index + 1}` : '24V 电源支路';
    });
    design.modules = [
      { id: 'PS1', productId: withChain ? 'crestron-din-pws50' : 'meanwell-hdr-100-24n', protectId: withChain ? 'C04' : 'C05' },
      ...dimmerIds.map(id => ({ id, productId })),
      { id: 'XT1', productId: 'phoenix-pt25-gy-4' },
    ];
    if (withCresnet) {
      design.modules.push({ id: controllerId, productId: 'crestron-din-ap4' });
      design.featureVisibility = { ...design.featureVisibility, busEditor: true };
    }
    design.revisions = [{ at: '2026-11-18T12:00:00', summary: `${scenario}验收`, errors: 0, pending: 0 }];
    return design;
  }, { phases, productId, bridgeMode, withCresnet, withChain, controllerId, dimmerIds });
  await loadDesign(page, fixture);

  await openModule(page, moduleId);
  assert.match(await page.locator('#mod-power-description').innerText(), /24V.*24\s*\/\s*G/su);
  assert.match(await page.locator('#mod-power-description').innerText(), /跳线/u);
  assert.equal(await page.locator('#mod-protect, #mod-feed, #mod-feed-c').count(), 0);
  if (bridgeMode) {
    const mode = page.locator('#mod-bridge-mode');
    const offered = await mode.locator('option').evaluateAll(options => options.filter(option => !option.disabled).map(option => option.value));
    assert.deepEqual(offered.sort(), ['0000', '1100', '0011', '1010', '1110', '1001', '1101', '1111', '1122'].sort(),
      'Available bridge patterns must match the Crestron SIMPL table');
    await mode.selectOption(bridgeMode);
  }
  for (const [channel, circuit] of feeds) {
    const selector = page.locator(`[data-mod-ch="${channel}"]`);
    await selector.selectOption(circuit);
    await page.locator(`[data-mod-label="${channel}"]`).fill(`测试灯具 ${channel}`);
  }
  const duplicateFeed = page.locator(`[data-mod-ch="${feeds[1]?.[0] || 2}"] option[value="${feeds[0][1]}"]`);
  assert.ok((await duplicateFeed.count()) === 0 || await duplicateFeed.evaluate(option => option.disabled),
    'The second output group cannot claim the first group’s branch');
  if (bridgeMode) {
    assert.equal(await page.locator('[data-mod-ch="2"]:enabled, [data-mod-ch="4"]:enabled').count(), 0,
      'Member channels cannot have a separate branch feed');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator('#modal').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 2),
      'Bridge configuration must fit at 390 px');
    await page.setViewportSize({ width: 1500, height: 1050 });
  }
  await page.locator('#mod-save').click();
  await page.locator('#modal').waitFor({ state: 'hidden' });
  if (withChain) {
    for (const [index, id] of dimmerIds.slice(1).entries()) {
      await openModule(page, id);
      await page.locator('[data-mod-ch="1"]').selectOption(circuits[index + 1]);
      await page.locator('[data-mod-label="1"]').fill(`测试灯具 ${index + 2}`);
      await page.locator('#mod-save').click();
      await page.locator('#modal').waitFor({ state: 'hidden' });
    }
  } else {
    await openModule(page, 'PS1');
    await page.locator('[data-psu-target="D1"]').check();
    await page.locator('#mod-save').click();
    await page.locator('#modal').waitFor({ state: 'hidden' });
  }

  const cresnetBusId = withCresnet ? await configureCresnet(page) : null;
  const beforeTerminal = await getWiringRows(page);
  const rowKey = ({ from, to, conductor }) => `${from}|${to}|${conductor}`;
  assert.deepEqual(beforeTerminal.filter(monitoredWire).map(rowKey).sort(), expectedWires().map(rowKey).sort(),
    'On-screen wiring must show one protected feed and load per group, its own jumper connections, and separate 24/G');
  if (bridgeMode) {
    const states = await page.evaluate(async () => {
      const { simulate } = await import('/src/core/domain.js');
      const panel = window.__PANEL_STATE__;
      const normal = simulate(panel.net(), panel.design(), { power: true }).circuits;
      const trip = simulate(panel.net(), panel.design(), { power: true, trip: 'C01' }).circuits;
      return { normal, trip };
    });
    assert.ok(states.normal.C01.powered && states.normal.C03.powered);
    assert.equal(states.trip.C01.powered, false);
    assert.equal(states.trip.C01.neutralOk, false);
    assert.equal(states.trip.C03.powered, true);
    assert.equal(states.trip.C03.neutralOk, true);
  }

  await page.locator('#terminal-connections-tab').click();
  const terminalRow = page.locator(`[data-key="${terminal}"]`);
  const output = terminalRow.locator('[data-field="output"]');
  if (bridgeMode) {
    const dimmerChoices = (await output.locator('option').evaluateAll(options => options.map(option => option.value)))
      .filter(value => value.startsWith(`${moduleId}:`));
    assert.deepEqual(dimmerChoices.sort(), ['D1:CH1_OUT', 'D1:CH3_OUT'], 'Only group leads can feed gray terminals');
  }
  await terminalRow.locator('[data-field="loadName"]').fill(`测试灯具 ${terminalChannel}`);
  await output.selectOption(terminalOutput);
  await page.locator('#terminal-save').click();
  assert.match(await page.locator('.terminal-status').innerText(), /接线已保存/u);

  await page.locator('#settings').click();
  await page.locator('#settings-ui-mode').selectOption('full');
  await page.locator('#settings-save').click();
  await page.reload();
  await page.waitForFunction(() => window.__PANEL_STATE__?.uiMode() === 'full');
  if (withCresnet) await checkCresnetSettings(page, cresnetBusId);
  await openModule(page, moduleId);
  if (bridgeMode) assert.equal(await page.locator('#mod-bridge-mode').inputValue(), bridgeMode);
  for (const [channel, circuit] of feeds) {
    assert.equal(await page.locator(`[data-mod-ch="${channel}"]`).inputValue(), circuit);
    assert.equal(await page.locator(`[data-mod-label="${channel}"]`).inputValue(), `测试灯具 ${channel}`);
  }
  await page.locator('#close-modal').click();

  const expected = expectedWires(true);
  await page.locator(`[data-part="${terminalCircuit}"]`).click();
  const afterTerminal = await getWiringRows(page);
  assert.deepEqual(afterTerminal.filter(monitoredWire).map(rowKey).sort(), expected.map(rowKey).sort(),
    'On-screen wiring table must use the gray terminal instead of the replaced virtual phase endpoint');
  const schematic = page.locator('#independent-feed-schematic');
  assert.match(await schematic.innerText(), bridgeMode ? /桥接/u : /出厂.*跳线/u);
  assert.equal(await schematic.locator(`[data-schematic-from="${terminalOutput}"][data-schematic-to="${terminal}"]`).isVisible(), true);
  if (directCresnet) await checkCresnetSchematic(schematic, directWires);
  if (withChain) {
    for (const [index, id] of dimmerIds.entries()) {
      await selectWiringSchematic(page, circuits[index]);
      const localLinks = chainWires.filter(wire => [wire.from, wire.to].some(end => end.startsWith(id + ':')));
      await checkCresnetSchematic(schematic, localLinks);
    }
    const chainSchematic = page.locator('#cresnet-schematic');
    await selectWiringSchematic(page, controllerId);
    await checkCresnetSchematic(chainSchematic, chainWires);
    await chainSchematic.screenshot({ path: `${out}/schematic.png` });
  }
  if (bridgeMode) {
    for (const port of ['IN', 'N', 'OUT']) {
      assert.equal(await schematic.locator(`[data-schematic-from="D1:CH3_${port}"][data-schematic-to="D1:CH4_${port}"]`).isVisible(), true);
    }
  }
  const csvButtonDownload = page.waitForEvent('download');
  await page.locator('#wires-csv').click();
  const csvButtonPath = out + '/wiring-from-screen.csv';
  await (await csvButtonDownload).saveAs(csvButtonPath);
  checkWires(parseWireCsv(readFileSync(csvButtonPath, 'utf8')), expected, 'Wiring-tab CSV must agree with the screen');

  await page.locator('[data-tab="assembly"]').click();
  const isolate = page.locator('#inspect-only.active');
  if (await isolate.isVisible()) await isolate.click();
  await page.locator('#wire-mode').selectOption('all');
  await page.locator('[data-mode="front"]').click();
  await page.waitForFunction(() => {
    const view = window.__PANEL_STATE__?.studio();
    return view?.model?.layers.wires.visible && view.terminalWires?.visible && !view.options.isolate
      && view.renderer.domElement.dataset.ready === 'true' && !view.cameraTarget;
  });
  const viewport = await page.evaluate(({ terminal, monitoredIds, dimmerIds }) => {
    const state = window.__PANEL_STATE__;
    const view = state.studio();
    const net = state.net();
    const segment = view.segments.find(item => item.id === terminal);
    const samePoint = (a, b) => a && b && ['x','y','z'].every(axis => Math.abs(a[axis] - b[axis]) < 1e-5);
    const physicalWire = segment && view.terminalWires.children.find(child => {
      const points = child.geometry?.parameters?.path?.points;
      return child.visible && points && samePoint(points[0], segment.source) && samePoint(points.at(-1), segment.target);
    });
    const touchesDevice = edge => [edge.from, edge.to].some(end => monitoredIds.includes(net.ports[end]?.node));
    const wires = [...view.model.wires.values()].filter(ref => ref.mesh.visible && touchesDevice(ref.edge)).map(({ edge, curve }) => ({
      from: edge.from, to: edge.to, conductor: edge.conductor, wireClass: edge.class, circuit: edge.circuit || '',
      bridgeTerminal: edge.bridgeJumper ? edge.bridgeTerminal : null,
      cresnet: edge.cresnet === true,
      connected: edge.connected,
      drawnAtPorts: samePoint(curve?.points[0], net.ports[edge.from]) && samePoint(curve?.points.at(-1), net.ports[edge.to]),
    }));
    if (physicalWire) {
      const { edge } = view.model.wires.get(segment.replacedWireId);
      wires.push({ from: segment.physicalOutput, to: segment.id, conductor: edge.conductor, wireClass: edge.class,
        circuit: edge.circuit, drawnAtPorts: samePoint(segment.source, net.ports[segment.physicalOutput]) });
    }
    const physicalPoints = physicalWire?.geometry.parameters.path.points;
    return { wires, ports: Object.values(net.ports).filter(port => dimmerIds.includes(port.node)),
      physical: !!physicalWire, virtual: !!view.model.wires.get(segment?.replacedWireId)?.mesh.visible,
      upperExit: physicalPoints?.[1].y > physicalPoints?.[0].y };
  }, { terminal, monitoredIds, dimmerIds });
  assert.equal(viewport.physical, true, 'Gray terminal phase cable must be visible in WebGL');
  assert.equal(viewport.virtual, false, 'Replaced virtual phase cable must be hidden in WebGL');
  assert.equal(viewport.upperExit, true, 'The physical cable must leave DIM through the top terminal');
  checkWires(viewport.wires, expected, 'Visible WebGL wire endpoints, phase, neutral, and voltage class');
  assert.ok(viewport.wires.every(wire => wire.drawnAtPorts), 'Wire meshes must reach their actual port anchors');
  if (withCresnet) {
    const links = viewport.wires.filter(wire => wire.cresnet);
    assert.deepEqual(links.map(key).sort(), cresnetWires.map(key).sort(), 'Every conductor in the Cresnet cable must be identified in WebGL');
    assert.ok(links.every(wire => wire.connected), 'Every expected Cresnet connection must be active');
  }
  if (bridgeMode) {
    assert.deepEqual(viewport.wires.map(wire => wire.bridgeTerminal).filter(Boolean).sort(), ['D', 'D', 'L', 'L', 'N', 'N']);
  }
  const channelPorts = circuits.flatMap((_, index) => ['N', 'IN', 'OUT'].map(suffix => `CH${index + 1}_${suffix}`));
  const cresnetPorts = ['DC+', 'NET_Y', 'NET_Z', 'DC-', 'NET2_24', 'NET2_Y', 'NET2_Z', 'NET2_G'];
  const expectedPorts = dimmerIds.flatMap(id => [...channelPorts, ...cresnetPorts].map(port => `${id}:${port}`));
  assert.deepEqual(viewport.ports.map(port => port.id).sort(), expectedPorts.sort(), 'WebGL must expose all documented channel and NET ports');
  for (const port of viewport.ports) {
    if (port.key.startsWith('CH')) assert.equal(port.side, 'top', port.key);
    if (port.key.startsWith('DC')) assert.equal(port.side, 'bottom', port.key);
    if (port.key.startsWith('NET')) assert.equal(port.side, 'bottom', port.key);
  }
  for (const id of dimmerIds) {
    const loadPortOrder = viewport.ports.filter(port => port.node === id && port.key.startsWith('CH'))
      .sort((a, b) => a.x - b.x).map(port => port.key);
    assert.deepEqual(loadPortOrder, channelPorts, 'The top face must present N/L/D in each channel group');
  }
  await page.locator('#canvas').screenshot({ path: `${out}/assembly.png` });

  await page.locator('#tab-documents').click();
  await page.locator('#v5-docs-none').click();
  const wiringSelections = page.locator('[data-doc^="wiring-table"]');
  const counts = await wiringSelections.count();
  if (!counts) assert.fail(`Wiring pages missing from document center: ${await page.locator('#v5-docs-preview').innerText()}`);
  for (const box of await wiringSelections.all()) await box.check();
  const previewRows = await page.locator('#v5-docs-preview .doc-wiring-table tbody tr').count();

  await page.evaluate(() => {
    window.print = () => { window.__DIN_PRINT_READY__ = true; };
  });
  await page.locator('#v5-docs-print').click();
  await page.locator('#v5-export-current').click();
  await page.waitForFunction(() => window.__DIN_PRINT_READY__ === true);
  const printRows = await page.locator('#v5-print-root .doc-wiring-table tbody tr').evaluateAll(rows => rows.map(row => {
    const [from, to] = [...row.cells[1].childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent.trim());
    return { id: row.cells[0].querySelector('.muted').textContent.replace(/^编号：/, ''), from, to };
  }));
  assert.equal(printRows.length, previewRows);
  assert.equal(await page.locator('#v5-print-root .print-sheet').count(), counts);
  assert.equal(await page.locator('#v5-print-root [data-layout-overflow="true"]').count(), 0);

  const pdfPath = `${out}/wiring.pdf`;
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  const pdfInfo = execFileSync('pdfinfo', ['-f', '1', '-l', String(counts), pdfPath], { encoding: 'utf8' });
  assert.equal(Number(pdfInfo.match(/Pages:\s+(\d+)/)?.[1]), counts, 'Every selected wiring sheet must be one PDF page');
  const pdfSizes = [...pdfInfo.matchAll(/Page\s+\d+\s+size:\s+([\d.]+) x ([\d.]+)/g)];
  assert.equal(pdfSizes.length, counts);
  assert.ok(pdfSizes.every(([, width, height]) => Math.abs(Number(width) - 595) < 2 && Math.abs(Number(height) - 842) < 2));

  const zipPath = `${out}/handover.zip`;
  await page.locator('#v5-docs-zip').click();
  const exportError = page.locator('#toast').filter({ hasText: /ZIP 失败|交付失败/u });
  const downloaded = Promise.race([
    page.waitForEvent('download'),
    exportError.waitFor({ state: 'visible' }).then(async () => {
      throw new Error(await exportError.innerText());
    }),
  ]);
  await page.locator('#v5-export-current').click();
  await (await downloaded).saveAs(zipPath);
  const files = unzipSync(readFileSync(zipPath));
  const csvBytes = Buffer.from(files['端子接线表.csv']);
  assert.ok(csvBytes.equals(readFileSync(csvButtonPath)), 'Wiring-tab CSV and handover CSV must be identical');
  writeFileSync(`${out}/wiring.csv`, csvBytes);
  const exported = JSON.parse(strFromU8(files['方案.json']));
  const savedDimmer = exported.modules.find(module => module.id === moduleId);
  assert.equal(savedDimmer.feed, 'perChannel');
  const assigned = new Map(feeds);
  assert.deepEqual(Object.values(savedDimmer.channels), circuits.map((_, index) => assigned.get(index + 1) || null));
  if (bridgeMode) assert.equal(savedDimmer.bridgeMode, bridgeMode);
  if (withCresnet) {
    const savedBus = exported.buses.find(bus => bus.id === cresnetBusId);
    assert.equal(savedBus.type, 'cresnet');
    assert.equal(savedBus.controllerModuleId, controllerId);
    assert.deepEqual(savedBus.deviceModuleIds, dimmerIds);
    if (withChain) {
      assert.equal(savedBus.chainSupplyModuleId, chainSupplyId);
      assert.equal(savedBus.chainPowerMeters, 18);
      assert.equal(savedBus.cableMeters, 24);
      assert.ok(!exported.buses.some(bus => bus.type === 'dc' && bus.deviceModuleIds.some(id => dimmerIds.includes(id))),
        'The chain does not create an independent DC feed in the exported configuration');
      for (const [index, id] of dimmerIds.entries()) {
        assert.equal(exported.modules.find(module => module.id === id).channels[1], circuits[index]);
      }
    } else {
      assert.ok(exported.buses.some(bus => bus.type === 'dc' && bus.deviceModuleIds.includes(moduleId)),
        'The dimmer retains its separate 24 V power network');
    }
  }

  const csvRows = parseWireCsv(csvBytes.toString('utf8')).filter(monitoredWire);
  checkWires(csvRows, expected, 'Handover CSV must agree with the visible WebGL connections');
  if (bridgeMode) {
    const wires = csvRows.filter(row => row.material.startsWith('厂家跨接件 '));
    assert.deepEqual(wires.map(row => row.material).sort(), [2065817, 2065818, 2065819]
      .flatMap(part => Array(2).fill(`厂家跨接件 ${part}`)).sort());
    assert.ok(wires.every(row => row.section === ''), 'Factory jumpers have part numbers instead of an assumed wire gauge');
  }
  if (withCresnet) {
    for (const expected of cresnetWires) {
      const line = csvRows.find(row => key(row) === key(expected));
      assert.equal(Number(line.section), expected.section, `Cresnet ${line.conductor} wire gauge`);
      assert.equal(line.fromTag, expected.fromTag);
      assert.equal(line.toTag, expected.toTag);
    }
  }
  const pdfPages = extractPdfPages(pdfPath).map(compact);
  const jumperNote = bridgeMode ? /桥接[^。]*1122|1122[^。]*桥接/u : /出厂的?L\/N共接跳线/u;
  assert.ok(pdfPages.some(text => jumperNote.test(text)), 'PDF must include the selected wiring condition');
  const pdfRows = pdfPages.flatMap(page => page.split('编号:').slice(1));
  const monitoredPdfRows = pdfRows.filter(row => monitoredIds.some(id => row.includes(`从:${id}.`) || row.includes(`到:${id}.`)));
  assert.equal(monitoredPdfRows.length, expected.length, 'Printed PDF fixture wire count');
  for (const row of csvRows) {
    const printRow = printRows.find(item => compact(item.from) === compact(`从:${row.fromTag}`)
      && compact(item.to) === compact(`到:${row.toTag}`));
    assert.ok(printRow, `Print table omitted ${row.from} → ${row.to}`);
    const pdfId = compact(printRow.id);
    const inPdf = pdfRows.find(item => item.startsWith(pdfId));
    const endpoints = compact(`从:${row.fromTag}到:${row.toTag}`);
    assert.ok(inPdf?.includes(endpoints), `Printed PDF omitted or changed ${row.fromTag} → ${row.toTag}`);
    if (row.wireClass === 'comms' || (withChain && row.wireClass === 'dc')) {
      assert.ok(inPdf.includes(compact(`${row.section} mm²`)), `Printed PDF omits the ${row.conductor} wire size`);
    }
  }
  for (const id of dimmerIds) {
    for (const channel of withChain ? [1] : [1, 2, 3, 4]) {
      const prefix = `${id}.CH${channel}-`;
      for (const suffix of ['L', 'N', 'D']) {
        assert.ok(csvRows.some(row => [row.fromTag, row.toTag].includes(`${prefix}${suffix}`)));
      }
    }
  }
  if (!withChain) assert.deepEqual(csvRows.filter(row => row.wireClass === 'dc').map(row => row.toTag).sort(), ['D1.NET-24', 'D1.NET-G']);
  const sampleTag = withChain ? 'GW1.NET-Y' : withCresnet ? 'D1.NET2-Y' : 'D1.CH1-N';
  const channelPage = pdfPages.findIndex(page => page.includes(sampleTag));
  assert.ok(channelPage >= 0, `PDF lacks endpoint ${sampleTag}`);
  execFileSync('pdftoppm', ['-f', String(channelPage + 1), '-l', String(channelPage + 1), '-r', '110', '-png',
    '-singlefile', pdfPath, `${out}/wiring-page`]);
  if (withChain) {
    const tailPage = pdfPages.findIndex(page => page.includes('D3.NET-Y'));
    assert.ok(tailPage >= 0, 'PDF lacks the final Cresnet link');
    execFileSync('pdftoppm', ['-f', String(tailPage + 1), '-l', String(tailPage + 1), '-r', '110', '-png',
      '-singlefile', pdfPath, `${out}/wiring-chain-tail`]);
  }
  if (bridgeMode) await checkNonadjacentDraft(browser, fixture, errors);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', bridgeMode: bridgeMode || '0000', cresnet: withCresnet, chain: withChain,
    chainRows: withChain ? chainWires.length : 0, wireRows: csvRows.length, a4Pages: counts, renderedPage: channelPage + 1, output: out }));
} finally {
  await browser.close();
}
