/**
 * V5 UI 桥接：空间面板、文档中心、产品库扩展入口。
 * 挂在现有 shell 上，不重写 V4 app.js。
 *
 * 注意：mountV5Bridge 会在每次 renderAll 调用，所有注入与事件绑定必须幂等。
 */
import { allCabinets, makeGenericCabinet } from "../data/cabinets/index.js";
import { SMART_PRODUCTS } from "../data/products/smart-index.js";
import { computeSpace } from "../core/space.js";
import { buildDocumentPack } from "../view/documents/index.js";
import { buildBom } from "../core/bom.js";
import {buildDeliveryNet} from '../core/delivery-net.js';
import { applyLabelRules, normalizeLabelSheet } from "../core/labels.js";
import { buildHandoverZip } from "../core/pack.js";
import { buildHandoverFiles } from "../core/handover.js";
import { buildPtouchRows, ptouchCsv, renderFaceLabelsSvg } from "../view/documents/ptouch.js";
import { setChecklistItem } from "../core/checklist-spec.js";
import {
  addRevision,
  revisionLabel,
  setSignoff,
  signoffSummary,
  SIGNOFF_ROLES,
  SIGNOFF_ROLE_LABELS,
} from "../core/revisions.js";
import { matchCircuit } from "../core/domain.js";
import { zipSync, strToU8 } from "fflate";
import "../styles/documents.css";
import documentCss from "../styles/documents.css?raw";
import {projectQrUrl} from '../view/qr.js';
import {paginateDocumentPages} from '../view/documents/paginate.js';

const DISCLAIMER = "条件性方案 · 非施工合格结论";

