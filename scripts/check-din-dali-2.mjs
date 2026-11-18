// Requires the Vite dev server, a current production build, Chrome and Poppler.
// Override PANEL_URL, PDF_BROWSER or PDF_PYTHON for local installations.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { chromium } from 'playwright';

const baseUrl = process.env.PANEL_URL || 'http://127.0.0.1:5173/';
const gateway = 'GW1';
const controls = 'PS1';
const supplies = ['PS2', 'PS3'];
const outputDir = '.playwright-cli/din-dali-2';
const pair = ({ from, to, conductor }) => [from, to, conductor].join('|');
const sortedPairs = wires => wires.map(pair).sort();
const atGateway = ({ from, to }) => [from, to].some(end => end.startsWith(gateway + ':'));
import {csvRows,pdfPages,compact} from './wiring-check-helpers.mjs';

function expectedWires(mode) {
  const wires = ['+', '-'].map(sign => ({
    from: controls + ':DC' + sign, to: gateway + ':DC' + sign,
    conductor: 'DC' + sign, wireClass: 'dc', fromTag: controls + '.NET-' + (sign === '+' ? '24' : 'G'),
    toTag: gateway + '.NET-' + (sign === '+' ? '24' : 'G'),
  }));
  if (mode === 'EXT') {
    for (const [index, supply] of supplies.entries()) {
      const loop = 'DALI' + (index + 1);
      for (const [suffix, sign] of [['PLUS', '+'], ['MINUS', '-']]) {
        wires.push({ from: supply + ':BUS' + sign, to: gateway + ':' + loop + '_' + suffix,
          conductor: 'BUS' + sign, wireClass: 'comms', fromTag: supply + '.DA' + sign,
          toTag: gateway + '.' + loop + '-DA' + sign });
      }
    }
  }
  return wires;
}

