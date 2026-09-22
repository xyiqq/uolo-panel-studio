import { dash, esc, pageShell } from "./_util.js";
import { productSku } from "../../core/domain.js";
import { qrSvg, circuitQrPayload, qrMode } from "../qr.js";
import { circuitModuleChannels, moduleDeliveryLinks } from "../module-delivery-links.js";

/** 箱门回路总表 */
export function renderDoorChart({ design, assembly, net, matches, labels } = {}) {
  const matchMap = matches || {};
  const hasQr = qrMode(design) === 'online';
  const rows = (design?.circuits || [])
    .map((c) => {
      const m = matchMap[c.id] || {};
      const node = (assembly?.nodes || []).find((n) => n.id === c.id);
      const product = m.product || node?.product;
      const sku = product ? productSku(product) : "—";
      const label = labels?.circuitLabel ? labels.circuitLabel(c) : `${c.id} ${c.name}`;
      const roomLoads = (design.loads || []).filter((l) =>
        (c.loadIds || []).includes(l.id),
      );
      const room = [...new Set(roomLoads.map(l => l.room || l.zone).filter(Boolean))].join('、');
      const payload = circuitQrPayload(
        design,
        {
          ...c,
          productName: product?.name || "",
          residual: product?.residual,
        },
        qrMode(design),
      );
      const qr = hasQr && payload ? qrSvg(payload, 112) : "";
      return (
        `<tr>` +
        `<td><strong>${esc(label)}</strong><br>房间：${esc(room || '未填写')}</td>` +
        `<td>${esc(sku)}${product?.amps != null ? `<br>额定电流：${esc(product.amps)} A` : ""}<br>相位：${esc(dash(c.phase))}</td>` +
        `<td style="overflow-wrap:anywhere">${esc(dash(circuitModuleChannels(design,c).map(d => `${d.moduleId} CH${d.channel}`).join(' / ') || c.moduleChannel))}</td>` +
        (hasQr ? `<td class="qr-cell">${qr}</td>` : '') +
        `</tr>`
      );
    });

  const table = part =>
    `<table class="doc-table">` +
    `<thead><tr>` +
    `<th>回路 / 用途 / 房间</th><th>保护开关 / 供电</th><th>控制设备 / 通道</th>${hasQr ? '<th style="width:30mm">扫码查阅</th>' : ''}` +
    `</tr></thead><tbody>${part.join('') || `<tr><td colspan="${hasQr ? 4 : 3}">暂无回路。配置供电回路后生成箱门索引。</td></tr>`}</tbody></table>` +
    (hasQr ? '' : '<p class="hint">本版未配置扫码页面，按回路编号查阅。</p>');

  const pages = [];
  for(let i=0;i<Math.max(rows.length,1);i+=24) {
    pages.push(pageShell("箱门回路总表", table(rows.slice(i,i+24)), "doc-door-chart", '查找房间或设备名称，即可找到对应回路。回路编号与箱内标签一致；CH 为控制通道号，L1 / L2 / L3 为供电相位，ABC 为三相。开关操作与检修请由专业人员确认。'));
  }
  const links = moduleDeliveryLinks(design,net);
  for(let i=0;i<links.length;i+=20) {
    const body = `<table class="doc-table" style="table-layout:fixed;width:100%;overflow-wrap:anywhere"><thead><tr><th>起点</th><th>终点</th><th>关联类型</th><th>接线说明</th></tr></thead><tbody>` +
      links.slice(i,i+20).map(r => `<tr><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${esc(r.kind)}</td><td>${esc(r.detail)}</td></tr>`).join('') + '</tbody></table>';
    pages.push(pageShell('箱门表 · 模块与端子链路',body,'doc-door-chart', '从起点找到控制设备，再沿终点查找接线端子或用电设备。关联关系来自方案记录，现场仍需逐一核对。'));
  }
  return pages.join('');
}