function $(sel, root = document) {
  return root.querySelector(sel);
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** 文档中心跨渲染保留的状态 */
const docState = {
  open: false,
  selected: null, // Set<pageId>，null = 全选
  bound: false,
};

/**
 * @param {{
 *   getDesign: () => any, getAssembly: () => any, getNet: () => any,
 *   getIssues: () => any[], toast?: (m:string)=>void,
 *   persist?: () => void, refresh?: () => void,
 *   selectCircuit?: (id:string)=>void, screenshot?: () => string|null,
 *   standaloneHtml?: () => string,
 * }} api
 */
export function mountV5Bridge(api) {
  injectStyles();
  injectTabs();
  injectSpacePanel(api);
  wireDocumentCenter(api);
  // 箱体下拉由 app.js fillCabinetSelect 统一填充（玛德克/通用/自定义），此处不再追加以免被 Y1 冲掉
  exposeSmartProducts();
  // 供 app.js 导出对话框调用
  window.__V5_DOCS__ = {
    prepare: action => prepareDelivery(api, action),
    open: () => openDocs(api),
    zip: () => prepareDelivery(api, () => downloadZip(api)),
    print: () => prepareDelivery(api, () => doPrint(api)),
  };
  if (docState.open) renderDocs(api);
}

function injectStyles() {
  if ($("#v5-bridge-css")) return;
  const s = document.createElement("style");
  s.id = "v5-bridge-css";
  s.textContent = `
  .v5-space{margin-top:10px;padding:10px;border:1px solid #2a3a30;border-radius:8px;background:#141c16;font-size:12px;color:#b7c6bb}
  .v5-space h3{margin:0 0 8px;font-size:12px;letter-spacing:.04em;color:#d5e4d8}
  .v5-space .row{display:flex;justify-content:space-between;gap:8px;margin:4px 0}
  .v5-space select,.v5-space input[type=range]{width:100%;margin-top:6px}
  .v5-rec{max-height:120px;overflow:auto;margin-top:6px}
  .v5-rec button{display:block;width:100%;text-align:left;margin:3px 0;padding:6px 8px;background:#1b2620;border:1px solid #314239;color:#cfe0d4;border-radius:6px;cursor:pointer;font-size:11px}
  .v5-rec button:hover{border-color:#5a8f72}
  #v5-docs-panel{display:none;position:absolute;inset:0;z-index:5;background:#0f1511;overflow:auto;padding:16px}
  #v5-docs-panel.open{display:block}
  .v5-docs-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center}
  .v5-docs-toolbar .btn{font-size:12px}
  .v5-docs-toolbar select{background:#1b2620;border:1px solid #314239;color:#cfe0d4;border-radius:6px;padding:5px 8px;font-size:12px}
  .v5-docs-layout{display:grid;grid-template-columns:230px 1fr;gap:12px;min-height:60vh;align-items:start}
  .v5-docs-nav{position:sticky;top:0;background:#141c16;border:1px solid #2a3a30;border-radius:8px;padding:10px}
  .v5-docs-nav h4{margin:0 0 6px;font-size:11px;color:#9fb3a5;letter-spacing:.06em}
  .v5-docs-nav label{display:flex;gap:6px;align-items:flex-start;margin:5px 0;font-size:12px;color:#c5d4c9;cursor:pointer}
  .v5-docs-nav .nav-actions{display:flex;gap:6px;margin-bottom:8px}
  .v5-docs-nav .nav-actions button{flex:1;font-size:11px;padding:4px;background:#1b2620;border:1px solid #314239;color:#cfe0d4;border-radius:5px;cursor:pointer}
  .v5-badge{display:inline-block;padding:1px 6px;border-radius:4px;background:#5a3d12;color:#ffd89a;font-size:10px;margin-left:6px}
  .v5-rev{font-size:11px;color:#9fb3a5;margin-left:auto}
  #v5-print-root{display:none}
  dialog.v5-dialog{border:1px solid #2a3a30;background:#141c16;color:#cfe0d4;border-radius:10px;padding:0;width:min(520px,92vw)}
  dialog.v5-dialog::backdrop{background:rgba(0,0,0,.55)}
  dialog.v5-dialog .dlg-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #2a3a30}
  dialog.v5-dialog .dlg-head h3{margin:0;font-size:14px}
  dialog.v5-dialog .dlg-body{padding:14px;font-size:12px;max-height:70vh;overflow:auto}
  dialog.v5-dialog label{display:block;margin:8px 0;font-size:12px;color:#a9bcae}
  dialog.v5-dialog input,dialog.v5-dialog select,dialog.v5-dialog textarea{width:100%;margin-top:4px;background:#0f1511;border:1px solid #314239;color:#e3ece5;border-radius:5px;padding:6px 8px;font:inherit;box-sizing:border-box}
  dialog.v5-dialog .dlg-foot{display:flex;gap:8px;justify-content:flex-end;padding:0 14px 14px}
  dialog.v5-dialog button{background:#1b2620;border:1px solid #314239;color:#cfe0d4;border-radius:6px;padding:6px 12px;cursor:pointer;font:inherit}
  dialog.v5-dialog button.primary{background:#2f6a4c;border-color:#3d8a63;color:#eaf6ee}
  dialog.v5-dialog .tip{font-size:11px;color:#8ba295;margin:4px 0 10px}
  `;
  document.head.appendChild(s);
}

function injectTabs() {
  const tabRow = document.querySelector("nav.nav") || document.querySelector(".work nav");
  if (!tabRow) return;

  if (!$("#tab-documents")) {
    const btn = document.createElement("button");
    btn.id = "tab-documents";
    btn.type = "button";
    btn.dataset.tab = "documents";
    btn.textContent = "文档中心";
    btn.title = "系统图 · 标签 · 打印导出 · 交底包";
    const auditBtn = [...tabRow.querySelectorAll("button")].find((b) =>
      /校核/.test(b.textContent || ""),
    );
    if (auditBtn) tabRow.insertBefore(btn, auditBtn);
    else tabRow.appendChild(btn);
  }

  // 文档面板挂在 .canvas-wrap，禁止改 #canvas 的 position（否则 WebGL 宿主变 relative 只剩半高）
  const host = $("#canvas");
  if (host) {
    host.style.removeProperty("position");
    host.style.removeProperty("visibility");
  }
  const mount = document.querySelector(".canvas-wrap") || document.querySelector(".work");
  if (mount && !$("#v5-docs-panel")) {
    const panel = document.createElement("div");
    panel.id = "v5-docs-panel";
    panel.innerHTML = `
      <div class="v5-docs-toolbar">
        <strong>文档中心</strong>
        <span class="v5-badge">${DISCLAIMER}</span>
        <button type="button" class="btn" id="v5-docs-print">打印 / 另存 PDF</button>
        <button type="button" class="btn" id="v5-docs-svg">下载 SVG</button>
        <button type="button" class="btn" id="v5-docs-png">下载 PNG</button>
        <button type="button" class="btn" id="v5-docs-ptouch">标签 CSV</button>
        <button type="button" class="btn" id="v5-docs-zip">交底包 ZIP</button>
        <button type="button" class="btn" id="v5-docs-settings">文档设置</button>
        <button type="button" class="btn" id="v5-docs-signoff">修订与签认</button>
        <button type="button" class="btn" id="v5-docs-close">返回装配</button>
        <select id="v5-docs-zoom" title="预览缩放（不影响打印）">
          <option value="fit">适应宽度</option>
          <option value="1">100%</option>
          <option value="0.75">75%</option>
          <option value="0.5">50%</option>
        </select>
        <span class="v5-rev" id="v5-docs-rev"></span>
      </div>
      <div class="v5-docs-layout">
        <div class="v5-docs-nav">
          <h4>页面</h4>
          <div class="nav-actions">
            <button type="button" id="v5-docs-all">全选</button>
            <button type="button" id="v5-docs-none">全不选</button>
          </div>
          <div id="v5-docs-nav"></div>
        </div>
        <div class="v5-docs-preview" id="v5-docs-preview"></div>
      </div>`;
    mount.appendChild(panel);
  }

  if (!$("#v5-print-root")) {
    const pr = document.createElement("div");
    pr.id = "v5-print-root";
    document.body.appendChild(pr);
  }
}

function injectSpacePanel(api) {
  const left = $(".left .side-section") || $(".left");
  if (!left || $("#v5-space")) return;
  const box = document.createElement("div");
  box.className = "v5-space";
  box.id = "v5-space";
  box.innerHTML = `
    <h3>空间与箱体</h3>
    <div class="row"><span>强电模位</span><b id="v5-m-power">—</b></div>
    <div class="row"><span>弱电/控制</span><b id="v5-m-ctrl">—</b></div>
    <div class="row"><span>需排数(含备用)</span><b id="v5-rows">—</b></div>
    <div class="row"><span>宽度待核</span><b id="v5-unk">—</b></div>
    <label>备用比例 <span id="v5-spare-val">25%</span>
      <input id="v5-spare" type="range" min="0" max="50" step="5" value="${Math.round((api.getDesign().spareRatio ?? .25)*100)}">
    </label>
    <div class="tiny" id="v5-space-msg" style="margin-top:6px;opacity:.85"></div>
    <div class="v5-rec" id="v5-rec"></div>
  `;
  const capacity = $("#capacity")?.closest(".side-section") || left;
  capacity.appendChild(box);

  const refresh = () => {
    try {
      const design = api.getDesign();
      const assembly = api.getAssembly();
      if (!design || !assembly) return;
      $("#v5-spare").value = Math.round((design.spareRatio ?? .25) * 100);
      $("#v5-spare-val").textContent = $("#v5-spare").value + "%";
      const cabinets = allCabinets(design);
      const space = computeSpace(design, assembly, cabinets);
      $("#v5-m-power").textContent = String(space.modulesPower);
      $("#v5-m-ctrl").textContent = String(space.modulesControl);
      $("#v5-rows").textContent = String(space.rowsNeeded);
      $("#v5-unk").textContent = String(space.unknownWidth);
      $("#v5-space-msg").textContent = space.recommendationText || "";
      const rec = $("#v5-rec");
      rec.innerHTML = "";
      (space.recommendations || []).slice(0, 8).forEach((row) => {
        const c = row.cabinet || row;
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = `${c.name} · ${c.rows}×${c.slots}P${c.estimated ? " · 估算" : ""}${row.fits ? "" : " · 不足"}`;
        b.onclick = () => {
          const sel = $("#cabinet");
          if (sel) {
            if (![...sel.options].some((o) => o.value === c.id)) {
              const opt = document.createElement("option");
              opt.value = c.id;
              opt.textContent = c.name;
              sel.appendChild(opt);
            }
            sel.value = c.id;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
          api.toast?.(`已切换箱体建议：${c.name}`);
        };
        rec.appendChild(b);
      });
    } catch (e) {
      $("#v5-space-msg").textContent = "空间计算暂不可用：" + (e?.message || e);
    }
  };

  $("#v5-spare")?.addEventListener("input", () => {
    api.getDesign().spareRatio = Number($("#v5-spare").value) / 100;
    api.persist?.();
    refresh();
  });
  // periodic light refresh
  setInterval(refresh, 1500);
  refresh();
  api._refreshSpace = refresh;
}

function exposeSmartProducts() {
  window.__PANEL_SMART_PRODUCTS__ = SMART_PRODUCTS;
}

/* ===================== 文档中心 ===================== */

function openDocs(api) {
  const panel = $("#v5-docs-panel");
  if (!panel) return;
  docState.open = true;
  panel.classList.add("open");
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.classList.toggle("active", b.id === "tab-documents");
  });
  renderDocs(api);
}

