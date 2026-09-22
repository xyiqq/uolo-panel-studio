import { dash, esc, pageShell } from "./_util.js";
import { normalizeLabelSheet } from '../../core/labels.js';

/** Each physical sheet is a separate document page, including a partially filled last sheet. */
export function renderLabelPaperPages(ctx = {}) {
  const sheet = normalizeLabelSheet(ctx.design?.labelSheet);
  if (sheet.preset === 'module') return null;
  const circuits = ctx.design?.circuits || [];
  const pages = [];
  for (let start = 0; start < Math.max(1, circuits.length); start += sheet.capacity) {
    const cards = Array.from({ length: sheet.capacity }, (_, i) => {
      const c = circuits[start + i];
      const face = c ? ctx.labels?.faceLabel?.(c) || c.id : '';
      const name = c ? ctx.labels?.circuitLabel?.(c) || c.name || '' : '';
      const widthPx = (sheet.widthMm - 2.3) * 96 / 25.4, heightPx = (sheet.heightMm - 2.3) * 96 / 25.4;
      let fontSize = 12;
      const lines = (text, size) => Math.max(1, Math.ceil([...String(text)].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 255 ? 1 : 0.65), 0) * size / widthPx));
      while (fontSize > 8 && (lines(face, fontSize) + lines(name, fontSize)) * fontSize * 1.3 > heightPx) fontSize -= 0.5;
      const tooLong = c && (lines(face, fontSize) + lines(name, fontSize)) * fontSize * 1.3 > heightPx;
      const content = tooLong ? '<strong style="color:#a00">文字过长：请扩大格子或缩短标签</strong>' : `<strong>${esc(face)}</strong><span>${esc(name)}</span>`;
      return `<div class="paper-label${tooLong ? ' paper-label-overflow' : ''}" title="${esc(tooLong ? `${face} ${name}` : '')}" style="box-sizing:border-box;border:0.15mm dashed #aaa;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1mm;min-width:0;min-height:0;font-size:${fontSize}px;line-height:1.3;overflow-wrap:anywhere;word-break:break-all;text-align:center">${c ? content : ''}</div>`;
    }).join('');
    const html = `<article class="doc-page doc-labels-sheet--paper" style="box-sizing:border-box;width:210mm;height:297mm;padding:${sheet.marginTop}mm ${sheet.marginRight}mm ${sheet.marginBottom}mm ${sheet.marginLeft}mm"><div class="paper-label-grid" style="display:grid;grid-template-columns:repeat(${sheet.columns},${sheet.widthMm}mm);grid-template-rows:repeat(${sheet.rows},${sheet.heightMm}mm);column-gap:${sheet.gapX}mm;row-gap:${sheet.gapY}mm">${cards}</div></article>`;
    pages.push({ id: start === 0 ? 'labels-sheet' : `labels-sheet-${pages.length + 1}`, title: `A4 标签纸 · ${sheet.rows}×${sheet.columns} · 第 ${pages.length + 1} 页`, html, pageSize: 'A4-labels' });
  }
  return pages;
}

/**
 * 面标页 + PT-D210 录入清单
 * 按 18 mm 模位宽排版（示意）
 */
export function renderLabelsSheet({ design, assembly, labels } = {}) {
  const circuits = design?.circuits || [];
  const cards = circuits
    .map((c) => {
      const node = (assembly?.nodes || []).find((n) => n.id === c.id);
      const modules = node?.product?.modules || 1;
      const widthMm = Math.max(18, Number(modules) * 18);
      const face = labels?.faceLabel
        ? labels.faceLabel(node || { id: c.id, label: c.name })
        : c.id;
      const line2 = labels?.circuitLabel ? labels.circuitLabel(c) : c.name;
      return (
        `<div class="face-label" style="width:${widthMm}mm" data-circuit="${esc(c.id)}">` +
        `<div class="face-cut"></div>` +
        `<div class="face-id">${esc(face)}</div>` +
        `<div class="face-name">${esc(line2)}</div>` +
        `</div>`
      );
    })
    .join("");

  const ptLines = circuits.map((c) => {
    const node = (assembly?.nodes || []).find((n) => n.id === c.id);
    const face = labels?.faceLabel
      ? labels.faceLabel(node || { id: c.id })
      : c.id;
    const name = c.name || "";
    return `${face}\t${name}\t${c.phase || ""}`;
  });

  const body =
    `<section class="face-sheet"><h2>面标（剪裁线示意）</h2>` +
    `<div class="face-grid">${cards}</div></section>` +
    `<section class="pt-d210"><h2>PT-D210 录入清单</h2>` +
    `<p class="hint">格式：标签 · 行1 · 行2（制表符分隔，可复制到 Brother P-touch Editor）</p>` +
    `<pre class="pt-list">${esc(ptLines.join("\n") || "（无回路）")}</pre>` +
    `<p class="hint">方案：${esc(dash(design?.name))}</p></section>`;

  return pageShell("面标与 PT-D210 清单", body, "doc-labels-sheet");
}
