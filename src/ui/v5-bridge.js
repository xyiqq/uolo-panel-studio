/**
 * V5 UI 桥接：空间面板、文档中心、产品库扩展入口。
 * 挂在现有 shell 上，不重写 V4 app.js。
 */
import { allCabinets, makeGenericCabinet } from "../data/cabinets/index.js";
import { SMART_PRODUCTS } from "../data/products/smart-index.js";
import { computeSpace } from "../core/space.js";
import { buildDocumentPack } from "../view/documents/index.js";
import { buildBom } from "../core/bom.js";
import { applyLabelRules } from "../core/labels.js";
import { handoverReadme, buildHandoverZip } from "../core/pack.js";
import { zipSync, strToU8 } from "fflate";

const DISCLAIMER = "条件性方案 · 非施工合格结论";

function $(sel, root = document) {
  return root.querySelector(sel);
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * @param {{ getDesign: () => any, getAssembly: () => any, getNet: () => any, getIssues: () => any[], recompute?: () => void, toast?: (m:string)=>void }} api
 */
export function mountV5Bridge(api) {
  injectStyles();
  injectTabs();
  injectSpacePanel(api);
  wireDocumentCenter(api);
  // 箱体下拉由 app.js fillCabinetSelect 统一填充（玛德克/通用/自定义），此处不再追加以免被 Y1 冲掉
  exposeSmartProducts();
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
  .v5-docs-layout{display:grid;grid-template-columns:220px 1fr;gap:12px;min-height:60vh}
  .v5-docs-nav label{display:block;margin:4px 0;font-size:12px;color:#c5d4c9}
  .v5-docs-preview{background:#fff;color:#111;padding:12px;border-radius:4px;min-height:70vh}
  .v5-docs-preview .doc-page{break-after:page;margin-bottom:24px;border-bottom:1px dashed #ccc;padding-bottom:24px}
  .v5-badge{display:inline-block;padding:1px 6px;border-radius:4px;background:#5a3d12;color:#ffd89a;font-size:10px;margin-left:6px}
  @media print{
    .shell,.topbar,.left,.inspector,.v5-docs-toolbar,.v5-docs-nav{display:none!important}
    #v5-docs-panel,#v5-docs-panel.open{display:block!important;position:static;background:#fff;color:#000;padding:0}
    .v5-docs-layout{display:block}
    .v5-docs-preview{padding:0}
  }
  `;
  document.head.appendChild(s);
}

function injectTabs() {
  const tabRow = document.querySelector("nav.nav") || document.querySelector(".work nav");
  if (!tabRow || $("#tab-documents")) return;
  const btn = document.createElement("button");
  btn.id = "tab-documents";
  btn.type = "button";
  btn.dataset.tab = "documents";
  btn.innerHTML = `文档中心`;
  btn.title = "系统图 · 标签 · 打印导出";
  const auditBtn = [...tabRow.querySelectorAll("button")].find((b) =>
    /校核/.test(b.textContent || "")
  );
  if (auditBtn) tabRow.insertBefore(btn, auditBtn);
  else tabRow.appendChild(btn);

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
        <button type="button" class="btn" id="v5-docs-svg">下载系统图 SVG</button>
        <button type="button" class="btn" id="v5-docs-zip">交底包 ZIP</button>
        <button type="button" class="btn" id="v5-docs-close">返回装配</button>
      </div>
      <div class="v5-docs-layout">
        <div class="v5-docs-nav" id="v5-docs-nav"></div>
        <div class="v5-docs-preview" id="v5-docs-preview"></div>
      </div>`;
    mount.appendChild(panel);
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
      <input id="v5-spare" type="range" min="0" max="50" step="5" value="25">
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
      design.spareRatio = Number($("#v5-spare").value) / 100;
      $("#v5-spare-val").textContent = Math.round(design.spareRatio * 100) + "%";
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

  $("#v5-spare")?.addEventListener("input", refresh);
  // periodic light refresh
  setInterval(refresh, 1500);
  refresh();
  api._refreshSpace = refresh;
}


function exposeSmartProducts() {
  window.__PANEL_SMART_PRODUCTS__ = SMART_PRODUCTS;
}

function wireDocumentCenter(api) {
  const open = () => {
    const panel = $("#v5-docs-panel");
    if (!panel) return;
    panel.classList.add("open");
    renderDocs(api);
  };
  const close = () => $("#v5-docs-panel")?.classList.remove("open");

  $("#tab-documents")?.addEventListener(
    "click",
    (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
      open();
    },
    true
  );
  $("#v5-docs-close")?.addEventListener("click", close);
  $("#v5-docs-print")?.addEventListener("click", () => window.print());
  $("#v5-docs-svg")?.addEventListener("click", () => {
    const svg = $("#v5-docs-preview")?.querySelector("svg");
    if (!svg) return api.toast?.("暂无系统图");
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    downloadBlob(blob, "system-diagram.svg");
  });
  $("#v5-docs-zip")?.addEventListener("click", async () => {
    try {
      const pack = collectPack(api);
      const files = {};
      files["README.txt"] = strToU8(handoverReadme());
      files["design.json"] = strToU8(JSON.stringify(api.getDesign(), null, 2));
      pack.pages.forEach((p, i) => {
        const ext = p.svg ? "svg" : "html";
        files[`docs/${String(i + 1).padStart(2, "0")}-${p.id}.${ext}`] = strToU8(p.svg || p.html || "");
      });
      const zipped = buildHandoverZip(files) || zipSync(files);
      downloadBlob(new Blob([zipped], { type: "application/zip" }), "handover-pack.zip");
      api.toast?.("交底包已下载");
    } catch (e) {
      api.toast?.("ZIP 失败：" + (e?.message || e));
    }
  });
}

function collectPack(api) {
  const design = api.getDesign();
  const assembly = api.getAssembly();
  const net = api.getNet();
  const issues = api.getIssues?.() || [];
  const bom = buildBom(design, assembly, net);
  const labels = applyLabelRules(design, net);
  return buildDocumentPack({ design, assembly, net, issues, bom, labels, matches: {} });
}

function renderDocs(api) {
  const pack = collectPack(api);
  const nav = $("#v5-docs-nav");
  const preview = $("#v5-docs-preview");
  if (!nav || !preview) return;
  const selected = new Set(pack.pages.map((p) => p.id));
  nav.innerHTML = pack.pages
    .map(
      (p) =>
        `<label><input type="checkbox" data-doc="${p.id}" checked> ${p.title}</label>`
    )
    .join("");
  const paint = () => {
    preview.innerHTML = pack.pages
      .filter((p) => selected.has(p.id))
      .map(
        (p) =>
          `<section class="doc-page" data-size="${p.pageSize || "A4"}"><h2 style="font-size:14px;margin:0 0 8px">${p.title}</h2>${
            p.svg || p.html || ""
          }</section>`
      )
      .join("");
  };
  nav.onchange = (ev) => {
    const t = ev.target;
    if (t?.dataset?.doc) {
      if (t.checked) selected.add(t.dataset.doc);
      else selected.delete(t.dataset.doc);
      paint();
    }
  };
  paint();
}

export { makeGenericCabinet, DISCLAIMER };