function closeDocs() {
  docState.open = false;
  $("#v5-docs-panel")?.classList.remove("open");
  $("#tab-documents")?.classList.remove("active");
}

function wireDocumentCenter(api) {
  if (docState.bound) return;
  docState.bound = true;

  $("#tab-documents")?.addEventListener(
    "click",
    (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
      openDocs(api);
    },
    true,
  );

  // 切到其它页签时收起文档面板（app.js 的 rs() 不认识 documents）
  document.querySelectorAll("[data-tab]").forEach((b) => {
    if (b.id === "tab-documents") return;
    b.addEventListener("click", () => closeDocs(), true);
  });

  $("#v5-docs-close")?.addEventListener("click", () => {
    closeDocs();
    document.querySelector('[data-tab="assembly"]')?.click();
  });

  $("#v5-docs-all")?.addEventListener("click", () => {
    docState.selected = null;
    renderDocs(api);
  });
  $("#v5-docs-none")?.addEventListener("click", () => {
    docState.selected = new Set();
    renderDocs(api);
  });

  $("#v5-docs-zoom")?.addEventListener("change", applyPreviewZoom);
  window.addEventListener("resize", () => {
    if (docState.open) applyPreviewZoom();
  });

  for (const [id, action] of Object.entries({print:doPrint,svg:downloadSvgPages,png:downloadPngPages,ptouch:downloadPtouch,zip:downloadZip})) {
    $(`#v5-docs-${id}`)?.addEventListener("click", () => prepareDelivery(api, () => action(api)));
  }
  $("#v5-docs-settings")?.addEventListener("click", () => openDocSettings(api));
  $("#v5-docs-signoff")?.addEventListener("click", () => openSignoffDialog(api));
}