async function importFixture(page, mode) {
  const fixture = await page.evaluate(async mode => {
    const { createBreakerPackDesign } = await import('/src/data/design-templates.js');
    const design = createBreakerPackDesign({ count: 3, productId: 'A9D32610', name: 'DIN-DALI-2 ' + mode + ' 接线验收' });
    design.designId = 'din-dali-2-' + mode.toLowerCase() + '-acceptance';
    design.uiMode = mode === 'INT' ? 'simple' : 'full';
    design.includeSpd = false;
    design.featureVisibility = { ...design.featureVisibility, busEditor: true };
    design.revisions = [{ at: '2026-11-19T12:00:00', summary: 'DALI 拨档接线验收', errors: 0, pending: 0 }];
    design.modules = [
      { id: 'PS1', productId: 'crestron-din-pws50', protectId: 'C01' },
      { id: 'PS2', productId: 'lunatone-dali-ps-24033444', protectId: 'C02' },
      { id: 'PS3', productId: 'lunatone-dali-ps-24033444', protectId: 'C03' },
      { id: 'GW1', productId: 'crestron-din-dali-2' },
      { id: 'GW2', productId: 'crestron-din-dli' },
    ];
    return design;
  }, mode);
  await page.locator('#file').setInputFiles({
    name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.waitForFunction(id => window.__PANEL_STATE__.design().designId === id, fixture.designId);
  return fixture.designId;
}

async function openModule(page, id) {
  await page.locator('#manage-modules').click();
  await page.locator('[data-mod-edit="' + id + '"]').click();
}

async function saveModule(page) {
  await page.locator('#mod-save').click();
  await page.locator('#modal').waitFor({ state: 'hidden' });
}

async function configure(page, mode) {
  await openModule(page, controls);
  await page.locator('[data-psu-target="' + gateway + '"]').check();
  await saveModule(page);
  await openModule(page, 'GW2');
  assert.equal(await page.locator('#mod-dali-mode').count(), 0, 'DIN-DLI must have no EXT switch');
  await page.locator('#close-modal').click();
  await openModule(page, supplies[0]);
  const dliChoice = page.locator('[data-psu-target="GW2"]');
  if (await dliChoice.count()) assert.ok(await dliChoice.isDisabled(), 'An external DALI PSU cannot power DIN-DLI');
  await page.locator('#close-modal').click();

  await openModule(page, gateway);
  const powerMode = page.locator('#mod-dali-mode');
  assert.equal(await powerMode.inputValue(), 'INT', 'Old projects default to internal DALI power');
  await powerMode.selectOption('EXT');
  for (const [index, source] of supplies.entries()) {
    const select = page.locator('#mod-dali-supply-' + (index + 1));
    const illegalSource = select.locator('option[value="' + controls + '"]:not(:disabled)');
    assert.equal(await illegalSource.count(), 0, 'A 24 V controller supply cannot be selected on DALI');
    if (index === 1) {
      assert.equal(await select.locator('option[value="' + supplies[0] + '"]:not(:disabled)').count(), 0,
        'A supply already assigned to DALI 1 cannot also power DALI 2');
    }
    await select.selectOption(source);
  }
  await saveModule(page);
  if (mode === 'INT') {
    await openModule(page, gateway);
    await page.locator('#mod-dali-mode').selectOption('INT');
    await saveModule(page);
  }
}

async function verifyReopened(page, mode, designId) {
  await page.reload();
  await page.waitForFunction(id => window.__PANEL_STATE__?.design().designId === id, designId);
  const watts = mode === 'INT' ? 9 : 2;
  await openModule(page, gateway);
  assert.equal(await page.locator('#mod-dali-mode').inputValue(), mode);
  assert.match(await page.locator('#mod-dali-budget').innerText(), new RegExp('\\b' + watts + '\\s*W\\b', 'iu'));
  for (const [index, source] of supplies.entries()) {
    const select = page.locator('#mod-dali-supply-' + (index + 1));
    if (mode === 'EXT') assert.equal(await select.inputValue(), source);
    else assert.ok(!await select.isVisible() || await select.isDisabled(), 'INT must prevent choosing an external DALI supply');
  }
  await page.locator('#close-modal').click();
  if (await page.evaluate(() => window.__PANEL_STATE__.uiMode() === 'simple')) {
    await page.locator('#settings').click();
    await page.locator('#settings-ui-mode').selectOption('full');
    await page.locator('#settings-save').click();
  }
  await page.locator('[data-feature="busEditor"]').click();
  const controlBudget = page.locator('.feature-bus-list article').filter({ hasText: controls + ' ' });
  await controlBudget.locator('[data-bus-edit]').click();
  await page.locator('#bus-unit').selectOption('W');
  await page.locator('[data-bus-save]').click();
  await controlBudget.waitFor();
  assert.match(await controlBudget.innerText(), new RegExp('\\b' + watts + '\\s*/\\s*[\\d.]+\\s*W\\b', 'iu'),
    'The saved 24 V supply budget must use the current whole-device switch setting once');
  await page.locator('#close-modal').click();
}

async function verifyScreen(page, expected, mode, dir) {
  await page.locator('[data-tab="assembly"]').click();
  await page.locator('[data-part="' + gateway + '"]').click();
  await page.locator('[data-tab="wiring"]').click();
  const diagram = page.locator('#dali-schematic');
  assert.match(await diagram.innerText(), new RegExp(mode, 'u'));
  for (const { from, to } of expected) {
    assert.ok(await diagram.locator('[data-schematic-from="' + from + '"][data-schematic-to="' + to + '"]').isVisible(),
      'Endpoint missing from selected device diagram: ' + from + ' → ' + to);
  }
  await diagram.screenshot({ path: dir + '/schematic.png' });
  await page.locator('#all-wires').check();
  const rows = await page.locator('#pane tr[data-wire-from]').evaluateAll(rows => rows.map(row => ({
    from: row.dataset.wireFrom, to: row.dataset.wireTo, conductor: row.cells[0].textContent.trim(),
  })));
  assert.deepEqual(sortedPairs(rows.filter(atGateway)), sortedPairs(expected), 'Physical connections in wiring tab');
  const download = page.waitForEvent('download');
  await page.locator('#wires-csv').click();
  await (await download).saveAs(dir + '/wiring-from-screen.csv');
  const csv = csvRows(readFileSync(dir + '/wiring-from-screen.csv', 'utf8'));
  assert.deepEqual(sortedPairs(csv), sortedPairs(rows), 'All on-screen wiring rows agree with the direct CSV');
  const mains = csv.filter(w => w.wireClass === 'power' && [controls, ...supplies].some(id => w.to.startsWith(id + ':')));
  const expectedMains = [controls, ...supplies].flatMap((id, index) => {
    const branch = 'C0' + (index + 1);
    const connections = [
      { from: branch + ':L1_OUT', to: id + ':L_IN', conductor: 'L1' },
      { from: branch + ':N_OUT', to: id + ':N_IN', conductor: 'N' },
    ];
    if (id === controls) connections.push({ from: 'PE:PE-' + branch, to: id + ':PE_IN', conductor: 'PE' });
    return connections;
  });
  assert.deepEqual(sortedPairs(mains), sortedPairs(expectedMains), 'All three power supplies have their own documented AC feeds');
  for (const wire of expected) {
    const saved = csv.find(row => pair(row) === pair(wire));
    assert.equal(saved.toTag, wire.toTag, 'Label must identify the actual NET or DALI loop and polarity');
    assert.equal(saved.fromTag, wire.fromTag, 'Documented PSU output polarity');
    assert.equal(saved.wireClass, wire.wireClass);
    assert.equal(saved.state, '已连接');
    assert.equal(saved.wireTag, wire.wireClass === 'dc' ? wire.conductor : wire.toTag,
      'Default cable labels preserve the signed control conductor and individual DALI endpoint');
  }

  await page.locator('[data-tab="assembly"]').click();
  const isolate = page.locator('#inspect-only.active');
  if (await isolate.isVisible()) await isolate.click();
  await page.locator('#wire-mode').selectOption('all');
  await page.locator('[data-mode="front"]').click();
  await page.waitForFunction(() => {
    const view = window.__PANEL_STATE__?.studio();
    return view?.model?.layers.wires.visible && view.renderer.domElement.dataset.ready === 'true' && !view.cameraTarget && !view.options.isolate;
  });
  const geometry = await page.evaluate(ids => {
    const state = window.__PANEL_STATE__, view = state.studio(), net = state.net();
    const atPort = (vector, port) => vector && port && ['x', 'y', 'z'].every(axis => Math.abs(vector[axis] - port[axis]) < 1e-5);
    const visible = [...view.model.wires.values()].filter(({ edge, mesh }) => mesh.visible
      && [edge.from, edge.to].some(end => ids.includes(net.ports[end]?.node)));
    return {
      ports: Object.values(net.ports).filter(p => ids.includes(p.node)).map(p => ({
        id: p.node, key: p.key, side: p.side, x: p.x, y: p.y, z: p.z,
      })),
      wires: visible.map(({ edge, curve }) => ({
        from: edge.from, to: edge.to, conductor: edge.conductor, connected: edge.connected,
        anchored: atPort(curve?.points[0], net.ports[edge.from]) && atPort(curve?.points.at(-1), net.ports[edge.to]),
      })),
    };
  }, [gateway, controls, ...supplies]);
  const monitored = rows.filter(({from, to}) => [gateway, controls, ...supplies].some(id =>
    from.startsWith(id + ':') || to.startsWith(id + ':')));
  assert.deepEqual(sortedPairs(geometry.wires), sortedPairs(monitored), 'All gateway, control and external supply cables match the wiring screen');
  assert.ok(geometry.wires.every(wire => wire.connected && wire.anchored), 'Every visible gateway and PSU wire must end on its physical anchors');
  const keys = ['DC+', 'DC-', 'DALI1_PLUS', 'DALI1_MINUS', 'DALI2_PLUS', 'DALI2_MINUS',
    'DALI1_PLUS_2', 'DALI1_MINUS_2', 'DALI2_PLUS_2', 'DALI2_MINUS_2'];
  const actualPorts = keys.map(key => geometry.ports.find(port => port.id === gateway && port.key === key));
  assert.ok(actualPorts.every(Boolean), 'Both DALI pairs and the control power pair exist in either mode');
  assert.equal(new Set(actualPorts.map(port => [port.x, port.y, port.z].join('|'))).size, keys.length,
    'Control terminals and DALI loop terminal positions are distinct');
  for (const port of actualPorts) assert.equal(port.side, port.key.startsWith('DC') ? 'bottom' : 'top');
  for (const id of supplies) {
    const ports = geometry.ports.filter(port => port.id === id);
    assert.deepEqual(ports.filter(p => p.side === 'top').map(p => p.key).sort(), ['BUS+', 'BUS-']);
    assert.deepEqual(ports.filter(p => p.side === 'bottom').map(p => p.key).sort(), ['L_IN', 'N_IN']);
  }
  await page.locator('#canvas').screenshot({ path: dir + '/assembly.png' });
  return csv;
}

async function verifyDelivery(page, csv, mode, dir) {
  await page.locator('#tab-documents').click();
  await page.locator('#v5-docs-none').click();
  const selection = page.locator('[data-doc^="wiring-table"]');
  await selection.first().waitFor();
  const pageCount = await selection.count();
  for (const box of await selection.all()) await box.check();
  await page.evaluate(() => {
    window.print = () => { window.__DALI_PRINT_READY__ = true; };
  });
  await page.locator('#v5-docs-print').click();
  await page.locator('#v5-export-current').click();
  await page.waitForFunction(() => window.__DALI_PRINT_READY__ === true);
  const sheets = page.locator('#v5-print-root .print-sheet');
  assert.equal(await sheets.count(), pageCount);
  assert.equal(await page.locator('#v5-print-root [data-layout-overflow="true"]').count(), 0);
  const printed = await page.locator('#v5-print-root .doc-wiring-table tbody tr').evaluateAll(rows => rows.map(row => {
    const [from, to] = [...row.cells[1].childNodes].filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim());
    return { id: row.cells[0].querySelector('.muted').textContent.replace(/^编号：/u, ''), from, to };
  }));
  const pdfPath = dir + '/wiring.pdf';
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  const info = execFileSync('pdfinfo', ['-f', '1', '-l', String(pageCount), pdfPath], { encoding: 'utf8' });
  assert.equal(Number(info.match(/Pages:\s+(\d+)/u)?.[1]), pageCount, 'Print sheets and exported page count');
  const sizes = [...info.matchAll(/Page\s+\d+\s+size:\s+([\d.]+) x ([\d.]+)/gu)];
  assert.equal(sizes.length, pageCount);
  assert.ok(sizes.every(([, w, h]) => Math.abs(Number(w) - 595) < 2 && Math.abs(Number(h) - 842) < 2),
    'Wiring document must fit A4 portrait');

  const pdf = pdfPages(pdfPath);
  const watts = mode === 'INT' ? 9 : 2;
  assert.ok(pdf.some(text => text.includes(compact('DALI POWER · ' + mode + ' · Cresnet 供电时 ' + watts + ' W'))),
    'Actual PDF records the selected whole-device mode and its Cresnet demand');
  const records = pdf.flatMap(text => text.split('编号:').slice(1));
  assert.equal(records.length, csv.length, 'Actual PDF and CSV contain the same wire count');
  assert.equal(printed.length, records.length);
  for (const wire of csv) {
    const from = compact('从:' + wire.fromTag), to = compact('到:' + wire.toTag);
    const entry = printed.find(row => compact(row.from) === from && compact(row.to) === to);
    assert.ok(entry, 'Missing endpoint pair in print table: ' + wire.fromTag + ' → ' + wire.toTag);
    const pdfRow = records.find(text => text.startsWith(compact(entry.id) + from));
    assert.ok(pdfRow?.includes(from + to), 'Actual PDF changed an endpoint in ' + entry.id);
    if (atGateway(wire)) {
      assert.ok(pdfRow.includes(wire.wireClass === 'comms' ? '通信总线' : '直流电源线'), 'Printed wire class for ' + wire.to);
      assert.ok(pdf.some(text => text.includes(compact(wire.wireTag + '编号:' + entry.id))),
        'The wire number printed next to ' + entry.id + ' must match the signed wire label in the CSV');
    }
  }
  const sampleTag = mode === 'EXT' ? gateway + '.DALI1-DA+' : gateway + '.NET-24';
  const pageNumber = pdf.findIndex(text => text.includes(compact('到:' + sampleTag))) + 1;
  assert.ok(pageNumber > 0);
  execFileSync('pdftoppm', ['-f', String(pageNumber), '-l', String(pageNumber), '-r', '110', '-png',
    '-singlefile', pdfPath, dir + '/wiring-page']);

  await page.locator('#v5-docs-zip').click();
  const archiveDownload = page.waitForEvent('download');
  await page.locator('#v5-export-current').click();
  const bundlePath = dir + '/handover.zip';
  await (await archiveDownload).saveAs(bundlePath);
  const files = unzipSync(readFileSync(bundlePath));
  const csvBytes = Buffer.from(files['端子接线表.csv']);
  assert.ok(csvBytes.equals(readFileSync(dir + '/wiring-from-screen.csv')), 'Handover CSV and direct download must match byte for byte');
  writeFileSync(dir + '/wiring.csv', csvBytes);
  const design = JSON.parse(strFromU8(files['方案.json']));
  const mod = design.modules.find(item => item.id === gateway);
  assert.equal(mod.daliPowerMode, mode);
  for (const [index, source] of supplies.entries()) {
    assert.equal(mod.daliLoopSupplies?.[index + 1] ?? null, mode === 'EXT' ? source : null);
  }
  assert.ok(design.buses.some(bus => bus.type === 'dc' && bus.psuModuleIds.includes(controls) && bus.deviceModuleIds.includes(gateway)),
    'The DC control-source assignment remains independent of the switch and DALI loops');
  assert.equal(csv.filter(wire => [wire.from, wire.to].some(end => end.startsWith('GW2:'))).length, 0,
    'The isolated DIN-DLI test device receives no external DALI wires');
  return pageCount;
}

const browser = await chromium.launch({ channel: process.env.PDF_BROWSER || 'chrome', headless: true });
try {
  for (const mode of ['INT', 'EXT']) {
    const dir = outputDir + '/' + mode.toLowerCase();
    mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, acceptDownloads: true });
    context.setDefaultTimeout(20_000);
    // Keep each export on the loaded app version even when the dev server rebuilds.
    const hmr = new URL(baseUrl);
    hmr.protocol = hmr.protocol === 'https:' ? 'wss:' : 'ws:';
    await context.routeWebSocket(url => url.origin === hmr.origin && url.pathname === hmr.pathname, () => {});
    const page = await context.newPage();
    try {
      const errors = [];
      page.on('pageerror', err => {
        errors.push(err.message);
        console.error('Uncaught application error:', err.message);
      });
      await page.goto(baseUrl);
      await page.waitForFunction(() => window.__PANEL_STATE__);
      const designId = await importFixture(page, mode);
      await configure(page, mode);
      await verifyReopened(page, mode, designId);
      const expected = expectedWires(mode);
      const csv = await verifyScreen(page, expected, mode, dir);
      const a4Pages = await verifyDelivery(page, csv, mode, dir);
      assert.deepEqual(errors, [], 'Uncaught browser errors');
      console.log(JSON.stringify({ status: 'PASS', mode, gatewayWires: expected.length, allWires: csv.length, a4Pages, output: dir }));
    } catch (error) {
      const toast = await page.locator('#toast').textContent({timeout: 1000}).catch(() => '');
      const modal = await page.locator('#modal[open]').innerText({timeout: 1000}).catch(() => '');
      console.error(mode + ' acceptance failed.', toast, modal.slice(0, 380));
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
