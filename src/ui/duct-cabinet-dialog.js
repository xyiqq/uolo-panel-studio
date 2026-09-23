import {DUCT_STANDARD, makeDuctCabinet, suggestDuctRows} from '../data/cabinets/uolo.js';
import {validateCustomCabinet} from '../core/domain.js';
import {escapeHtml as esc} from '../core/escape.js';

const FIELDS = [
  ['innerWidth', '内部宽', 630, 'mm'],
  ['innerHeight', '内部高', 1100, 'mm'],
  ['rows', '导轨排数', '', '排（留空自动）'],
  ['sideMargin', '左右边距', DUCT_STANDARD.sideMargin, 'mm'],
  ['endMargin', '上下边距', DUCT_STANDARD.endMargin, 'mm'],
  ['depth', '箱体深度', DUCT_STANDARD.depth, 'mm'],
  ['ductDepth', '线槽深度', DUCT_STANDARD.ductDepth, 'mm'],
];

const field = ([key, label, value, unit]) =>
  `<label class="field"><span>${esc(label)}</span><div class="unit"><input id="duct-${key}" type="number" step="any" value="${esc(value)}"><em>${esc(unit)}</em></div></label>`;

/** Custom cabinet following the 优诺 (UOLO) duct standard; inner size, rows and margins are user-controlled. */
export function openDuctCabinetDialog({open, close, commit, toast, query = s => document.querySelector(s)}) {
  open('优诺线槽标准箱体', `
    <p>按优诺主图标准生成：四周及每两排之间 ${DUCT_STANDARD.ductWidth} mm 线槽，导轨居中于安装区；外形 = 内部 + 边距。</p>
    <div class="field-grid">${FIELDS.map(field).join('')}</div>
    <label class="field"><span>安装方式</span><select id="duct-mount"><option value="明装">明装</option><option value="暗装">暗装</option></select></label>
    <p class="lib-preview" id="duct-preview" role="status"></p>
    <button class="btn primary" id="duct-save">生成并切换</button>`);
  const read = () => {
    const spec = Object.fromEntries(FIELDS.map(([key]) => [key, query(`#duct-${key}`).value.trim()]).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
    return {...spec, mount: query('#duct-mount').value};
  };
  const build = () => {
    const spec = read();
    const cab = makeDuctCabinet(spec);
    return validateCustomCabinet({...cab, id: 'USR-CAB-preview', brand: '自定义', custom: true,
      name: `优诺标准 ${cab.width}×${cab.height} · ${cab.rows} 排 · ${cab.mount}`});
  };
  const preview = () => {
    const out = query('#duct-preview'), save = query('#duct-save');
    try {
      const cab = build(), d = cab.wireDucts, auto = suggestDuctRows(cab.height);
      out.textContent = `外形 ${cab.outer.join('×')} mm · 内部 ${cab.width}×${cab.height}×${cab.depth} mm · ${cab.rows} 排${read().rows ? `（标准建议 ${auto} 排）` : '（自动）'} · 每排 ${cab.slots}P · 安装区 ${d.zoneWidth}×${d.zoneHeight.toFixed(1)} mm · 排距 ${cab.pitch.toFixed(1)} mm`;
      out.classList.remove('error');save.disabled = false;
    } catch (err) {
      out.textContent = /自定义箱体参数不合法/.test(err.message) ? '尺寸超出自定义箱体范围：内部宽 ≤ 944 mm（每排不超过 48P）、高 ≤ 2500 mm、深 60–300 mm、排数 ≤ 12' : err.message;
      out.classList.add('error');save.disabled = true;
    }
  };
  for (const [key] of FIELDS) query(`#duct-${key}`).addEventListener('input', preview);
  query('#duct-mount').addEventListener('change', preview);
  preview();
  query('#duct-save').onclick = () => {
    try {
      const cab = {...build(), id: 'USR-CAB-' + crypto.randomUUID()};
      close();
      commit(d => {
        d.customCabinets = Array.isArray(d.customCabinets) ? d.customCabinets : [];
        d.customCabinets.push(cab);
        d.cabinet = cab.id;
        d.circuits.forEach(c => c.position = null);
      }, true);
      toast(`已生成并切换：${cab.name}`);
    } catch (err) { toast(err.message); }
  };
}