function buildMatches(design) {
  const map = {};
  for (const c of design?.circuits || []) {
    try {
      map[c.id] = matchCircuit(design, c);
    } catch {
      /* 选型失败的回路留空，系统图按缺省占位 */
    }
  }
  return map;
}

function collectPack(api, { interactive = false } = {}) {
  const design = structuredClone(api.getDesign());
  const assembly = structuredClone(api.getAssembly());
  const net = buildDeliveryNet(design,assembly,structuredClone(api.getNet()));
  const issues = [...structuredClone(api.getIssues?.() || []),...net.wiringIssues];
  const bom = buildBom(design, assembly, net);
  const labels = applyLabelRules(design, net);
  const matches = buildMatches(design);
  let cabinetImage=null;
  try {cabinetImage=api.cabinetImage?.()||null;} catch(error) {console.warn('配电箱三维图片生成失败',error);}
  const pack = buildDocumentPack({
    design,
    assembly,
    net,
    issues,
    bom,
    labels,
    matches,
    interactive,
    cabinetImage,
    uiMode: design?.uiMode || api.uiMode?.() || "simple",
  });
  return { ...pack,pages:paginateDocumentPages(pack.pages,pack.metadata), design, assembly, net, issues, bom, labels, matches };
}

function selectedPages(pack) {
  const pages = docState.selected ? pack.pages.filter((p) => docState.selected.has(p.id)) : pack.pages;
  return pages.map((page,index)=>({...page,html:page.html?.replace(/第 \d+ \/ \d+ 页/g,`第 ${index+1} / ${pages.length} 页`)}));
}

function renderDocs(api) {
  let pack;
  try {
    pack = collectPack(api, { interactive: true });
  } catch (e) {
    const preview = $("#v5-docs-preview");
    if (preview) preview.innerHTML = `<p style="padding:20px">文档生成失败：${esc(e?.message || e)}</p>`;
    return;
  }
  const nav = $("#v5-docs-nav");
  const preview = $("#v5-docs-preview");
  if (!nav || !preview) return;

  const isOn = (id) => !docState.selected || docState.selected.has(id);

  nav.innerHTML = pack.pages
    .map(
      (p) =>
        `<label><input type="checkbox" data-doc="${esc(p.id)}" ${isOn(p.id) ? "checked" : ""}>` +
        `<span>${esc(p.title)}<br><small style="opacity:.6">${esc(p.pageSize)}</small></span></label>`,
    )
    .join("");

  $("#v5-docs-rev").textContent = `${revisionLabel(pack.design)} · ${signoffSummary(pack.design)}`;

  // 只重绘预览，不重建左侧勾选列表（避免每次勾选丢焦点）
  const paint = () => {
    preview.innerHTML = selectedPages(pack)
      .map(
        (p) =>
          `<p class="v5-doc-caption">${esc(p.title)}</p>` +
          `<section class="v5-doc-sheet" data-size="${esc(p.pageSize || "A4")}" data-page="${esc(p.id)}">${
            p.html || p.svg || ""
          }</section>`,
      )
      .join("");
    wirePreviewInteractions(api, preview);
    applyPreviewZoom();
  };

  nav.onchange = (ev) => {
    const t = ev.target;
    if (!t?.dataset?.doc) return;
    if (!docState.selected) docState.selected = new Set(pack.pages.map((p) => p.id));
    if (t.checked) docState.selected.add(t.dataset.doc);
    else docState.selected.delete(t.dataset.doc);
    paint();
  };

  paint();
}

