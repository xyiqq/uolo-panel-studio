import { dash, esc, pageShell } from "./_util.js";

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
