import { dash, esc, pageShell } from "./_util.js";
import { productSku } from "../../core/domain.js";
const number = (v, scale = 1) => v == null || v === '' || !Number.isFinite(Number(v)) ? '—' : (Number(v) / scale).toFixed(2);
export function renderCircuitTable({ design, assembly, matches } = {}) {
  const rows = (design?.circuits || []).map(c => {
    const m = matches?.[c.id] || {};
    const product = m.product || assembly?.nodes?.find(n => n.id === c.id)?.product;
    return `<tr>
      <td><strong>${esc(c.id)}</strong><br>${esc(c.name)}</td>
      <td>${esc(product ? productSku(product) : '—')}<br>供电相位：${esc(dash(c.phase))}</td>
      <td>计算电流：${number(m.ib)} A<br>设备功率：${number(m.p, 1000)} kW</td>
      <td>截面积：${esc(dash(m.section))} mm²<br>电缆：${esc(dash(m.cable))}</td>
      <td>长度：${esc(dash(c.length))} m<br>电压下降：${number(m.drop)} %</td>
    </tr>`;
  }).join('');
  return pageShell('回路计算表', `<table class="doc-table"><thead><tr><th>回路 / 用途</th><th>保护开关 / 供电</th><th>用电需求</th><th>电线选型</th><th>线路情况</th></tr></thead><tbody>${rows || '<tr><td colspan="5">暂无回路。添加用电回路后生成计算数据。</td></tr>'}</tbody></table>`, 'doc-circuit-table',
    '每行是一组独立供电线路（回路）。先看用途，再核对保护开关与电线；A 表示安培，kW 表示千瓦，mm² 表示导线截面积。L1 / L2 / L3 为供电相位，ABC 为三相。— 表示未提供数据，计算结果需专业人员复核。');
}