/** 预览缩放（只影响屏幕，打印仍按 @page 实际尺寸） */
function applyPreviewZoom() {
  const preview = $("#v5-docs-preview");
  const mode = $("#v5-docs-zoom")?.value || "fit";
  if (!preview) return;
  const avail = preview.clientWidth - 32;
  const WIDTH_MM = {
    A4: 210,
    "A4-landscape": 297,
    "A3-landscape": 420,
    "90x60mm": 120,
  };
  preview.querySelectorAll(".v5-doc-sheet").forEach((sheet) => {
    const natural = (WIDTH_MM[sheet.dataset.size] || 210) * 3.7795;
    const z = mode === "fit" ? Math.min(1, avail / natural) : Number(mode);
    sheet.style.zoom = z;
  });
}

function wirePreviewInteractions(api, preview) {
  // 系统图点击列 → 选中回路并回到装配
  preview.querySelectorAll("svg [data-circuit]").forEach((g) => {
    g.style.cursor = "pointer";
    g.addEventListener("click", () => {
      const id = g.getAttribute("data-circuit");
      if (!id) return;
      closeDocs();
      document.querySelector('[data-tab="assembly"]')?.click();
      api.selectCircuit?.(id);
      api.toast?.(`已选中回路 ${id}`);
    });
  });

  // 检查单勾选 / 记录值
  const write = (itemId, patch) => {
    const design = api.getDesign();
    design.checklist = setChecklistItem(design.checklist, itemId, patch);
    api.persist?.();
  };
  preview.querySelectorAll("input[data-check]").forEach((cb) => {
    cb.addEventListener("change", () => write(cb.dataset.check, { checked: cb.checked }));
  });
  preview.querySelectorAll("input[data-check-value]").forEach((inp) => {
    inp.addEventListener("change", () =>
      write(inp.dataset.checkValue, { value: inp.value }),
    );
  });
}

/* ---------- 打印 ---------- */

async function doPrint(api) {
  const pack = collectPack(api, { interactive: false });
  const pages = selectedPages(pack);
  if (!pages.length) return api.toast?.("请先勾选要打印的页面");
  const root = $("#v5-print-root");
  if (!root) return;
  root.innerHTML = pages
    .map(
      (p) =>
        `<section class="print-sheet" data-size="${esc(p.pageSize || "A4")}">${p.html || p.svg || ""}</section>`,
    )
    .join("");
  try {
    const images=[...root.querySelectorAll('img')];
    if(images.length)await Promise.all(images.map(image=>image.decode()));
  } catch {
    root.innerHTML='';
    return api.toast?.('图片无法载入，请重新上传现场照片或重新生成三维图后再导出');
  }
  const cleanup = () => {
    root.innerHTML = "";
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

/* ---------- 下载 ---------- */

function downloadSvgPages(api) {
  const pack = collectPack(api);
  const pages = selectedPages(pack).filter((p) => p.svg);
  const faces = renderFaceLabelsSvg(pack);
  if (!pages.length) {
    downloadBlob(new Blob([faces], { type: "image/svg+xml" }), "面标.svg");
    return api.toast?.("所选页面无矢量图，已导出面标 SVG");
  }
  if (pages.length === 1) {
    downloadBlob(new Blob([pages[0].svg], { type: "image/svg+xml" }), `${pages[0].id}.svg`);
    return api.toast?.("已下载 SVG");
  }
  const files = {};
  pages.forEach((p, i) => {
    files[`${String(i + 1).padStart(2, "0")}-${p.id}.svg`] = strToU8(p.svg);
  });
  files["面标.svg"] = strToU8(faces);
  downloadBlob(new Blob([zipSync(files)], { type: "application/zip" }), "系统图SVG.zip");
  api.toast?.(`已打包 ${pages.length} 页 SVG`);
}

/** SVG 字符串 → PNG Blob（2 倍位图） */
function svgToPng(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const m = /width="([\d.]+)"[^>]*height="([\d.]+)"/.exec(svg);
    const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    const w = Number(m?.[1] || vb?.[1] || 1200);
    const h = Number(m?.[2] || vb?.[2] || 800);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("画布导出失败"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG 光栅化失败"));
    };
    img.src = url;
  });
}

async function downloadPngPages(api) {
  try {
    const pack = collectPack(api);
    const svgPages = selectedPages(pack).filter((p) => p.svg);
    const jobs = [
      ...svgPages.map((p) => ({ name: `${p.id}.png`, svg: p.svg })),
      { name: "面标.png", svg: renderFaceLabelsSvg(pack) },
    ];
    const blobs = [];
    for (const j of jobs) {
      blobs.push({ name: j.name, blob: await svgToPng(j.svg) });
    }
    if (blobs.length === 1) {
      downloadBlob(blobs[0].blob, blobs[0].name);
    } else {
      const files = {};
      for (const b of blobs) {
        files[b.name] = new Uint8Array(await b.blob.arrayBuffer());
      }
      downloadBlob(new Blob([zipSync(files)], { type: "application/zip" }), "标签与系统图PNG.zip");
    }
    api.toast?.(`已导出 ${blobs.length} 张 PNG`);
  } catch (e) {
    api.toast?.("PNG 导出失败：" + (e?.message || e));
  }
}

function downloadPtouch(api) {
  const pack = collectPack(api);
  const rows = buildPtouchRows(pack);
  downloadBlob(
    new Blob([ptouchCsv(rows)], { type: "text/csv;charset=utf-8" }),
    "标签数据-PtouchEditor.csv",
  );
  api.toast?.(`已导出 ${Math.max(0, rows.length - 1)} 条标签数据`);
}

async function downloadZip(api) {
  try {
    const pack = collectPack(api, { interactive: false });
    const design = pack.design;
    const shot = api.screenshot?.();
    const files = buildHandoverFiles({
      design,
      net: pack.net,
      issues: pack.issues,
      bom: pack.bom,
      labels: pack.labels,
      pages: pack.pages,
      standaloneHtml: await api.standaloneHtml?.(design),
      documentCss,
    });
    const bin = {};
    for (const [name, text] of Object.entries(files)) bin[name] = strToU8(text);

    // 标签 PNG + 三维快照 PNG
    try {
      const facePng = await svgToPng(renderFaceLabelsSvg(pack));
      bin["标签/面标.png"] = new Uint8Array(await facePng.arrayBuffer());
    } catch {
      /* 光栅化不可用时跳过，不阻断打包 */
    }
    if (typeof shot === "string" && shot.startsWith("data:image/png;base64,")) {
      bin["三维快照.png"] = base64ToBytes(shot.slice("data:image/png;base64,".length));
    }

    const zipped = buildHandoverZip(bin);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(
      new Blob([zipped], { type: "application/zip" }),
      `${design?.name || "配电方案"}-交底包-${stamp}.zip`,
    );
    api.toast?.(`交底包已下载 · ${Object.keys(bin).length} 个文件`);
  } catch (e) {
    api.toast?.("ZIP 失败：" + (e?.message || e));
  }
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- 对话框 ---------- */

function today() {
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function revisionDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)!==value) throw new Error('请填写有效日期');
  return `${value}T12:00:00`;
}

function prepareDelivery(api, action) {
  const design=api.getDesign(),pack=collectPack(api);
  if(pack.pages.some(page=>page.html?.includes('data-layout-overflow="true"'))) {
    api.toast?.('有单条内容超过一页，请缩短过长备注后再导出；文档预览中可检查该条记录');return;
  }
  if(pack.pages.some(page=>page.html?.includes('paper-label-overflow'))) {
    api.toast?.('标签文字超出格子，请在文档设置扩大格子或缩短标签后再导出');return;
  }
  const dlg=dialog('交付前记录',`
    <p>当前 ${esc(revisionLabel(design))}。本次输出的图纸、封面与交底包使用同一修订。</p>
    <label>修订摘要<textarea id="v5-export-summary" rows="2" placeholder="填写本次交付变更"></textarea></label>
    <label>修订日期<input type="date" id="v5-export-date" value="${today()}"></label>
    <p id="v5-export-error" role="alert"></p>`,
    `<button id="v5-export-cancel">取消</button><button id="v5-export-current" ${design.revisions?.length?'':'disabled'}>使用当前修订</button><button id="v5-export-new" class="primary">记录修订并继续</button>`);
  const run=()=>{dlg.close();renderDocs(api);Promise.resolve().then(action).catch(e=>api.toast?.(`交付失败：${e.message}`));};
  $('#v5-export-cancel',dlg).onclick=()=>dlg.close();
  $('#v5-export-current',dlg).onclick=run;
  $('#v5-export-new',dlg).onclick=()=>{
    try {
      const summary=$('#v5-export-summary',dlg).value.trim();
      if(!summary) throw new Error('请填写修订摘要');
      addRevision(design,summary,{errors:pack.issues.filter(i=>i.level==='error').length,pending:pack.issues.filter(i=>i.level!=='error').length},revisionDate($('#v5-export-date',dlg).value));
      api.persist?.();run();
    } catch(e) {$('#v5-export-error',dlg).textContent=e.message;}
  };
}

function dialog(title, bodyHtml, footHtml = "") {
  let dlg = $("#v5-dialog");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "v5-dialog";
    dlg.className = "v5-dialog";
    document.body.appendChild(dlg);
  }
  dlg.innerHTML =
    `<div class="dlg-head"><h3>${esc(title)}</h3><button type="button" id="v5-dlg-x">✕</button></div>` +
    `<div class="dlg-body">${bodyHtml}</div>` +
    `<div class="dlg-foot">${footHtml}</div>`;
  $("#v5-dlg-x", dlg).onclick = () => dlg.close();
  dlg.showModal();
  return dlg;
}

function openDocSettings(api) {
  const design = api.getDesign();
  const rules = design.labelRules || {};
  const sheet = normalizeLabelSheet(design.labelSheet);
  const dlg = dialog(
    "文档设置",
    `
    <p class="tip">编号模板支持 {id} {name} {phase} {circuit} {conductor} {section} {seq}。</p>
    <label>回路标签模板<input id="v5-t-circuit" value="${esc(rules.circuitLabel || "{id} {name}")}"></label>
    <label>面标模板<input id="v5-t-face" value="${esc(rules.faceLabel || "{id}")}"></label>
    <label>导线标签模板<input id="v5-t-wire" value="${esc(rules.wireTag || "{circuit}-{conductor}")}"></label>
    <label>标签纸规格<select id="v5-label-preset">${[['module','按器件模位剪裁'],['a4-30','A4 · 30 格'],['a4-48','A4 · 48 格'],['custom','A4 · 自定义']].map(([id,name])=>`<option value="${id}" ${sheet.preset===id?'selected':''}>${name}</option>`).join('')}</select></label>
    <div class="v5-label-fields">${[['rows','行数'],['columns','列数'],['marginTop','上边距 mm'],['marginBottom','下边距 mm'],['marginLeft','左边距 mm'],['marginRight','右边距 mm'],['gapX','列间距 mm'],['gapY','行间距 mm']].map(([id,name])=>`<label>${name}<input type="number" min="0" step="${['rows','columns'].includes(id)?1:.1}" id="v5-label-${id}" value="${sheet[id]}"></label>`).join('')}</div>
    <p class="tip">标签按 A4 实际尺寸输出；打印请选择 100% / 实际大小，关闭页眉页脚。按实际标签纸调整边距和间距。</p>
    <label>二维码模式
      <select id="v5-t-qrmode">
        <option value="disabled" ${rules.qrMode !== "online" ? "selected" : ""}>暂不生成（项目网页待接入）</option>
        <option value="online" ${rules.qrMode === "online" ? "selected" : ""}>打开项目网页（HTTPS）</option>
      </select>
    </label>
    <label>项目网页地址
      <input id="v5-t-base" placeholder="https://你的域名/projects/项目编号" value="${esc(design.qrProjectUrl || "")}">
    </label>
    <p class="tip">请填写后续为本项目开设的手机网页。铭牌打开该网址；回路码附带 ?c=回路编号，供网页定位。未配置时不生成二维码，也不生成微信无法展示的文本码。</p>
    <p class="tip">网址需使用公网 HTTPS；保存配置不代表网站已发布。批量打印前请用手机微信实际扫码确认能打开正确项目。</p>
    <p id="v5-settings-error" role="alert"></p>
    `,
    `<button type="button" id="v5-t-cancel">取消</button><button type="button" class="primary" id="v5-t-save">保存</button>`,
  );
  const syncSheet = () => {
    const preset = $('#v5-label-preset',dlg).value;
    const values = normalizeLabelSheet({preset});
    for(const key of ['rows','columns','marginTop','marginBottom','marginLeft','marginRight','gapX','gapY']) {
      const field = $(`#v5-label-${key}`,dlg);
      if(preset!=='custom') field.value=values[key];
      field.disabled=preset!=='custom';
    }
  };
  $('#v5-label-preset',dlg).onchange=syncSheet;
  for(const key of ['rows','columns','marginTop','marginBottom','marginLeft','marginRight','gapX','gapY']) $(`#v5-label-${key}`,dlg).disabled=sheet.preset!=='custom';
  $("#v5-t-cancel", dlg).onclick = () => dlg.close();
  $("#v5-t-save", dlg).onclick = () => {
    const mode = $("#v5-t-qrmode", dlg).value;
    const base = $("#v5-t-base", dlg).value.trim();
    let labelSheet;
    try {
      if(mode==='online') {
        if(!projectQrUrl({qrProjectUrl:base})) throw new Error('请填写手机可访问的公网 HTTPS 项目网页地址，不支持本机地址、账号密码或 #片段');
      }
      labelSheet=normalizeLabelSheet({preset:$('#v5-label-preset',dlg).value,...Object.fromEntries(['rows','columns','marginTop','marginBottom','marginLeft','marginRight','gapX','gapY'].map(key=>[key,$(`#v5-label-${key}`,dlg).value]))});
    } catch(e) { $('#v5-settings-error',dlg).textContent=e.message; return; }
    design.labelRules = {
      ...rules,
      circuitLabel: $("#v5-t-circuit", dlg).value.trim() || "{id} {name}",
      faceLabel: $("#v5-t-face", dlg).value.trim() || "{id}",
      wireTag: $("#v5-t-wire", dlg).value.trim() || "{circuit}-{conductor}",
      qrMode: mode,
    };
    design.qrProjectUrl = base || null;
    design.labelSheet=labelSheet;
    api.persist?.();
    dlg.close();
    renderDocs(api);
    api.toast?.("文档设置已保存");
  };
}

function openSignoffDialog(api) {
  const design = api.getDesign();
  const issues = api.getIssues?.() || [];
  const errors = issues.filter((i) => i.level === "error").length;
  const pending = issues.length - errors;
  const history = (design.revisions || [])
    .map(
      (r, i) =>
        `<tr><td>Rev ${i + 1}</td><td>${esc(r.at)}</td><td>${esc(r.summary)}</td><td>${r.errors} / ${r.pending}</td></tr>`,
    )
    .join("");

  const dlg = dialog(
    "修订与签认",
    `
    <p class="tip">当前 ${revisionLabel(design)} · ${errors} 项需修正 / ${pending} 项待核。记录修订后封面、铭牌与系统图图题栏同步更新。</p>
    <label>修订摘要<textarea id="v5-rev-summary" rows="2" placeholder="例：按现场复测调整 C12 线径"></textarea></label>
    <label>修订日期<input type="date" id="v5-rev-date" value="${today()}"></label>
    <button type="button" id="v5-rev-add">记录一条修订</button>
    <hr style="border:none;border-top:1px solid #2a3a30;margin:14px 0">
    ${SIGNOFF_ROLES.map(
      (r) => `<fieldset><legend>${SIGNOFF_ROLE_LABELS[r]}</legend><label>姓名<input id="v5-sign-${r}" value="${esc(design.signoff?.[r]?.name || "")}" placeholder="姓名，留空表示未签认"></label><label>日期<input type="date" id="v5-sign-date-${r}" value="${esc(design.signoff?.[r]?.at || today())}"></label><label>备注<textarea id="v5-sign-note-${r}">${esc(design.signoff?.[r]?.note || '')}</textarea></label></fieldset>`,
    ).join("")}
    <p class="tip">签认仅记录责任人，不改变「条件性方案 · 非施工合格结论」口径。</p>
    <p id="v5-sign-error" role="alert"></p>
    ${history ? `<table class="doc-table" style="color:#cfe0d4"><thead><tr><th>版本</th><th>时间</th><th>摘要</th><th>错误/待核</th></tr></thead><tbody>${history}</tbody></table>` : ""}
    `,
    `<button type="button" id="v5-sign-cancel">关闭</button><button type="button" class="primary" id="v5-sign-save">保存签认</button>`,
  );

  $("#v5-rev-add", dlg).onclick = () => {
    let n;
    try {
      const summary=$("#v5-rev-summary",dlg).value.trim();
      if(!summary) throw new Error('请填写修订摘要');
      n = addRevision(design, summary, { errors, pending },revisionDate($('#v5-rev-date',dlg).value));
    } catch(e) {$('#v5-sign-error',dlg).textContent=e.message;return;}
    api.persist?.();
    dlg.close();
    renderDocs(api);
    api.toast?.(`已记录 Rev ${n}`);
  };
  $("#v5-sign-cancel", dlg).onclick = () => dlg.close();
  $("#v5-sign-save", dlg).onclick = () => {
    try {
      const draft=structuredClone(design);
      for (const r of SIGNOFF_ROLES) setSignoff(draft, r, {name:$(`#v5-sign-${r}`,dlg).value,at:$(`#v5-sign-date-${r}`,dlg).value,note:$(`#v5-sign-note-${r}`,dlg).value});
      design.signoff=draft.signoff;
    } catch(e) {$('#v5-sign-error',dlg).textContent=e.message;return;}
    api.persist?.();
    dlg.close();
    renderDocs(api);
    api.toast?.("签认已保存");
  };
}

export { makeGenericCabinet, DISCLAIMER, openDocs };
