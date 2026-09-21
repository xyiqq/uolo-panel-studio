import { createIcons, icons } from "lucide";
import {
  eX, _s, $s, Ka, kA, AX, sX, aX, Me, gA, js, Co, ea, ta, fr, Mo, W1, N1, yo, ka,
  Ue, HA, Za, Qe, bA, Eo, Yr, _r, Js
} from "../core/legacy-names.js";
import { renderTerminalSchematic as nX } from "../view/terminal-schematic.js";
import { TerminalStudio3D as Qo } from "../view/terminal-studio3d.js";
import { EVIDENCE_IMAGES as To } from "../assets/evidence/index.js";
import { mountV5Bridge } from "./v5-bridge.js";
import { renderTerminalConnections } from './terminal-connections.js';
import { readInstallPosition, rememberInstallPosition } from './install-position.js';
import {resolveModuleFeedBindings} from '../core/module-feeds.js';
import {buildDeliveryNet} from '../core/delivery-net.js';
import {wireRows as deliveryWireRows} from '../core/handover.js';
import {applyLabelRules as deliveryLabels} from '../core/labels.js';
let explodeScope='all';
import {
  GROUPS as BUILTIN_GROUPS,
  OTHER_GROUP,
  allGroups,
  groupOf,
  validateCustomGroup,
  nodePosition,
  resolveCabinet,
  isSmartModuleKind,
  allProducts,
} from "../core/domain.js";
import {
  isSharedModuleKind,
  nextModuleId,
  emptyChannels,
  emptyChannelLabels,
  normalizeModule,
  syncCircuitDevices,
  releaseCircuitFromModules,
  removeModule,
  suggestSmartFeedCircuit,
  inferBusType,
  busDefaults,
  nextBusId,
  setModuleProtect,
  normalizeProtectGroups,
  buildChannelRows,
  channelRowsToCsv,
  buildProtectLinkSchematic,
  buildChannelWireSchematic,
  linkChannelTerminal,
  compactModulePlacement,
  validateHardwareId,
  validateIpAddress,
  moduleAddressMode,
  visibleModuleAddress,
  setModuleAddressMode,
} from "../core/modules.js";
import { computeBusBudgets } from "../core/buses.js";
import { auditSmart } from "../core/audit/smart.js";
import { getUiMode, isSimpleMode, setUiMode } from "../core/ui-mode.js";
import { allCabinets, makeGenericCabinet } from "../data/cabinets/index.js";
import {
  DIN_SIZE_TEMPLATES,
  CUSTOM_KIND_OPTIONS,
  isSmartCustomKind,
  autoCustomName,
} from "../data/products/custom-templates.js";
import {
  createBlankDesign,
  BUILTIN_DESIGN_TEMPLATES,
  listUserDesignTemplates,
  saveUserDesignTemplate,
  deleteUserDesignTemplate,
  materializeTemplate,
  slotsLengthHint,
} from "../data/design-templates.js";
import "../styles/app.css";
import "../styles/simple-mode.css";

const sz = createIcons;
const un = icons;

var R=a=>document.querySelector(a),it=a=>String(a??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),Ut=a=>`<i data-lucide="${a}"></i>`,We=(a,t,e,r="")=>`<button id="${a}" class="ib ${r}" title="${e}" aria-label="${e}">${Ut(t)}</button>`,an=a=>`<div class="mini product-preview" style="--tone:${a.color}"><img data-thumb="${it(a.id)}" alt="${it(a.name)}" decoding="async"><span>${a.amps?"C"+a.amps:a.modules!=null?a.modules+"M":a.smart||a.zone==="control"?"SMART":"T2"}</span></div>`,re=(a,t)=>a.map(([e,r])=>`<option value="${it(e)}" ${String(e)===String(t)?"selected":""}>${it(r)}</option>`).join(""),Bt=(a,t)=>`<label class="field"><span>${a}</span>${t}</label>`,TA=(a,t,e,r,s,n="1")=>`<div class="unit"><input id="${a}" type="number" value="${t??""}" min="${r}" max="${s}" step="${n}"><em>${e}</em></div>`,hX="panel-studio-v4",Y=createBlankDesign(),K1="\u672C\u5730\u65B9\u6848",G1="";try{let a=JSON.parse(R("#embedded-design").textContent),t=localStorage.getItem(hX),e=a?_s(a):t?_s(JSON.parse(t)):null;e&&($s(e),Y=e)}catch(a){G1="\u5B58\u50A8\u65B9\u6848\u672A\u901A\u8FC7\u6821\u9A8C\uFF0C\u5DF2\u8F7D\u5165\u6E90\u8868\u65B9\u6848\uFF1A"+a.message}var je=Y.circuits.find(a=>/烤箱/.test(a.name))?.id||Y.circuits[0]?.id||"Q0",EA=null,BA="assembly",pr="tree",Ja=isSimpleMode(Y)?"channels":"circuits",zr="issues",mX="",k1=!1,Ge={power:!1,trip:null},_a="perspective",vX="selected",Bo=!1,cr=!1,hr=1,Ke=!1,Ya="dark",pX="standard",Aa=[],sn=[],kt,Xe,ts,Je,qt,An=new Set(["hvac","lighting","sockets","smart","av"]);document.documentElement.dataset.uiMode=getUiMode(Y);R("#app").innerHTML=`
<div class="shell">
<header class="topbar">
  <div class="brand"><div class="brand-mark">${Ut("panels-top-left")}</div><div><h1>\u914D\u7535\u5DE5\u574A <span style="font-weight:400;color:#a9bab0">/ 04</span></h1><small>MECHANICAL INSPECTION STUDIO</small></div></div>
  <div id="project-title" class="project"></div><span id="saved" class="save"></span>
  <div class="tools">
    ${We("mobile-left","panel-left","\u56DE\u8DEF\u5BFC\u822A","mobile-only")}${We("undo","undo-2","\u64A4\u9500")}${We("redo","redo-2","\u91CD\u505A")}
    <button id="import" class="btn header-secondary">${Ut("folder-open")}\u6253\u5F00</button>
    <button id="export" class="btn primary">${Ut("download")}\u5BFC\u51FA\u65B9\u6848</button>
    ${We("mobile-right","sliders-horizontal","\u53C2\u6570\u9762\u677F","mobile-only")}
  </div>
</header>
<main class="body-grid">
  <aside class="left">
    <section class="side-section"><div class="section-head"><h2>\u9879\u76EE\u914D\u7F6E</h2>${We("settings","settings-2","\u7535\u6E90\u4E0E\u8BBE\u8BA1\u6761\u4EF6")}</div>
      ${Bt("\u4F9B\u7535\u76F8\u5236",`<select id="supply">${re([["three","\u4E09\u76F8\u4E94\u7EBF \xB7 380 / 220 V"],["single","\u5355\u76F8 \xB7 220 V \xB7 L + N + PE"]],Y.supply)}</select>`)}
      ${Bt("\u7BB1\u4F53\u89C4\u683C \xB7 \u5382\u5BB6/\u901A\u7528\u4F30\u7B97",'<select id="cabinet"></select>')}<button type="button" class="btn" id="custom-cabinet" style="margin-top:8px;width:100%">${Ut("box")} \u81ea\u5b9a\u4e49\u7bb1\u4f53\u2026</button>
      <button type="button" class="btn" id="design-templates" style="margin-top:8px;width:100%">${Ut("layout-template")} \u65b9\u6848\u6a21\u677f\u2026</button>
      <button type="button" class="btn" id="save-as-template" style="margin-top:8px;width:100%">${Ut("bookmark-plus")} \u5b58\u4e3a\u8bbe\u5907\u6a21\u677f</button>
      <button type="button" class="btn" id="manage-groups" style="margin-top:8px;width:100%">${Ut("shapes")} 逻辑分区…</button>
      <div class="stat-strip"><span>\u6A21\u6570\u5360\u7528</span><span id="capacity"></span></div><div class="progress"><i id="capacity-bar"></i></div>
      <div class="source-badge" id="source-badge">${Ut("sheet")}<span id="source-badge-text"></span></div>
    </section>
    <div class="side-tabs"><button data-left="tree" class="active">\u56DE\u8DEF\u7ED3\u6784</button><button data-left="library">\u4EA7\u54C1\u5E93</button></div>
    <div class="library-tools" id="library-tools" hidden><button class="btn" id="new-product">${Ut("plus")}\u65B0\u589E\u54C1\u724C / \u578B\u53F7</button></div>
    <label class="search">${Ut("search")}<input id="search" aria-label="\u641C\u7D22\u56DE\u8DEF\u6216\u4EA7\u54C1" placeholder="\u641C\u7D22\u56DE\u8DEF\u3001\u578B\u53F7\u2026"></label>
    <div id="left-content"></div>
    <div class="side-foot"><button id="source-button">${Ut("book-open")}\u4EA7\u54C1\u624B\u518C\u4E0E\u8BBE\u8BA1\u4F9D\u636E</button><div class="tiny" style="margin-top:8px">\u6E90\u8868\u5DF2\u6620\u5C04 \xB7 \u8BBE\u5907\u8FB9\u754C\u5F85\u7B7E\u8BA4</div></div>
  </aside>
  <section class="work">
    <nav class="nav">
      <button data-tab="assembly" class="active">${Ut("box")}\u88C5\u914D\u8BBE\u8BA1</button>
      <button data-tab="wiring">${Ut("cable")}\u7AEF\u5B50\u63A5\u7EBF</button>
      <button data-tab="schedule">${Ut("list-tree")}<span class="simple-only">通道与设备</span><span class="full-only">\u56DE\u8DEF\u4E0E\u8D1F\u8377</span></button>
      <button data-tab="audit" class="full-only">${Ut("shield-check")}\u6821\u6838\u4E0E\u4F9D\u636E</button>
    </nav>
    <div class="canvas-wrap studio-dark">
      <div id="canvas" class="canvas"></div>
      <div id="overlay">
        <div class="canvas-top"><h2 id="model-title"></h2><p id="model-dimensions"></p><div class="series"><span>BOJING SERIES</span><span>\xB7</span><span id="scope-label"></span></div></div>
        <div class="canvas-controls"><button data-mode="perspective" class="active">\u4E09\u7EF4</button><button data-mode="front">\u6B63\u89C6</button><button id="focus">\u805A\u7126</button><button id="inspect-only">${Ut("scan-eye")}\u5355\u4EF6</button><button id="explode">${Ut("layers-3")}\u62C6\u89E3</button></div>

        <div class="canvas-tools">
          ${We("select-mode","mouse-pointer-2","\u9009\u62E9\u5668\u4EF6","active")}${We("move-mode","move","\u79FB\u52A8\u56DE\u8DEF\u5668\u4EF6")}
          ${We("pan-mode","hand","\u62D6\u52A8\u5E73\u79FB\u753B\u9762")}
          ${We("door","door-closed","\u73BB\u7483\u9762\u76D6")}${We("fit","scan","\u6574\u67DC\u53D6\u666F")}
          ${We("auto-wire","wand-sparkles","\u6062\u590D\u81EA\u52A8\u914D\u7EBF","full-only")}${We("balance","align-horizontal-justify-center","\u5747\u8861\u5355\u76F8\u56DE\u8DEF\u5206\u914D","full-only")}
          ${We("snapshot","camera","\u5BFC\u51FA\u4E09\u7EF4\u5FEB\u7167")}
          ${We("theme","sun","\u5207\u6362\u6D45\u8272\u5DE5\u4F5C\u53F0")}
          ${We("chrome-top","panel-top","\u9690\u85CF\u9876\u90E8\u673A\u67DC\u4FE1\u606F")}${We("chrome-bottom","panel-bottom","\u9690\u85CF\u5E95\u90E8\u7EC4\u4EF6\u6761")}
        </div>
        <div class="view-bottom"><div class="zoom">${We("zoom-minus","minus","\u7F29\u5C0F")}<span id="zoom-value">100%</span>${We("zoom-plus","plus","\u653E\u5927")}</div>
          <select class="wire-mode" id="wire-mode" aria-label="\u63A5\u7EBF\u663E\u793A">${re([["selected","\u6240\u9009\u56DE\u8DEF\u63A5\u7EBF"],["all","\u5168\u90E8\u63A5\u7EBF"],["none","\u9690\u85CF\u63A5\u7EBF"]],"selected")}</select>
          <select class="quality-select" id="quality" aria-label="\u6E32\u67D3\u753B\u8D28">${re([["low","\u8F7B\u91CF"],["standard","\u6807\u51C6"],["high","\u9AD8\u6E05"]],"standard")}</select>
        </div>
        <div class="wire-legend full-only">${Object.entries(Ue).map(([a,t])=>`<span><i style="background:${a==="PE"?"linear-gradient(90deg,#d8bd42 50%,#29885d 50%)":t}"></i>${a}</span>`).join("")}</div>
        <div class="parts-dock" id="parts-dock"><div class="dock-heading"><span id="part-caption">\u7EC4\u4EF6\u68C0\u89C6</span><small id="render-status">\u6309\u9700\u6E32\u67D3</small></div><div class="parts-scroll" id="parts-scroll"></div></div>
        <div id="protect-schematic" class="protect-schematic simple-only" hidden></div>
        <div class="phase-strip full-only"><div id="phase-values" class="phase-values"></div><div class="sim-line">
          <label class="switch-label"><input class="switch" id="power" type="checkbox">\u6A21\u62DF\u9001\u7535</label><span id="live-count" class="tiny"></span><span class="tiny sim-label">\u4EC5\u7EDF\u8BA1\u6B63\u5E38\u4F9B\u7535\u56DE\u8DEF \xB7 \u975E\u9A8C\u7535\u7ED3\u679C</span>
        </div></div>
      </div>
      <div id="pane" class="pane"></div>
    </div>
  </section>
  <aside class="right"><div id="inspector"></div></aside>
</main>
<footer class="footer"><button id="footer-audit" class="full-only">${Ut("triangle-alert")}<span id="issue-count"></span></button><span id="footer-wiring"></span><span class="last"><span class="simple-only">简易布置 · 通道备注与共用保护</span><span class="full-only">\u6761\u4EF6\u6027\u65B9\u6848\u8BA1\u7B97 \xB7 \u672A\u5B8C\u6210\u4F9B\u7535\u6761\u4EF6\u3001\u5382\u5BB6\u517C\u5BB9\u6027\u4E0E\u5DE5\u7A0B\u7B7E\u8BA4</span></span></footer>
</div>
<dialog id="modal"><div class="modal-head"><h2 id="modal-title"></h2>${We("close-modal","x","\u5173\u95ED")}</div><div id="modal-body" class="modal-body"></div></dialog>
<input id="file" type="file" accept=".json,application/json" hidden><div id="toast" class="toast" role="status"></div><div id="print" class="print-only"></div>`;var rn=new Set,j1=new IntersectionObserver(a=>{a.forEach(t=>{t.isIntersecting&&(j1.unobserve(t.target),rn.delete(t.target),HU(t.target))})},{rootMargin:"60px"});function HU(a){if(!qt||a.dataset.pending)return;let t=Me(Y,a.dataset.thumb);if(!t)return;let e=qt.thumbnails.key(t);a.dataset.pending=e,qt.getThumbnail({...t}).then(r=>{r&&a.isConnected&&a.dataset.pending===e&&(a.src=r,a.parentElement.classList.add("loaded"))})}function xX(){for(let a of rn)a.isConnected||(j1.unobserve(a),rn.delete(a));qt&&document.querySelectorAll("img[data-thumb]:not([data-pending])").forEach(a=>{rn.has(a)||(rn.add(a),j1.observe(a))})}var Ye=()=>{sz({icons:un,attrs:{"stroke-width":1.7}}),xX()};function pe(a){R("#toast").textContent=a,R("#toast").classList.add("visible"),clearTimeout(pe.timer),pe.timer=setTimeout(()=>R("#toast").classList.remove("visible"),3800)}function allGroupsOf(){let a=allGroups(Y);return orphanCircuits().length?[...a,OTHER_GROUP]:a}
function orphanCircuits(){let a=new Set(allGroups(Y).map(t=>t.id));return Y.circuits.filter(t=>!a.has(t.group))}
function circuitsOfGroup(a){return a===OTHER_GROUP.id?orphanCircuits():Y.circuits.filter(t=>t.group===a)}
function groupName(a){return groupOf(Y,a).name}
function nextGroupId(){return"USR-GRP-"+Math.random().toString(36).slice(2,8)}
function freeSlots(a,t){let e=[],r=kt.box,s=Math.max(1,Math.ceil((a?.modules||Math.ceil((a?.width||18)/18))||1)),n=kt.occupied;for(let o=0;o<r.rows;o++)for(let i=0;i+s<=r.slots;i++){let l=!0;for(let d=0;d<s;d++){let f=n[o][i+d];if(f&&f!==t){l=!1;break}}l&&e.push({row:o,slot:i})}return e}
function positionLabel(a){return`第 ${a.row+1} 排 · 第 ${a.slot+1} 位`}
function setNodePosition(a,t){de(e=>{e.positions&&typeof e.positions=="object"||(e.positions={}),t?e.positions[a]={row:t.row,slot:t.slot}:delete e.positions[a];let r=e.circuits.find(s=>s.id===a);r&&(r.position=null)})}
function gX(){
  kt=compactModulePlacement(Ka(Y),Y),Xe=$s(Y,kt),ts=aX(Xe,Y,Ge);
  for(const node of kt.nodes) if(node.module) node.product={...node.product,...visibleModuleAddress(node.module),displayName:node.module.displayName||''};
  const products=allProducts(Y);
  const budgets=computeBusBudgets(Y,products);
  const smartIssues=auditSmart(Y,kt,budgets,{products,cabinets:allCabinets(Y)}).map(i=>({
    level:i.level,
    code:i.code,
    text:i.message,
    circuit:i.ref||null,
  }));
  Je=[...AX(Y,kt),...sX(Xe,Y),...smartIssues];
  EA&&!Xe.wires.some(a=>a.id===EA)&&(EA=null)
}function Y1(){try{localStorage.setItem(hX,JSON.stringify(Y)),K1="\u5DF2\u4FDD\u5B58\u5230\u672C\u673A"}catch{K1="\u5B58\u50A8\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5BFC\u51FA JSON"}}function de(a,t=!1){let e=ea(Y);if(a(Y),t){Y.disconnected=[],Y.wireOverrides={},EA=null;let r=new Set(Ka(Y).nodes.map(s=>s.id));Y.states=Object.fromEntries(Object.entries(Y.states).filter(([s])=>r.has(s)))}JSON.stringify(e)!==JSON.stringify(Y)&&(Aa.push(e),Aa.length>50&&Aa.shift(),sn=[],Ge.trip=null,Y1(),ra())}function MA(a,t){R("#modal-title").textContent=a,R("#modal-body").innerHTML=t,R("#modal").showModal(),Ye()}function kU(a,t,e,r){R(a).onchange=s=>{let n=s.target.valueAsNumber;if(!Number.isFinite(n)||n<t||n>e){pe(`\u8BF7\u8F93\u5165 ${t} \u81F3 ${e} \u4E4B\u95F4\u7684\u6570\u503C`),As();return}r(n)}}function es(){return Y.circuits.find(a=>a.id===je)||kt.nodes.find(a=>a.id===je)?.circuit}function KU(a){let t=ts.circuits[a.id];return t.phasePresent&&!t.phaseOk?"\u7F3A\u76F8 \xB7 \u90E8\u5206\u76F8\u7EBF\u4ECD\u5E26\u7535":t.phasePresent&&!t.neutralOk?"\u7F3A N \xB7 \u76F8\u7EBF\u4ECD\u5E26\u7535":t.phasePresent&&!t.peOk?"PE \u65AD\u5F00 \xB7 \u4ECD\u5E26\u7535":Ge.trip===a.id?"\u6A21\u62DF\u8DF3\u95F8":t.powered?"\u6B63\u5E38\u4F9B\u7535":"\u672A\u5F62\u6210\u6B63\u5E38\u4F9B\u7535"}function VA(a){je=a,EA=null,As(),UA(),rs(),WA(),Ye()}function bX(a){let t=Xe.wires.find(e=>e.id===a);t&&(t.circuit&&(je=t.circuit),EA=a,Ke=!1,As(),rs(),WA(),Ye())}function GU(){return{selected:kt.nodes.some(a=>a.id===je)?je:es()?.id||je,wireMode:vX,door:Bo,exploded:cr,explodeScope,explodeAmount:1,isolate:Ke,sim:Ge}}function CX(a){je=a,EA=null,Ke=!0,As(),UA(),WA(),Ye()}function WA(){let a=kt.nodes.find(e=>e.id===je)||kt.nodes.find(e=>e.circuit?.id===je);if(Ke&&(!a||a.overflow)&&(Ke=!1),R("#inspect-only").disabled=!a||!!a.overflow,R("#inspect-only").classList.toggle("active",Ke),R("#explode").classList.toggle("active",cr),R("#wire-mode").disabled=false,R(".canvas-wrap").classList.toggle("is-isolated",Ke),Ke&&a)R("#model-title").textContent=a.product.name,R("#model-dimensions").textContent=`${a.product.width} \xD7 ${a.product.height} \xD7 ${a.product.depth} mm \xB7 ${a.product.brand}`,R("#scope-label").textContent=`${a.id} \xB7 \u5355\u4EF6\u68C0\u89C6`;else{R("#model-title").textContent=kt.box.name,R("#model-dimensions").textContent=`\u7BB1\u4F53 ${kt.box.width} \xD7 ${kt.box.height} \xD7 ${kt.box.depth} mm \xB7 ${kt.box.rows} \u6392 / ${kt.box.slots}P \xB7 ${kt.box.slots*18} mm`;let e=kt.nodes.filter(r=>r.overflow).length;R("#scope-label").textContent=e?`${e} \u4E2A\u7EC4\u4EF6\u672A\u88C5\u5165 \xB7 \u5BB9\u91CF\u4E0D\u8DB3`:cr?`\u5206\u5C42\u62C6\u89E3 \xB7 100%`:`${kt.nodes.length} \u4E2A\u7EC4\u4EF6 \xB7 \u6574\u67DC`}let t=JSON.stringify(kt.nodes.map(e=>[e.id,e.label,qt?.thumbnails.key(e.product)||e.product,e.overflow]));R("#parts-scroll").dataset.key!==t&&(R("#parts-scroll").dataset.key=t,R("#parts-scroll").innerHTML=kt.nodes.filter(e=>!e.overflow).map(e=>`<button class="part-tile" data-part="${e.id}" title="${it(e.id+" \xB7 "+e.label)}" aria-label="\u68C0\u89C6 ${it(e.id+" "+e.label)}"><img data-thumb="${it(e.product.id)}" alt="${it(e.label)}" decoding="async"><span>${e.id}</span></button>`).join(""),document.querySelectorAll("[data-part]").forEach(e=>e.onclick=()=>CX(e.dataset.part))),document.querySelectorAll("[data-part]").forEach(e=>e.classList.toggle("active",e.dataset.part===a?.id)),R("#part-caption").textContent=a?`${a.id} \xB7 ${a.label}`:"\u7EC4\u4EF6\u68C0\u89C6",qt?.build(Xe,Y,ts,GU()),xX()}function fillCabinetSelect(a){let t=allCabinets(a),e=[["\u739B\u5FB7\u514B",t.filter(r=>r.brand==="\u739B\u5FB7\u514B"||["MH144","Q120","Q96"].includes(r.id))],["\u901A\u7528\u4F30\u7B97",t.filter(r=>r.brand==="\u901A\u7528"||r.estimated&&!r.custom)],["\u81ea\u5b9a\u4e49",t.filter(r=>r.custom)]],r="";for(let[s,n]of e){if(!n.length)continue;r+=`<optgroup label="${it(s)}">`;for(let o of n)r+=`<option value="${it(o.id)}" ${o.id===a.cabinet?"selected":""}>${it(o.name)}${o.estimated?" \xB7 \u4F30\u7B97":""}</option>`;r+="</optgroup>"}R("#cabinet").innerHTML=r}function openCustomCabinetDialog(){let a={rows:2,slots:24,depth:120,mount:"\u660e\u88c5"};MA("\u81ea\u5b9a\u4e49\u7bb1\u4f53",`
    <p>\u6309\u901a\u7528\u4f30\u7b97\u516c\u5f0f\u751f\u6210\u7bb1\u4f53\uff08\u6392\u8ddd 150 mm\uff09\uff1b\u987b\u4ee5\u6240\u9009\u5382\u5bb6\u56fe\u7eb8\u4e3a\u51c6\uff0c\u4e0d\u5f97\u76f4\u63a5\u7528\u4e8e\u65bd\u5de5\u3002</p>
    <div class="field-grid">${Bt("\u6392\u6570",TA("cab-rows",a.rows,"\u6392",1,12,1))}
      ${Bt("\u6bcf\u6392 P \u6570",TA("cab-slots",a.slots,"P",6,48,1))}</div>
    <p class="lib-preview" id="cab-slot-hint"></p>
    <div class="field-grid">${Bt("\u5185\u90e8\u6df1\u5ea6",`<select id="cab-depth">${re([[90,"90 mm"],[120,"120 mm"],[150,"150 mm"],[180,"180 mm"]],a.depth)}</select>`)}
      ${Bt("\u5b89\u88c5\u65b9\u5f0f",`<select id="cab-mount">${re([["\u660e\u88c5","\u660e\u88c5"],["\u6697\u88c5","\u6697\u88c5"]],a.mount)}</select>`)}</div>
    <p class="lib-preview" id="cab-preview"></p>
    <button class="btn primary" id="cab-save">\u751f\u6210\u5e76\u5207\u6362</button>`);
  function preview(){let t=+R("#cab-rows").value,e=+R("#cab-slots").value,r=+R("#cab-depth").value,s=R("#cab-mount").value,n=makeGenericCabinet(t,e,r,s);R("#cab-slot-hint").textContent=slotsLengthHint(e)||"\u8bf7\u8f93\u5165\u6bcf\u6392 P \u6570";R("#cab-preview").textContent=`\u9884\u89c8\uff1a${n.name} \xB7 \u5185\u90e8 ${n.width}\xd7${n.height}\xd7${n.depth} mm \xB7 \u5916\u5f62 ${n.outer.join("\xd7")} mm`}
  ["cab-rows","cab-slots","cab-depth","cab-mount"].forEach(t=>R("#"+t).addEventListener("input",preview)),R("#cab-depth").onchange=preview,R("#cab-mount").onchange=preview,preview(),R("#cab-save").onclick=()=>{try{let t=+R("#cab-rows").value,e=+R("#cab-slots").value,r=+R("#cab-depth").value,s=R("#cab-mount").value,n=makeGenericCabinet(t,e,r,s),o={...n,id:"USR-CAB-"+crypto.randomUUID(),brand:"\u81ea\u5b9a\u4e49",custom:!0,name:`\u81ea\u5b9a\u4e49 ${t}\xd7${e}P \xB7 \u6df1${r} \xB7 ${s}`,source:"\u7528\u6237\u81ea\u5b9a\u4e49\u7bb1\u4f53 \xB7 \u987b\u4ee5\u5382\u5bb6\u56fe\u7eb8\u4e3a\u51c6"};R("#modal").close(),de(i=>{i.customCabinets=Array.isArray(i.customCabinets)?i.customCabinets:[],i.customCabinets.push(o),i.cabinet=o.id,i.circuits.forEach(l=>l.position=null)},!0),pe("\u5df2\u751f\u6210\u5e76\u5207\u6362\u81ea\u5b9a\u4e49\u7bb1\u4f53")}catch(t){pe(t.message)}}}
function applyDesignFromTemplate(tpl){try{let next=materializeTemplate(tpl);Aa.push(ea(Y)),sn=[],Y=next,Ge={power:!1,trip:null},je=Y.circuits[0]?.id||"Q0",EA=null,Y1(),ra(),pe("\u5df2\u5e94\u7528\u6a21\u677f\uff1a"+tpl.name)}catch(err){pe(err.message||String(err))}}
function openDesignTemplatesDialog(){let user=listUserDesignTemplates();let rows=BUILTIN_DESIGN_TEMPLATES.map(t=>`<div class="library-row"><div class="library-info"><strong>${it(t.name)}</strong><small>${it(t.hint)}</small></div><div class="library-actions"><button class="btn primary" data-apply-builtin="${it(t.id)}">\u5e94\u7528</button></div></div>`).join("");let userRows=user.length?user.map(t=>`<div class="library-row"><div class="library-info"><strong>${it(t.name)}</strong><small>${it(t.hint||"")} \xB7 ${it((t.savedAt||"").slice(0,10))}</small></div><div class="library-actions"><button class="btn primary" data-apply-user="${it(t.id)}">\u5e94\u7528</button><button class="btn danger" data-del-user="${it(t.id)}">\u5220\u9664</button></div></div>`).join(""):'<p class="empty" style="padding:12px">\u6682\u65e0\u7528\u6237\u6a21\u677f\uff1b\u53ef\u5148\u88c5\u914d\u8bbe\u5907\u540e\u70b9\u300c\u5b58\u4e3a\u8bbe\u5907\u6a21\u677f\u300d</p>';MA("\u65b9\u6848\u6a21\u677f",`<p>\u65b0\u5efa\u9ed8\u8ba4\u4e3a\u7a7a\u767d\u7bb1\u4f53\uff08\u4ec5\u603b\u5f00+SPD\uff09\u3002\u5e94\u7528\u6a21\u677f\u4f1a\u66ff\u6362\u5f53\u524d\u65b9\u6848\uff0c\u53ef\u64a4\u9500\u3002</p><h3 style="margin:12px 0 8px;font-size:13px">\u5185\u7f6e</h3>${rows}<h3 style="margin:16px 0 8px;font-size:13px">\u6211\u7684\u6a21\u677f</h3>${userRows}`);document.querySelectorAll("[data-apply-builtin]").forEach(btn=>btn.onclick=()=>{let t=BUILTIN_DESIGN_TEMPLATES.find(x=>x.id===btn.dataset.applyBuiltin);R("#modal").close();if(t)applyDesignFromTemplate(t)});document.querySelectorAll("[data-apply-user]").forEach(btn=>btn.onclick=()=>{let t=listUserDesignTemplates().find(x=>x.id===btn.dataset.applyUser);R("#modal").close();if(t)applyDesignFromTemplate(t)});document.querySelectorAll("[data-del-user]").forEach(btn=>btn.onclick=()=>{deleteUserDesignTemplate(btn.dataset.delUser);openDesignTemplatesDialog();pe("\u5df2\u5220\u9664\u6a21\u677f")})}
function openSaveAsTemplateDialog(){MA("\u5b58\u4e3a\u8bbe\u5907\u6a21\u677f",`<p>\u4fdd\u5b58\u5f53\u524d\u7bb1\u4f53\u3001\u603b\u5f00/SPD\u3001\u81ea\u5b9a\u4e49\u578b\u53f7\u4e0e ${Y.circuits.length} \u6761\u56de\u8def\u8bbe\u5907\uff08\u4e0d\u5305\u542b\u672a\u5206\u914d\u6e90\u8868\u8d1f\u8377\uff09\u3002</p>${Bt("\u6a21\u677f\u540d\u79f0",`<input id="tpl-name" maxlength="80" value="${it(Y.name+" \u6a21\u677f")}">`)}<button class="btn primary" id="tpl-save">\u4fdd\u5b58\u5230\u672c\u673a</button>`);R("#tpl-save").onclick=()=>{try{let name=R("#tpl-name").value;saveUserDesignTemplate(Y,name);R("#modal").close();pe("\u5df2\u4fdd\u5b58\u6a21\u677f\uff1a"+name.trim())}catch(err){pe(err.message||String(err))}}}
function moduleAddressFields(m){
  const mode=moduleAddressMode(m);
  return Bt('备注名称',`<input id="insp-display-name" data-display-name="${it(m.id)}" value="${it(m.displayName||'')}" maxlength="40" placeholder="例如：客厅灯光网关">`)+Bt('地址类型',`<select id="insp-address-mode" data-address-mode="${it(m.id)}">${re([['none','无'],['id','模块 ID'],['ip','IP 地址'],['both','ID + IP']],mode)}</select>`)+
    '<p id="address-mode-error" role="alert" style="color:#bf3030;font-size:11px"></p>'+
    (['id','both'].includes(mode)?Bt('模块 ID（十六进制）',`<input id="insp-hardware-id" data-hardware-id="${it(m.id)}" value="${it(m.hardwareId||'')}" maxlength="2" placeholder="01 / 0E" aria-describedby="hardware-id-error">`)+'<p id="hardware-id-error" role="alert" style="color:#bf3030;font-size:11px"></p>':'')+
    (['ip','both'].includes(mode)?Bt('IP 地址',`<input id="insp-ip-address" data-module-ip="${it(m.id)}" value="${it(m.ipAddress||'')}" maxlength="45" placeholder="192.168.1.100" aria-describedby="module-ip-error">`)+'<p id="module-ip-error" role="alert" style="color:#bf3030;font-size:11px"></p>':'');
}
function ra(){
  if(!R('#explode-scope')){
    const scope=document.createElement('select');scope.id='explode-scope';
    scope.setAttribute('aria-label','拆解范围');scope.title='拆解范围';
    scope.innerHTML='<option value="all">整柜拆解</option><option value="selected">所选器件拆解</option>';
    scope.className='explode-scope';
    R('#explode').after(scope);
    scope.onchange=()=>{
      explodeScope=scope.value;
      cr=true;Ke=explodeScope==='selected';
      WA();qt?.fit(Ke);
    };
  }
  const wireMode=R('#wire-mode');
  if(wireMode && !wireMode.dataset.initialized){
    vX='all';wireMode.value='all';wireMode.dataset.initialized='true';
  }
  gX();
  if(!R('#cabinet-nbar')){
    const field=document.createElement('label');field.className='field';
    field.innerHTML='<span>零线排位置</span><select id="cabinet-nbar"><option value="top">上方（横装）</option><option value="bottom">下方（横装）</option><option value="left">左侧（竖装）</option><option value="right">右侧（竖装）</option></select>';
    R('#cabinet').closest('label').after(field);
    R('#cabinet-nbar').onchange=e=>de(d=>{d.nBarPosition=e.target.value},true);
  }
  R('#cabinet-nbar').value=Y.nBarPosition||'bottom';
  if(!R('#include-neutral-bar')){
    const switches=document.createElement('div');switches.style.cssText='display:grid;gap:8px;margin:10px 0';
    switches.innerHTML='<label class="switch-label"><input type="checkbox" class="switch" id="include-neutral-bar">安装零线排</label><label class="switch-label"><input type="checkbox" class="switch" id="include-earth-bar">安装地线排</label>';
    R('#cabinet-nbar').closest('label').before(switches);
    R('#include-neutral-bar').onchange=e=>de(d=>{d.includeNeutralBar=e.target.checked},true);
    R('#include-earth-bar').onchange=e=>de(d=>{d.includeEarthBar=e.target.checked},true);
  }
  R('#include-neutral-bar').checked=Y.includeNeutralBar!==false;
  R('#include-earth-bar').checked=Y.includeEarthBar!==false;
  R('#cabinet-nbar').disabled=Y.includeNeutralBar===false;
  if(!R('#terminal-wires-toggle')){
    const toggle=document.createElement('button');
    toggle.id='terminal-wires-toggle';toggle.className='ib';
    toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked','true');
    toggle.setAttribute('aria-label','显示端子连线');toggle.title='显示端子连线';
    toggle.innerHTML=Ut('cable');
    toggle.onclick=()=>{
      if(!qt) return;
      qt.terminalWiresVisible=qt.terminalWiresVisible===false;
      toggle.setAttribute('aria-checked',String(qt.terminalWiresVisible));
      WA();
    };
    R('.canvas-tools').append(toggle);
  }
  let terminalTab=R('#terminal-connections-tab');
  if(!terminalTab){
    terminalTab=document.createElement('button');
    terminalTab.id='terminal-connections-tab';
    terminalTab.dataset.tab='terminal-connections';
    terminalTab.innerHTML=Ut('cable')+'端子连接';
    R('.nav').append(terminalTab);
    terminalTab.addEventListener('click',()=>{BA='terminal-connections';ra()});
    R('#inspector').addEventListener('click',event=>{
      const explodeButton=event.target.closest('[data-explode-module]');
      if(explodeButton){
        je=explodeButton.dataset.explodeModule;EA=null;explodeScope='selected';
        R('#explode-scope').value='selected';Ke=true;cr=true;
        WA();qt?.fit(true);return;
      }
      const button=event.target.closest('[data-terminal-connect]');
      if(!button) return;
      MA('端子连接 '+button.dataset.terminalConnect,'');
      renderTerminalConnections({root:R('#modal-body'),design:Y,resolve:id=>Me(Y,id),commit:de,download:nn,terminalId:button.dataset.terminalConnect});
    });
    R('#inspector').addEventListener('change',event=>{
      const nameInput=event.target.closest('[data-display-name]');
      if(nameInput){de(d=>{d.modules.find(m=>m.id===nameInput.dataset.displayName).displayName=nameInput.value.trim().slice(0,40)});return}
      const modeInput=event.target.closest('[data-address-mode]');
      if(modeInput){
        try{de(d=>setModuleAddressMode(d,modeInput.dataset.addressMode,modeInput.value))}
        catch(error){modeInput.value=moduleAddressMode(Y.modules.find(m=>m.id===modeInput.dataset.addressMode));R('#address-mode-error').textContent=error.message;pe(error.message)}
        return;
      }
      const ipInput=event.target.closest('[data-module-ip]');
      if(ipInput){
        try{
          const ip=validateIpAddress(ipInput.value);
          ipInput.setCustomValidity('');ipInput.removeAttribute('aria-invalid');
          R('#module-ip-error').textContent='';ipInput.value=ip;
          de(d=>{d.modules.find(m=>m.id===ipInput.dataset.moduleIp).ipAddress=ip});
        }catch(error){ipInput.setCustomValidity(error.message);ipInput.setAttribute('aria-invalid','true');R('#module-ip-error').textContent=error.message;pe(error.message)}
        return;
      }
      const input=event.target.closest('[data-hardware-id]');
      if(!input) return;
      try {
        const id=validateHardwareId(Y,input.dataset.hardwareId,input.value);
        input.value=id;input.setCustomValidity('');input.removeAttribute('aria-invalid');
        R('#hardware-id-error').textContent='';
        de(d=>{d.modules.find(m=>m.id===input.dataset.hardwareId).hardwareId=id});
      } catch(error){
        input.setCustomValidity(error.message);input.setAttribute('aria-invalid','true');
        R('#hardware-id-error').textContent=error.message;pe(error.message);
      }
    });
  }
  if(BA==='terminal-connections') renderTerminalConnections({root:R('#pane'),design:Y,resolve:id=>Me(Y,id),commit:de,download:nn});
  document.documentElement.dataset.uiMode=getUiMode(Y);
  if(isSimpleMode(Y)&&BA==="audit") BA="assembly";
  (document.documentElement.dataset.v5="1",window.__V5_BRIDGED__=1,window.__PANEL_STATE__={design:()=>Y,assembly:()=>kt,net:()=>Xe,issues:()=>Je,toast:pe,recompute:ra,studio:()=>qt,uiMode:()=>getUiMode(Y)},(()=>{try{mountV5Bridge({getDesign:()=>Y,getAssembly:()=>kt,getNet:()=>Xe,getIssues:()=>Je,toast:pe,persist:Y1,refresh:ra,selectCircuit:VA,screenshot:()=>qt?.screenshot()||null,standaloneHtml:standaloneHtmlString})}catch(err){document.documentElement.dataset.v5err=String(err&&err.message||err)}})()),R("#project-title").textContent=Y.name,R("#saved").textContent=K1,R("#supply").value=Y.supply,fillCabinetSelect(Y);{let sb=R("#source-badge-text");if(sb)sb.textContent=isSimpleMode(Y)?`${(Y.modules||[]).length} 个模块 · ${Y.circuits.length} 条回路`:`${(Y.loads||[]).filter(l=>!l.metadata).length} \u6761\u6e90\u8bb0\u5f55 \xB7 ${Y.circuits.length} \u56de\u8def`;}let a=kt.box.rows*kt.box.slots;R("#capacity").textContent=`${kt.modules} / ${a} M`,R("#capacity-bar").style.width=Math.min(100,kt.modules/a*100)+"%",R("#model-title").textContent=kt.box.name,R("#model-dimensions").textContent=`\u7BB1\u4F53 ${kt.box.width} \xD7 ${kt.box.height} \xD7 ${kt.box.depth} mm \xB7 ${kt.box.rows} \u6392 / ${kt.box.slots}P \xB7 ${kt.box.slots*18} mm`;let t=kt.nodes.filter(r=>r.overflow).length;R("#scope-label").textContent=`${Y.circuits.length} \u56DE\u8DEF \xB7 ${t?t+" \u4E2A\u5668\u4EF6\u672A\u88C5\u5165":"\u9ED1\u8FB9\u7070\u73BB\u7483"}`,R("#issue-count").textContent=`${Je.filter(r=>r.level==="error").length} \u9879\u9700\u4FEE\u6B63 \xB7 ${Je.filter(r=>r.level!=="error").length} \u9879\u5F85\u6838`,R("#footer-wiring").textContent=`${Xe.wires.filter(r=>r.connected).length} / ${Xe.wires.length} \u6761\u8FDE\u63A5 \xB7 N / PE \u5206\u79BB`,R("#undo").disabled=!Aa.length,R("#redo").disabled=!sn.length;let e=W1(Y,Y.circuits,Y.demand);R("#phase-values")&&(R("#phase-values").innerHTML=Qe.map(r=>`<div><div class="phase-value-head"><span style="color:${Ue[r]}">${r}</span><span>\u9700\u7528</span><strong class="${e[r]>Y.mainAmps?"error":""}">${e[r].toFixed(1)} A</strong></div><div class="phase-track"><i style="width:${Math.min(100,e[r]/Y.mainAmps*100)}%;background:${Ue[r]}"></i></div></div>`).join(""));R("#power")&&(R("#power").checked=Ge.power);R("#live-count")&&(R("#live-count").textContent=`${ts.live} / ${Y.circuits.length} \u56DE\u8DEF`);renderProtectSchematic();UA(),As(),rs(),WA(),Ye()}
function renderProtectSchematic(){const el=R("#protect-schematic");if(el){el.hidden=true;el.innerHTML="";}}
function UA(){document.querySelectorAll("[data-left]").forEach(t=>t.classList.toggle("active",t.dataset.left===pr));let a=mX.toLowerCase();if(R("#library-tools").hidden=pr!=="library",pr==="library"){let t=js(Y).filter(e=>(e.name+e.id+e.brand+gA(e)).toLowerCase().includes(a));R("#left-content").innerHTML=t.map(e=>`<div class="library-row">${an(e)}<div class="library-info"><strong>${it(e.name)}</strong><small>${it(e.brand)} \xB7 ${e.width} mm \xB7 ${e.modules} M</small><small>${it(gA(e))}${e.custom?" \xB7 \u7528\u6237\u5F55\u5165":e.historical?" \xB7 \u5386\u53F2\u76EE\u5F55":""}</small></div><div class="library-actions"><button class="ib" data-install="${e.id}" title="\u88C5\u5165\u6B64\u578B\u53F7" aria-label="\u88C5\u5165${it(e.name)}">${Ut("plus")}</button><button class="ib" data-product="${e.id}" title="\u4EA7\u54C1\u53C2\u6570">${Ut("arrow-up-right")}</button></div></div>`).join("")||'<p class="empty" style="padding:15px">\u65E0\u5339\u914D\u4EA7\u54C1</p>',document.querySelectorAll("[data-product]").forEach(e=>e.onclick=()=>Uo(e.dataset.product)),document.querySelectorAll("[data-install]").forEach(e=>e.onclick=()=>PX(e.dataset.install))}else{let t=allGroupsOf().map(e=>{let r=circuitsOfGroup(e.id).filter(s=>!a||(s.name+s.id+s.path).toLowerCase().includes(a));return r.length?`<button class="group-heading" data-group="${e.id}">${Ut(An.has(e.id)&&!a?"chevron-right":"chevron-down")}${Ut(e.icon)}${e.name}<small>${r.length}</small></button>`+(An.has(e.id)&&!a?"":r.map(s=>`<button class="tree-item ${es()?.id===s.id?"active":""}" data-circuit="${s.id}">
          <i class="dot ${Je.some(n=>n.circuit===s.id&&n.level==="error")?"error":ts.circuits[s.id]?.powered?"":"off"}"></i><span class="name">${it(s.name)}</span><span class="phase" style="color:${Ue[s.phase]||"#7b8c82"}">${s.voltage===380?"3\u03A6":Y.supply==="single"?"L1":s.phase}</span></button>`).join("")):""}).join("");R("#left-content").innerHTML=`<button class="group-heading" id="select-main">${Ut("git-branch")}\u603B\u5F00 <small>${Y.includeMain?Y.mainAmps+"A \xB7 \u6682\u5B9A":"\u672A\u88C5\u5165"}</small></button>${t}<div class="side-foot"><button id="manage-modules">${Ut("cpu")}共享模块 ${(Y.modules||[]).length}</button><button id="add-from-library">${Ut("plus")}从器件库增加设备</button>${ta(Y).length?`<p class="condition error">${ta(Y).length} \u6761\u8D1F\u8377\u5F85\u91CD\u65B0\u5206\u914D</p>`:""}</div>`,R("#select-main").onclick=()=>VA("Q0"),R("#manage-modules")&&(R("#manage-modules").onclick=()=>openModuleManager()),R("#add-from-library").onclick=()=>{pr="library",UA()},document.querySelectorAll("[data-group]").forEach(e=>e.onclick=()=>{An.has(e.dataset.group)?An.delete(e.dataset.group):An.add(e.dataset.group),UA(),Ye()}),document.querySelectorAll("[data-circuit]").forEach(e=>e.onclick=()=>VA(e.dataset.circuit))}Ye()}
function VX(a){const wireRange=Number.isFinite(a.minWire)&&Number.isFinite(a.maxWire)?`${a.minWire}\u2013${a.maxWire} mm\xB2`:'\u5F85\u6838';return`<div class="spec-row"><span>\u8BA2\u5355\u53F7</span><strong>${it(gA(a))}</strong></div><div class="spec-row"><span>\u54C1\u724C / \u578B\u53F7</span><strong>${it(a.brand)}<br>${it(a.name)}</strong></div>
  <div class="spec-row"><span>\u5B9E\u9645\u5BBD\u5EA6 / \u5360\u4F4D</span><strong>${a.width} mm / ${a.modules} M</strong></div>
  <div class="spec-row"><span>\u989D\u5B9A\u7535\u6D41</span><strong>${a.amps===null?"\u4E0D\u9002\u7528 \xB7 \u975E\u8D1F\u8F7D\u4E32\u8054\u5668\u4EF6":a.amps+" A"}</strong></div>
  ${a.residual?`<div class="spec-row"><span>\u5269\u4F59\u7535\u6D41\u4FDD\u62A4</span><strong>${a.rcdType} \xB7 ${a.residual} mA</strong></div>`:""}
  <div class="spec-row"><span>\u94DC\u786C\u7EBF\u7AEF\u5B50\u8303\u56F4</span><strong>${wireRange}</strong></div>
  ${a.icn?`<div class="spec-row"><span>Icn</span><strong>${a.icn} kA</strong></div>`:""}
  ${a.conditionalShort?`<div class="spec-row"><span>\u6761\u4EF6\u77ED\u8DEF\u7535\u6D41</span><strong>${a.conditionalShort} kA \xB7 \u975E\u72EC\u7ACB\u5206\u65AD\u80FD\u529B</strong></div>`:""}
  <p class="footnote" style="margin-top:10px">${it(a.availability)}</p>`}function As(){let a=es(),t=kt.nodes.find(f=>f.id===je)||a&&kt.nodes.find(f=>f.id===a.id);if(EA){let f=Xe.wires.find(c=>c.id===EA),u=Je.filter(c=>c.wire===f.id||c.text.includes(f.from)),p=fr(f.section,f.method||"B1",f.ambient||40,f.bunched||1,f.loaded||(Y.supply==="three"?3:2));return R("#inspector").innerHTML=`<section class="side-section"><div class="section-head"><h2>\u5BFC\u7EBF\u5C5E\u6027</h2><span class="tag">${f.conductor}</span></div>
    <div class="wire-inspector-end"><strong>FROM</strong><br>${it(f.from)}<br><strong>TO</strong><br>${it(f.to)}</div>
    <p class="tiny">${it(f.scope)}</p><div class="metric-pair"><div><small>\u5F53\u524D\u622A\u9762</small><strong>${f.section}</strong><em>mm\xB2</em></div><div><small>\u81EA\u52A8\u8BA1\u7B97</small><strong>${f.autoSection}</strong><em>mm\xB2</em></div></div>
    ${Bt("\u5BFC\u7EBF\u622A\u9762\u8986\u76D6",`<select id="wire-section">${re(bA.map(c=>[c,c+" mm\xB2"]),f.section)}</select>`)}
    <div class="spec-row"><span>\u5BFC\u4F53 / \u7EDD\u7F18</span><strong>${it(f.material)}</strong></div><div class="spec-row"><span>\u7AEF\u5B50\u5141\u8BB8\u6700\u5927\u622A\u9762</span><strong>${Math.min(Xe.ports[f.from].maxWire,Xe.ports[f.to].maxWire)} mm\xB2</strong></div>
    <div class="spec-row"><span>\u8FC7\u8F7D\u4FDD\u62A4\u57FA\u51C6</span><strong>${f.protect?f.protect+" A"+(f.downstreamProtection?" \xB7 \u4E0B\u6E38\u65AD\u8DEF\u5668":""):"PE \u4E0D\u8BBE\u5F00\u65AD\u4FDD\u62A4"}</strong></div>
    ${f.downstreamProtection?`<p class="condition">\u7BB1\u5185\u65E0\u5206\u652F\u77ED\u63A5\u7EBF\uFF1A\u77ED\u8DEF\u4FDD\u62A4\u4F9D\u8D56\u4E0A\u6E38 ${f.shortCircuitProtect}A \u603B\u5F00\uFF0C\u957F\u5EA6\u3001\u6577\u8BBE\u53CA\u70ED\u7A33\u5B9A\u672A\u6838\u5B9E\u3002</p>`:""}
    ${f.conductor!=="PE"?`<div class="spec-row"><span>\u672C\u7EBF\u6BB5\u4FEE\u6B63 Iz</span><strong>${p.toFixed(1)} A</strong></div><p class="condition">\u672C\u7EBF\u6BB5\uFF1A${Eo[f.method||"B1"]}\uFF0C${f.ambient||40}\xB0C\uFF0C${f.bunched||1} \u56DE\u8DEF\u3002\u5BF9\u5E94\u51FA\u7BB1\u7535\u7F06\u53E6\u6309\u56DE\u8DEF\u6761\u4EF6\u8BA1\u7B97\u3002\u7BB1\u5185\u70ED\u4E0E\u6210\u675F\u6761\u4EF6\u672A\u5B9E\u6D4B\u3002</p>`:'<p class="condition">PE \u6309\u652F\u8DEF\u7B49\u622A\u9762\u4E0E\u7AEF\u5B50\u8303\u56F4\u914D\u7F6E\uFF0C\u4E0D\u4F5C\u4E3A\u6B63\u5E38\u8F7D\u6D41\u56DE\u8DEF\u3002\u6545\u969C\u70ED\u7A33\u5B9A\u3001\u673A\u68B0\u9632\u62A4\u548C\u6210\u5957\u5B89\u88C5\u6761\u4EF6\u4ECD\u5F85\u6838\u3002</p>'}
    ${f.externalSection?`<p class="tiny">\u5BF9\u5E94\u51FA\u7BB1\u7535\u7F06\uFF1A${f.externalSection} mm\xB2\uFF0C\u7AEF\u5B50\u5185\u5916\u6BB5\u4E0D\u6DF7\u4E3A\u4E00\u6761\u672A\u7ECF\u6821\u6838\u7684\u7EBF\u3002</p>`:""}
    ${f.connected?"":'<p class="condition error">\u65AD N\u3001\u7F3A\u76F8\u6216\u65AD PE \u90FD\u4E0D\u80FD\u8BC1\u660E\u8D1F\u8F7D\u5DF2\u5B89\u5168\u65AD\u7535\u3002\u5FC5\u987B\u53E6\u884C\u786E\u8BA4\u6240\u6709\u5E26\u7535\u5BFC\u4F53\u7684\u72B6\u6001\u3002</p>'}
    <div class="tools" style="margin-top:18px"><button class="btn" id="wire-reset">${Ut("rotate-ccw")}\u81EA\u52A8\u503C</button><button class="btn ${f.connected?"":"primary"}" id="wire-toggle">${Ut(f.connected?"unplug":"plug")}${f.connected?"\u65AD\u5F00\u8FDE\u63A5":"\u6062\u590D\u8FDE\u63A5"}</button></div>
    ${u.map(c=>`<p class="condition error">${it(c.text)}</p>`).join("")}</section>
    <section class="side-section"><h3>\u8FDE\u63A5\u8FB9\u754C</h3><p class="condition">RCBO \u540E\u7684 N \u53EA\u8FDB\u5165\u672C\u56DE\u8DEF\u8D1F\u8F7D\uFF1BPE \u4E0D\u7ECF\u8FC7\u4EFB\u4F55\u65AD\u8DEF\u5668\u3001\u6F0F\u4FDD\u6216\u63A5\u89E6\u5668\u3002SPD \u4E3A\u5E76\u8054\u8BBE\u5907\uFF0C\u4EE5 PE \u4E3A\u6CC4\u653E\u7AEF\uFF0C\u4E0D\u6DFB\u52A0\u865A\u5047\u7684\u4E32\u8054\u8D1F\u8F7D\u51FA\u7EBF\u3002</p></section>`,R("#wire-section").onchange=c=>de(v=>v.wireOverrides[f.id]=+c.target.value),R("#wire-reset").onclick=()=>de(c=>delete c.wireOverrides[f.id]),R("#wire-toggle").onclick=()=>de(c=>{c.disconnected=f.connected?[...c.disconnected,f.id]:c.disconnected.filter(v=>v!==f.id)}),Ye()}if(!a){let f=t?.product;return R("#inspector").innerHTML=`<section class="side-section"><div class="section-head"><h2>${it(t?.label||"\u9879\u76EE\u6761\u4EF6")}</h2><span class="tag">${t?.id||"PROJECT"}</span></div>
      ${f?`<div class="inspector-top">${an(f)}<div><strong>${it(f.name)}</strong><small>${f.id}</small></div></div>${VX(f)}
      ${f.kind!=="spd"?`<label class="switch-label" style="margin-top:15px"><input id="node-on" class="switch" type="checkbox" ${Y.states[t.id]!==!1?"checked":""}>\u5408\u95F8 / \u6295\u5165</label>`:""}`:""}
      ${t?positionPanel(t.id):""}${t?.role==="module"?`<section class="side-section"><h3>通道备注</h3>${moduleAddressFields(t.module)}<div class="channel-label-grid">${Object.keys(t.module?.channelLabels||t.module?.channels||{}).length?Object.keys({...(t.module?.channels||{}),...(t.module?.channelLabels||{})}).sort((a,b)=>+a-+b).map(ch=>{const lab=t.module?.channelLabels?.[ch]||"";return Bt("CH"+ch,`<input data-insp-ch-label="${it(t.id)}" data-ch="${ch}" maxlength="80" value="${it(lab)}" placeholder="灯具 / 设备">`)}).join(""):"<p class=\"tiny\">无通道</p>"}</div>
      ${t.product.kind==='terminal'?'':Bt("对应支路空开（一对一）",`<select id="insp-mod-protect">${re(breakerOptions(t.id),t.module?.protectId||"")}</select>`)}
      <button class="btn" data-explode-module="${it(t.id)}" style="width:100%;margin-top:8px">单模块拆解与接线</button><button class="btn" id="edit-module" style="width:100%;margin-top:8px">${Ut("pencil")}编辑模块</button>${t.product.kind==='terminal'?`<button class="btn primary" data-terminal-connect="${it(t.id)}" style="width:100%;margin-top:8px">${Ut('cable')}连接端子</button>`:''}</section>`:""}<div class="tools" style="margin-top:15px"><button class="btn" id="device-library">${Ut("library")}\u5668\u4EF6\u5E93</button>${t?`<button class="btn danger" id="remove-device">${Ut("trash-2")}\u79FB\u9664\u8BBE\u5907</button>`:""}</div>
      <button class="btn" id="project-settings" style="width:100%;margin-top:12px">${Ut("settings-2")}\u7535\u6E90\u4E0E\u8BBE\u8BA1\u6761\u4EF6</button></section>
      <section class="side-section"><h3>N / PE 布局</h3><p class="condition">${Y.includeNeutralBar===false?"未安装零线排":"零线排："+(({top:"上方横装",bottom:"下方横装",left:"左侧竖装",right:"右侧竖装"})[Y.nBarPosition]||"下方横装")}；${Y.includeEarthBar===false?"未安装地线排":"PE 排在右侧，并与金属箱体、门跨接"}。灯线先上菲尼克斯端子，再跳到继电器。</p></section>`,R("#project-settings").onclick=yX,R("#device-library").onclick=()=>{pr="library",UA(),innerWidth<=650&&R(".left").classList.add("open")},R("#remove-device")?.addEventListener("click",()=>cX(t.id)),R("#edit-module")?.addEventListener("click",()=>{const m=Y.modules?.find(x=>x.id===t.id),p=Me(Y,m?.productId);m&&p&&openModuleDialog(p,m)}),R("#insp-mod-protect")?.addEventListener("change",ev=>{de(d=>setModuleProtect(d,t.id,ev.target.value||null),true);pe(ev.target.value?"已挂到共用保护 "+ev.target.value:"已取消共用保护")}),document.querySelectorAll("[data-insp-ch-label]").forEach(el=>el.addEventListener("change",()=>{const mid=el.dataset.inspChLabel,ch=+el.dataset.ch;de(d=>{const m=d.modules.find(x=>x.id===mid);if(!m)return;m.channelLabels=m.channelLabels||{};m.channelLabels[ch]=el.value.trim()},true)})),R("#node-on")?.addEventListener("change",u=>de(p=>p.states[t.id]=u.target.checked)),Ye()}let e=kA(Y,a),r=e.product,s=ka(Y,a),n=Je.filter(f=>f.circuit===a.id),o=js(Y).filter(f=>Mo(f,a.voltage)),i=Me(Y,a.rcdProductId),l=r.kind==="rcbo"?r:i;const deviceChain=(Array.isArray(a.devices)&&a.devices.length?a.devices:[{role:"protection",productId:a.productId},...(a.rcdProductId?[{role:"rcd",productId:a.rcdProductId}]:[])]).map(d=>{if(d.role==="protection")return `保护 · ${d.productId?it(gA(Me(Y,d.productId)||{id:d.productId})):"自动选型"}`;if(d.role==="rcd")return `漏保 · ${it(gA(Me(Y,d.productId)||{id:d.productId}))}`;if(d.role==="control"||d.role==="meter")return `${d.role==="meter"?"电表":"控制"} · ${it(d.moduleId)} CH${d.channel}`;return d.role}).join("<br>");R("#inspector").innerHTML=`
  ${t?.role==="branchRcd"?`<section class="side-section selected-part-spec"><div class="section-head"><h2>\u5F53\u524D\u68C0\u89C6\u90E8\u4EF6</h2><span class="tag">${t.id}</span></div>
    <div class="inspector-top">${an(t.product)}<div><strong id="current-part-name">${it(t.product.name)}</strong><small>${it(gA(t.product))}</small></div></div>
    <div class="spec-row"><span>\u5B9E\u9645\u5916\u5F62</span><strong>${t.product.width} \xD7 ${t.product.height} \xD7 ${t.product.depth} mm</strong></div>
    <button class="btn" id="inspect-part-source">${Ut("file-text")}\u6240\u9009\u90E8\u4EF6\u8D44\u6599</button></section>`:""}
  ${isSimpleMode(Y)?"":`<section class="side-section"><div class="section-head"><h2>器件链</h2><span class="tag">devices</span></div><p class="tiny">${deviceChain||"—"}</p><p class="lib-preview">控制/电表环节由共享模块通道分配产生；在「共享模块」中编辑。</p></section>`}
  <section class="side-section">
    <div class="section-head"><h2>\u56DE\u8DEF\u53C2\u6570</h2><span class="tag">${t?.id||a.id} \xB7 ${a.voltage===380?"3\u03A6":Y.supply==="single"?"L1":a.phase}</span></div>
    ${Bt("\u56DE\u8DEF\u540D\u79F0",`<input id="c-name" maxlength="80" value="${it(a.name)}">`)}
    <p class="tiny">${it(a.path)}</p>
    <div class="metric-pair full-only"><div><small>\u5DF2\u77E5\u6807\u79F0\u8D1F\u8377</small><strong>${(e.p/1e3).toFixed(2)}</strong><em>kW</em></div><div><small>\u8BBE\u8BA1\u7535\u6D41 Ib</small><strong>${e.ib.toFixed(2)}</strong><em>A</em></div></div>
    <div class="field-grid"><span class="full-only" style="display:contents">${Bt("\u529F\u7387\u56E0\u6570 cos\u03C6",`<select id="c-pf">${re([[.9,"0.90 \xB7 \u963B\u6027\u5047\u8BBE"],[.85,"0.85 \xB7 \u6DF7\u5408\u5047\u8BBE"],[.8,"0.80 \xB7 \u611F\u6027\u5047\u8BBE"],[1,"1.00 \xB7 \u5DF2\u786E\u8BA4"]],a.pf)}</select>`)}</span>
      ${Bt("\u56DE\u8DEF\u76F8\u4F4D",`<select id="c-phase" ${a.voltage===380||Y.supply==="single"?"disabled":""}>${re(a.voltage===380?[["ABC","\u4E09\u76F8 380 V"]]:Qe.map(f=>[f,f+" \xB7 220 V"]),a.phase)}</select>`)}
    </div>
    <div class="formula full-only">${e.p} \xF7 (${a.voltage===380?"\u221A3 \xD7 380":"220"} \xD7 ${a.pf}) = ${e.ib.toFixed(2)} A<br>Ib \u2264 In \u2264 Iz</div>
    <label class="switch-label"><input id="c-on" class="switch" type="checkbox" ${a.on?"checked":""}>\u56DE\u8DEF\u5408\u95F8 <span class="tiny">${KU(a)}</span></label>
    ${t?positionPanel(t.id):""}<div class="tools" style="margin-top:14px"><button class="btn" id="device-library">${Ut("library")}\u589E\u52A0\u8BBE\u5907</button><button class="btn danger" id="remove-device">${Ut("trash-2")}\u79FB\u9664${t?.role==="branchRcd"?"\u6F0F\u4FDD":"\u8BBE\u5907"}</button></div>
  </section>
  <section class="side-section">
    <div class="section-head"><h2>\u4FDD\u62A4\u5668\u4EF6</h2><button class="ib" id="inspect-product" title="\u5B98\u65B9\u53C2\u6570\u8BC1\u636E">${Ut("file-text")}</button></div>
    <div class="inspector-top">${an(r)}<div><strong>${it(r.name)}</strong><small>${it(r.brand)}</small></div></div>
    ${Bt("\u5173\u8054\u5668\u4EF6\u5E93\u578B\u53F7",`<select id="c-product">${re([["auto","\u81EA\u52A8\u5339\u914D \xB7 "+r.name],...o.map(f=>[f.id,f.name+" / "+f.brand+(f.custom?" \xB7 \u7528\u6237\u5F55\u5165":"")])],a.productId||"auto")}</select>`)}
    <div class="spec-row"><span>\u989D\u5B9A\u7535\u6D41 In / \u5360\u4F4D</span><strong>${r.amps} A / ${r.width} mm</strong></div>
    <div class="spec-row"><span>\u6F0F\u7535\u4FDD\u62A4</span><strong>${l?l.rcdType+" / "+l.residual+"mA":"\u672A\u914D\u7F6E \xB7 \u9700\u8981\u4FEE\u6B63"}</strong></div>
    ${r.kind!=="rcbo"?Bt("\u5173\u8054 RCCB \xB7 \u987B\u540C\u65F6\u4FDD\u7559\u8FC7\u8F7D\u4FDD\u62A4",`<select id="c-rcd">${re([["none","\u672A\u914D\u7F6E"],...js(Y).filter(f=>f.kind==="rccb"&&f.poles===(a.voltage===380?4:2)).map(f=>[f.id,f.name+" / "+f.brand])],a.rcdProductId||"none")}</select>`):""}
    ${a.voltage===380?'<p class="condition warn">\u4E09\u76F8\u9A71\u52A8\u5668\u7684\u5269\u4F59\u7535\u6D41\u7C7B\u578B\u4ECD\u987B\u6838\u5382\u5BB6\u8981\u6C42\uFF0CA-SI \u4E0D\u80FD\u66FF\u4EE3\u53EF\u80FD\u8981\u6C42\u7684 B \u578B\u3002</p>':""}
    <button id="trip" class="btn full-only" style="width:100%;margin-top:12px" ${!Ge.power||!l?"disabled":""}>${Ut("shield-alert")}${Ge.trip===a.id?"\u590D\u4F4D\u6A21\u62DF\u8DF3\u95F8":"\u6F0F\u7535\u4FDD\u62A4\u529F\u80FD\u6F14\u793A"}</button>
  </section>
  <section class="side-section full-only">
    <div class="section-head"><h2>\u51FA\u7BB1\u7EBF\u7F06\u5339\u914D</h2><span class="tag ${e.valid?"":"error"}">${e.valid?"\u6761\u4EF6\u521D\u7B5B":"\u9700\u4FEE\u6B63"}</span></div>
    ${Bt("\u6577\u8BBE\u65B9\u5F0F",`<select id="c-method">${re(Object.entries(Eo),a.method)}</select>`)}
    <div class="field-grid">${Bt("\u73AF\u5883\u6E29\u5EA6",`<select id="c-temp">${re(Object.keys(Yr).map(f=>[f,f+" \xB0C"]),a.ambient)}</select>`)}
    ${Bt("\u6210\u675F\u56DE\u8DEF\u6570",`<select id="c-bunched">${re(Object.keys(_r).map(f=>[f,f+" \u56DE\u8DEF"]),a.bunched)}</select>`)}</div>
    <div class="field-grid">${Bt("\u5355\u7A0B\u957F\u5EA6",TA("c-length",a.length,"m",1,500))}
      ${Bt("\u5BFC\u7EBF\u622A\u9762",`<select id="c-wire">${re([["auto","\u81EA\u52A8 \xB7 "+e.section+" mm\xB2"],...bA.map(f=>[f,f+" mm\xB2"])],a.wire||"auto")}</select>`)}</div>
    <div class="spec-row"><span>\u7535\u7F06\u89C4\u683C</span><strong>${e.cable}</strong></div>
    <div class="spec-row"><span>\u4FEE\u6B63\u8F7D\u6D41\u91CF Iz</span><strong>${e.iz.toFixed(1)} A</strong></div>
    <div class="spec-row"><span>\u8F7D\u6D41\u5BFC\u4F53\u6570</span><strong>${e.loaded} \u6839 \xB7 N/PE \u4E0D\u7F29\u622A\u9762</strong></div>
    <div class="spec-row"><span>\u672B\u7AEF\u538B\u964D\u521D\u4F30</span><strong>${e.drop.toFixed(2)} %</strong></div>
    <p class="condition">Cu/PVC 70\xB0C \u8868\u503C \xD7 \u6E29\u5EA6\u4FEE\u6B63 \xD7 \u6210\u675F\u7CFB\u6570\u3002\u03C1=0.0225 \u4E3A\u94DC\u7EBF\u5DE5\u4F5C\u6E29\u5EA6\u8BA1\u7B97\u5047\u8BBE\uFF1B\u538B\u964D\u4EC5\u672C\u56DE\u8DEF\u7535\u963B\u521D\u4F30\uFF0C\u672A\u53E0\u52A0\u5165\u6237/\u5E72\u7EBF\u3002</p>
    ${e.unknown?`<p class="condition warn">${e.unknown} \u4E2A\u96F6\u529F\u7387\u63D2\u5EA7\u9884\u7559\u5F85\u8865\u5BB9\u91CF\u3002</p>`:""}
  </section>
  <section class="side-section full-only">
    <div class="section-head"><h2>\u8D1F\u8377\u6765\u6E90</h2><span class="tag">${s.length} \u6761</span></div>
    ${s.slice(0,8).map(f=>`<div class="spec-row"><span>${it(f.name)}</span><strong>${f.enabled?f.watts+" W":"\u4E0D\u8BA1\u5165"}<br><small>${f.powerCell||"\u81EA\u5B9A\u4E49"}</small></strong></div>`).join("")}
    ${s.length>8?`<p class="tiny">\u53E6 ${s.length-8} \u6761\uFF0C\u89C1\u6E90\u8868\u6620\u5C04\u3002</p>`:""}
    ${n.slice(0,3).map(f=>`<p class="condition ${f.level==="error"?"error":"warn"}">${it(f.text)}</p>`).join("")}
  </section>`;let d=(f,u,p=!1)=>de(c=>c.circuits.find(v=>v.id===a.id)[f]=u,p);R("#c-name").onchange=f=>d("name",f.target.value.trim()||a.name),R("#c-pf")&&(R("#c-pf").onchange=f=>d("pf",+f.target.value)),R("#c-phase").onchange=f=>d("phase",f.target.value,!0),R("#c-on").onchange=f=>d("on",f.target.checked),R("#c-product").onchange=f=>{let u=f.target.value==="auto"?null:f.target.value;de(p=>{let c=p.circuits.find(v=>v.id===a.id);c.productId=u,(Me(p,u)||kA(p,c).product).kind==="rcbo"&&(c.rcdProductId=null)},!0)},R("#c-rcd")?.addEventListener("change",f=>d("rcdProductId",f.target.value==="none"?null:f.target.value,!0)),R("#c-method")&&(R("#c-method").onchange=f=>d("method",f.target.value)),R("#c-temp")&&(R("#c-temp").onchange=f=>d("ambient",+f.target.value)),R("#c-bunched")&&(R("#c-bunched").onchange=f=>d("bunched",+f.target.value)),R("#c-length")&&kU("#c-length",1,500,f=>d("length",f)),R("#c-wire")&&(R("#c-wire").onchange=f=>d("wire",f.target.value==="auto"?null:+f.target.value)),R("#inspect-product").onclick=()=>Uo(r.id),R("#inspect-part-source")?.addEventListener("click",()=>Uo(t.product.id)),R("#remove-device").onclick=()=>cX(t?.id||a.id),R("#device-library").onclick=()=>{pr="library",UA(),innerWidth<=650&&R(".left").classList.add("open")},R("#trip").onclick=()=>{Ge.trip=Ge.trip===a.id?null:a.id,ra()},Ye()}function $a(a,t){return`<div class="table-wrap"><table><thead><tr>${a.map(e=>`<th>${e}</th>`).join("")}</tr></thead><tbody>${t.join("")}</tbody></table></div>`}function rs(){document.querySelectorAll("[data-tab]").forEach(a=>a.classList.toggle("active",a.dataset.tab===BA)),R("#pane").classList.toggle("active",BA!=="assembly"),R("#overlay").style.display=BA==="assembly"?"":"none",R("#canvas").style.visibility=BA==="assembly"?"visible":"hidden",BA!=="assembly"&&(BA==="wiring"&&EX(),BA==="schedule"&&J1(),BA==="audit"&&MX(),Ye())}function EX(){let a=je==="Q0"?null:es()||Y.circuits[0];if(!a&&je!=="Q0"){R("#pane").innerHTML=`<div class="pane-head"><h2>\u7AEF\u5B50\u63A5\u7EBF</h2><button class="btn" id="empty-library">${Ut("plus")}\u5668\u4EF6\u5E93</button></div><p class="empty">\u5C1A\u65E0\u672B\u7AEF\u8BBE\u5907\u3002\u6E90\u8868\u8D1F\u8377\u4ECD\u4FDD\u7559\uFF0C\u7B49\u5F85\u5206\u914D\u3002</p>${$a(["\u8D77\u70B9","\u7EC8\u70B9","\u5BFC\u4F53"],Xe.wires.map(r=>`<tr><td>${it(r.from)}</td><td>${it(r.to)}</td><td>${r.conductor}</td></tr>`))}`,R("#empty-library").onclick=()=>{pr="library",UA(),innerWidth<=650&&R(".left").classList.add("open")};return}let t=a?yo(Xe,Y,a.id):new Set(Xe.wires.filter(r=>!r.circuit).map(r=>r.id)),e=Xe.wires.filter(r=>k1||t.has(r.id));R("#pane").innerHTML=`<div class="pane-head"><div><h2>\u7AEF\u5B50\u63A5\u7EBF</h2><p>${a?`${a.id} \xB7 ${it(a.name)} \xB7 ${a.voltage} V`:`Q0 \xB7 ${Y.supply==="three"?"\u4E09\u76F8 4P \xB7 L1/L2/L3/N":"\u5355\u76F8 2P \xB7 L/N"}`} \xB7 \u5B8C\u6574\u8FDE\u63A5 ${Xe.wires.length} \u6761</p></div><button class="btn" id="wires-csv">${Ut("download")}\u63A5\u7EBF\u8868</button></div>
    <div class="schematic-wrap">${nX(Xe,Y,ts,Ge,a)}</div>
    <p class="data-note" style="margin:0 0 17px">\u89C6\u56FE\u6298\u53E0\u5206\u914D\u7AEF\u5B50\uFF1B\u4E0B\u8868\u4FDD\u7559\u9010\u7AEF\u5B50\u8FDE\u63A5\u3002\u96F6\u7EBF\u7ECF\u8FC7\u672C\u56DE\u8DEF\u4FDD\u62A4\u5668\u540E\u53EA\u5230\u8D1F\u8F7D\uFF1BPE \u7ED5\u8FC7\u6240\u6709\u5F00\u65AD\u5668\u4EF6\u3002\u8BBE\u5907\u4FE1\u53F7\u8F85\u52A9\u89E6\u70B9\u3001\u8FC7\u6B20\u538B\u6A21\u5757\u53CA\u65BD\u5DE5\u7AEF\u5B50\u7F16\u53F7\u4ECD\u987B\u5382\u5BB6\u6DF1\u5316\u3002</p>
    <label class="switch-label" style="font-size:11px;margin-bottom:14px"><input class="switch" id="all-wires" type="checkbox" ${k1?"checked":""}>\u663E\u793A\u5168\u67DC\u8FDE\u63A5 <span class="tiny">${e.length} \u6761</span></label>
    ${$a(["\u5BFC\u4F53","\u8D77\u70B9\u7AEF\u5B50","\u7EC8\u70B9\u7AEF\u5B50","\u622A\u9762","\u7528\u9014","\u72B6\u6001",""],e.map(r=>`<tr class="${EA===r.id?"selected":""}"><td><span style="color:${Ue[r.conductor]}">${r.conductor}</span></td><td><button class="link" data-wire="${it(r.id)}">${it(r.from)}</button></td><td>${it(r.to)}</td><td>${r.section} mm\xB2</td><td>${it(r.scope)}</td><td>${r.connected?"\u5DF2\u8FDE\u63A5":"\u65AD\u5F00"}</td><td><button class="ib" data-wire-toggle="${it(r.id)}" title="${r.connected?"\u65AD\u5F00":"\u6062\u590D"}">${Ut(r.connected?"unplug":"plug")}</button></td></tr>`))}
    <p class="data-note">\u5165\u6237\u7535\u7F06\u4E0E\u7BB1\u5185\u8FDE\u63A5\u91C7\u7528\u5404\u81EA\u8BA1\u7B97\u6761\u4EF6\u3002\u84DD\u8272\u4E3A N\uFF0C\u9EC4\u7EFF\u53CC\u8272\u4E3A PE\uFF1B\u5206\u914D\u7AEF\u5B50/\u7AEF\u5B50\u6392\u8FD8\u9700\u6309\u7535\u6D41\u3001\u7EBF\u5F84\u3001\u5B54\u6570\u548C\u6BCF\u5B54\u5BFC\u7EBF\u6570\u91CF\u843D\u5B9E\u771F\u5B9E\u9644\u4EF6\u9009\u578B\u3002</p>`,R("#all-wires").onchange=r=>{k1=r.target.checked,EX(),Ye()},R("#wires-csv").onclick=wX,document.querySelectorAll("[data-wire]").forEach(r=>r.onclick=()=>bX(r.dataset.wire)),document.querySelectorAll("[data-wire-toggle]").forEach(r=>r.onclick=()=>{let s=r.dataset.wireToggle;de(n=>n.disconnected=n.disconnected.includes(s)?n.disconnected.filter(o=>o!==s):[...n.disconnected,s])})}function J1(){
  if(isSimpleMode(Y)){
    if(Ja==="loads"||Ja==="circuits") Ja="channels";
    const feeds=new Map(resolveModuleFeedBindings(kt,Y).map(b=>[b.moduleId,b]));
    const rows=buildChannelRows(Y,id=>Me(Y,id)).map(r=>({...r,breaker:feeds.get(r.moduleId)?.breakerId||r.breaker}));
    let t="";
    if(Ja==="channels"){
      t=$a(["模块","名称","型号","通道","备注","端子","对应空开","关联漏保"],rows.map(r=>`<tr>
        <td><button class="link" data-select="${it(r.moduleId)}">${it(r.moduleId)}</button></td>
        <td>${it(r.moduleLabel)}</td><td>${it(r.productName)}</td>
        <td>${r.channel===""?"—":"CH"+r.channel}</td>
        <td><input data-ch-row="${it(r.moduleId)}" data-ch="${r.channel}" value="${it(r.label)}" maxlength="80" ${r.channel===""?"disabled":""}></td>
        <td>${it(r.terminal||"—")}</td>
        <td>${it(r.breaker||"—")}</td><td>${it(r.rcd||"—")}</td></tr>`));
    } else {
      let e=new Map;kt.nodes.forEach(r=>{let s=r.product.id;e.has(s)?e.get(s).count++:e.set(s,{product:r.product,count:1})});
      t=$a(["产品","订单号","数量","宽度","模数"],[...e.values()].map(({product:r,count:s})=>`<tr><td><button class="link" data-product="${r.id}">${it(r.name)}</button></td><td>${it(gA(r))}</td><td>${s}</td><td>${r.width??"—"} mm</td><td>${(r.modules||0)*s} M</td></tr>`));
    }
    R("#pane").innerHTML=`<div class="pane-head"><div><h2>通道与设备</h2><p>${(Y.modules||[]).length} 个模块 · ${rows.filter(r=>r.label).length} 条已备注通道</p></div>
      <div class="tools"><button id="schedule-csv" class="btn">${Ut("download")}通道清单 CSV</button></div></div>
      <div class="subnav"><button data-data="channels" class="${Ja==="channels"?"active":""}">通道清单</button><button data-data="bom" class="${Ja==="bom"?"active":""}">器件清单</button></div>
      ${t}<p class="data-note">每个模块对应一个支路空开，总空开为上游。未指定时按安装顺序对应。</p>`;
    document.querySelectorAll("[data-data]").forEach(e=>e.onclick=()=>{Ja=e.dataset.data,J1(),Ye()});
    document.querySelectorAll("[data-select]").forEach(e=>e.onclick=()=>{VA(e.dataset.select),innerWidth<=1e3&&R(".right").classList.add("open")});
    document.querySelectorAll("[data-product]").forEach(e=>e.onclick=()=>Uo(e.dataset.product));
    document.querySelectorAll("[data-ch-row]").forEach(el=>el.onchange=()=>{
      const mid=el.dataset.chRow, ch=+el.dataset.ch;
      de(d=>{const m=d.modules.find(x=>x.id===mid); if(!m)return; m.channelLabels=m.channelLabels||{}; m.channelLabels[ch]=el.value.trim()},true);
    });
    R("#schedule-csv").onclick=()=>nn(Y.name+"-通道清单.csv", channelRowsToCsv(buildChannelRows(Y,id=>Me(Y,id))), "text/csv;charset=utf-8");
    return;
  }
  let a=Y.loads.filter(e=>e.enabled).reduce((e,r)=>e+r.watts,0),t="";if(Ja==="circuits")t=$a(["\u56DE\u8DEF","\u6846\u67B6\u5206\u533A","\u7535\u6E90","\u8D1F\u8377","cos\u03C6","Ib / In / Iz","\u51FA\u7BB1\u7535\u7F06","\u72B6\u6001"],Y.circuits.map(e=>{let r=kA(Y,e);return`<tr class="${es()?.id===e.id?"selected":""}">
        <td><button class="link" data-select="${e.id}">${e.id} ${it(e.name)}</button></td><td>${groupOf(Y,e.group).short}</td><td>${e.voltage===380?"380 V / 3\u03A6":"220 V / "+(Y.supply==="single"?"L1":e.phase)}</td>
        <td>${(r.p/1e3).toFixed(2)} kW</td><td>${e.pf.toFixed(2)}</td><td>${r.ib.toFixed(1)} / ${r.product.amps} / ${r.iz.toFixed(1)} A</td><td>${r.cable}</td>
        <td>${Je.some(s=>s.circuit===e.id&&s.level==="error")?"\u9700\u4FEE\u6B63":r.unknown?"\u8D1F\u8377\u5F85\u5B9A":"\u6761\u4EF6\u521D\u7B5B"}</td></tr>`}));else if(Ja==="loads")t=$a(["\u8BA1\u5165","\u6E90\u884C","\u533A\u57DF","\u8BBE\u5907 / \u70B9\u4F4D","\u529F\u7387 W","\u6E90\u8868 W","V","\u6E90\u8868\u8FDE\u63A5","\u8BBE\u8BA1\u8FDE\u63A5","\u6240\u5C5E\u56DE\u8DEF"],Y.loads.map(e=>`<tr><td><input data-load-enabled="${e.id}" type="checkbox" ${e.enabled?"checked":""} ${e.metadata?"disabled":""} aria-label="\u8BA1\u5165${it(e.name)}"></td>
        <td class="source-cell">${e.powerCell||"\u81EA\u5B9A\u4E49"}</td><td>${it(e.zone)}</td><td>${it(e.name)}</td>
        <td><input data-load-watts="${e.id}" value="${e.watts}" type="number" min="0" max="100000" ${e.metadata?"disabled":""} aria-label="${it(e.name)}\u529F\u7387"></td><td>${Js.loads.find(r=>r.id===e.id)?.watts??"\u2014"}</td><td>${e.voltage}</td>
        <td>${it(e.socket)}</td><td>${e.metadata?"\u2014":`<select data-connection="${e.id}" aria-label="${it(e.name)}\u8BBE\u8BA1\u8FDE\u63A5">${re([["","\u6309\u6E90\u8868"],...[16,20,25,32,40,63,80,100,125].map(r=>[r,"\u56FA\u5B9A\u63A5\u7EBF \u2265"+r+"A"])],Y.connections?.[e.id]?.amps||"")}</select>`}</td>
        <td>${e.metadata?"Q0 \xB7 \u603B\u5F00 / \u7BB1\u4F53\u5143\u4FE1\u606F":`<select data-load-circuit="${e.id}" aria-label="${it(e.name)}\u6240\u5C5E\u56DE\u8DEF">${re([["","\u672A\u5206\u914D"],...Y.circuits.filter(r=>r.voltage===e.voltage).map(r=>[r.id,r.id+" "+r.name])],Y.circuits.find(r=>r.loadIds.includes(e.id))?.id||"")}</select>`}</td></tr>`));else{let e=new Map;kt.nodes.forEach(r=>{let s=r.product.id;e.has(s)?e.get(s).count++:e.set(s,{product:r.product,count:1})}),t=$a(["\u4EA7\u54C1","\u8BA2\u5355\u53F7","\u6570\u91CF","\u5B9E\u9645\u5BBD\u5EA6","\u5408\u8BA1\u6A21\u6570","\u4F9D\u636E"],[...e.values()].map(({product:r,count:s})=>`<tr><td><button class="link" data-product="${r.id}">${it(r.name)}</button></td><td>${it(gA(r))}</td><td>${s}</td><td>${r.width} mm</td><td>${r.modules*s} M</td><td>${it(r.source.file)} p.${r.source.pages}</td></tr>`)),t+=`<p class="data-note">\u53E6\u542B ${kt.box.name} 1 \u53F0\u3001\u5BFC\u8F68 ${kt.box.rows} \u6761\u3001\u4E00\u6761 N \u6392\u4E0E\u4E00\u6761 PE \u6392\u3001\u5206\u914D\u7AEF\u5B50\u3001\u51FA\u7BB1\u7AEF\u5B50\u4E0E\u95E8\u8DE8\u63A5\u3002N/PE \u6BCF\u56DE\u8DEF\u91C7\u7528\u72EC\u7ACB\u7AEF\u5B50\u7F16\u53F7\uFF1B\u5B9E\u9645\u9644\u4EF6\u7684\u989D\u5B9A\u7535\u6D41\u3001\u5B54\u6570\u3001\u5B89\u88C5\u548C\u8BA2\u5355\u53F7\u4ECD\u987B\u5382\u5BB6\u786E\u8BA4\u3002</p>`}R("#pane").innerHTML=`<div class="pane-head"><div><h2>\u56DE\u8DEF\u4E0E\u8D1F\u8377</h2><p>${Y.circuits.length} \u6761\u56DE\u8DEF \xB7 \u5F53\u524D\u8BA1\u5165 ${(a/1e3).toFixed(2)} kW \xB7 \u539F\u8868 56.10 kW</p></div>
    <div class="tools"><button id="add-circuit" class="btn">${Ut("plus")}\u56DE\u8DEF</button><button id="schedule-csv" class="btn">${Ut("download")}CSV</button></div></div>
    <div class="subnav"><button data-data="circuits" class="${Ja==="circuits"?"active":""}">\u56DE\u8DEF\u8BA1\u7B97</button><button data-data="loads" class="${Ja==="loads"?"active":""}">117 \u6761\u6E90\u8868\u6620\u5C04</button><button data-data="bom" class="${Ja==="bom"?"active":""}">\u5668\u4EF6\u6E05\u5355</button></div>
    ${ta(Y).length?`<div class="callout">${ta(Y).length} \u6761\u6E90\u8868\u8D1F\u8377\u5C1A\u672A\u5206\u914D\uFF0C\u5C1A\u672A\u8BA1\u5165\u5DF2\u88C5\u56DE\u8DEF\u3002</div>`:""}${t}<p class="data-note">\u6807\u79F0\u8D1F\u8377\u6765\u81EA\u6E90\u8868\u6216\u7F16\u8F91\u503C\uFF0C\u4E0D\u662F\u4FDD\u62A4\u5668\u4EF6\u7684\u56FA\u6709\u53C2\u6570\u30020 W \u9884\u7559\u63D2\u5EA7\u3001\u8BBE\u5907\u91CD\u590D\u8FB9\u754C\u548C\u9505\u7089\u8F93\u5165\u529F\u7387\u9700\u8981\u786E\u8BA4\uFF1B\u672A\u7B7E\u8BA4\u6570\u636E\u4E0D\u5F97\u636E\u6B64\u76F4\u63A5\u65BD\u5DE5\u3002</p>`,document.querySelectorAll("[data-data]").forEach(e=>e.onclick=()=>{Ja=e.dataset.data,J1(),Ye()}),document.querySelectorAll("[data-select]").forEach(e=>e.onclick=()=>{VA(e.dataset.select),innerWidth<=1e3&&R(".right").classList.add("open")}),document.querySelectorAll("[data-product]").forEach(e=>e.onclick=()=>Uo(e.dataset.product)),document.querySelectorAll("[data-load-enabled]").forEach(e=>e.onchange=r=>de(s=>s.loads.find(n=>n.id===e.dataset.loadEnabled).enabled=r.target.checked)),document.querySelectorAll("[data-load-watts]").forEach(e=>e.onchange=r=>{let s=r.target.valueAsNumber;if(!Number.isFinite(s)||s<0||s>1e5){pe("\u8D1F\u8377\u5E94\u5728 0\u2013100000 W \u8303\u56F4\u5185"),J1();return}de(n=>n.loads.find(o=>o.id===e.dataset.loadWatts).watts=s)}),document.querySelectorAll("[data-load-circuit]").forEach(e=>e.onchange=r=>{let s=e.dataset.loadCircuit,n=r.target.value;de(o=>{o.circuits.forEach(i=>i.loadIds=i.loadIds.filter(l=>l!==s)),n&&o.circuits.find(i=>i.id===n).loadIds.push(s)},!0)}),document.querySelectorAll("[data-connection]").forEach(e=>e.onchange=r=>de(s=>{s.connections??(s.connections={}),r.target.value?s.connections[e.dataset.connection]={mode:"fixed",amps:+r.target.value}:delete s.connections[e.dataset.connection]})),R("#add-circuit").onclick=JU,R("#schedule-csv").onclick=zX}function MX(){let a="";zr==="issues"?a=`<div class="callout">\u6709\u9650\u89C4\u5219\u68C0\u67E5\u4E0D\u80FD\u7ED9\u51FA\u56FD\u5BB6\u6807\u51C6\u201C\u6574\u4F53\u5408\u683C\u201D\u7ED3\u8BBA\u3002\u7EA2\u8272\u9879\u5FC5\u987B\u4FEE\u6B63\uFF0C\u5F85\u6838\u9879\u9700\u8981\u73B0\u573A\u8F93\u5165\u3001\u94ED\u724C\u6216\u5382\u5BB6\u786E\u8BA4\u3002</div>
    <div class="issues">${Je.map(t=>`<div class="issue ${t.level}"><div class="issue-head">${Ut(t.level==="error"?"circle-x":"clipboard-clock")}<strong>${t.level==="error"?"\u9700\u8981\u4FEE\u6B63":"\u5F85\u6838\u5B9E"}</strong>${t.circuit?`<button class="link" data-select="${t.circuit}">${t.circuit}</button>`:""}</div><p>${it(t.text)}</p></div>`).join("")}</div>`:zr==="framework"?a=`<p class="data-note" style="margin-bottom:18px">\u6846\u67B6\u6765\u6E90\uFF1A\u7535\u7BB1\u5E03\u5C40\u6846\u67B6.xlsx\uFF0CSheet1!A2:U2\u3002\u5206\u533A\u680F\u76EE\u4E0D\u662F 21 \u4E2A\u4E92\u76F8\u72EC\u7ACB\u7684\u672B\u7AEF\u56DE\u8DEF\uFF1B\u4E0B\u7EA7\u6309\u8BBE\u5907\u72EC\u7ACB\u4F9B\u7535\u4E0E\u4FDD\u62A4\u9700\u6C42\u5C55\u5F00\u3002</p>
    ${$a(["\u6E90\u680F\u76EE","\u672C\u7248\u6620\u5C04"],Js.framework.map((t,e)=>`<tr><td>${String.fromCharCode(65+e)}2 \xB7 ${it(t)}</td><td>${it(jU(t))}</td></tr>`))}`:a=`<div class="sources-grid">
    <section class="source-item"><h3>\u4F4F\u5B85\u9879\u76EE\u89C4\u8303\u6838\u5BF9</h3><p>GB 55038-2025 \u7B2C 7.4.3 \u6761\uFF08\u653F\u5E9C\u516C\u5F00 PDF \u7B2C 24 \u9875\uFF0C\u6B63\u6587\u7B2C 21 \u9875\uFF09\u5DF2\u89C6\u89C9\u590D\u6838\uFF1A\u8FDB\u7EBF\u5F00\u5173\u540C\u65F6\u65AD\u5F00\u76F8\u7EBF\u548C N\uFF0C\u5E76\u5177\u6709\u9694\u79BB\u529F\u80FD\uFF1B\u63D2\u5EA7\u56DE\u8DEF\u5E94\u6709\u4E0D\u5927\u4E8E 30mA \u7684\u5269\u4F59\u7535\u6D41\u4FDD\u62A4\u3002\u672C\u7248\u53E6\u5BF9\u5168\u90E8\u672B\u7AEF\u4F4E\u529F\u7387\u56DE\u8DEF\u91C7\u7528\u72EC\u7ACB\u5269\u4F59\u7535\u6D41\u4FDD\u62A4\u3002</p><button class="btn" data-asset="standard">\u67E5\u770B\u6761\u6587\u8BC1\u636E</button></section>
    <section class="source-item"><h3>N \u4E0E PE \u7684\u8FB9\u754C</h3><p>GB 55024-2022 \u7B2C 8.4.4 \u6761\uFF0C\u653F\u5E9C\u516C\u5F00 PDF \u7B2C 33 \u9875\u3001\u6B63\u6587\u7B2C 29 \u9875\u5DF2\u89C6\u89C9\u6838\u5BF9\uFF1AN \u6392\u5BF9\u91D1\u5C5E\u5B89\u88C5\u677F\u7EDD\u7F18\uFF0CPE \u6392\u4E0E\u91D1\u5C5E\u677F\u7535\u6C14\u8FDE\u63A5\uFF1B\u4E0D\u540C\u56DE\u8DEF N \u6216 PE \u4E0D\u5F97\u540C\u5B54/\u540C\u7AEF\u5B50\u3002\u6A21\u578B\u4E3A\u6BCF\u56DE\u8DEF\u5206\u914D\u72EC\u7ACB\u5B54\u4F4D\uFF0C\u5185\u90E8\u6BCD\u6392\u4FDD\u6301\u5404\u81EA\u7535\u6C14\u8FDE\u7EED\uFF0C\u4E0D\u6DF7\u63A5 N \u4E0E PE\u3002</p><p>\u6B64\u6761\u5E76\u672A\u7ED9\u51FA\u7EDF\u4E00\u7684\u4E24\u6392\u6700\u5C0F\u6BEB\u7C73\u8DDD\u79BB\uFF1B\u5177\u4F53\u6784\u9020\u3001\u7535\u6C14\u95F4\u9699\u548C\u578B\u5F0F\u8BD5\u9A8C\u4ECD\u987B\u5382\u5BB6\u6838\u5B9A\u3002</p><button class="btn" data-asset="npe">\u67E5\u770B N / PE \u6761\u6587</button></section>
    <section class="source-item"><h3>\u7BB1\u4F53\u5C3A\u5BF8\u4E0E\u5916\u89C2</h3><p>\u739B\u5FB7\u514B\u62A5\u4EF7\u5355\u7B2C 4\u20135 \u9875\u3001\u624B\u518C PDF \u7B2C 33\u300142\u300146 \u9875\u3002\u7BB1\u4F53\u5C3A\u5BF8\u76F4\u63A5\u5F55\u5165\u4EA7\u54C1\u6570\u636E\uFF1B\u5BFC\u8F68\u6392\u6570\u6309\u603B\u6A21\u6570\u53CA 24P \u5BFC\u8F68\u7EC4\u5408\u3002\u5BFC\u8F68\u4E2D\u5FC3\u3001\u63A5\u7EBF\u9644\u4EF6\u4E0E\u5185\u90E8\u652F\u67B6\u4F4D\u7F6E\u4ECD\u4E3A\u88C5\u914D\u6DF1\u5316\uFF0C\u4E0D\u5192\u5145\u5B8C\u6574\u5382\u5BB6 CAD\u3002</p><img src="${To.cabinet}" alt="\u5BB6\u7528\u7BB1\u4F53\u4EA7\u54C1\u5C3A\u5BF8\u9875"><button class="btn" data-asset="cabinet">\u4EA7\u54C1\u9875\u9884\u89C8</button></section>
    <section class="source-item"><h3>\u539F\u56FE\u5BA1\u67E5</h3><p>\u672A\u81EA\u52A8\u5F55\u5165\u65E0\u51C6\u786E\u8BA2\u5355\u53F7\u7684 iCNV\uFF1B\u4E0D\u4EE5 SPD \u5192\u5145\u8FC7\u6B20\u538B\u4FDD\u62A4\u3002\u56FE\u7247\u8272\u6807\u4E0D\u4F5C\u4E3A\u672C\u7248\u4F9D\u636E\uFF1AN \u4E3A\u84DD\u8272\u3001PE \u4E3A\u9EC4\u7EFF\u53CC\u8272\u3002SPD \u6309\u5B98\u65B9 iPRD40 \u914D\u5957 C40 \u540E\u5907\u5EFA\u6A21\uFF0C\u4E0D\u901A\u7528\u7167\u6284 C20\u3002\u6E90\u8868\u5206\u533A\u4FDD\u7559\u4E3A\u903B\u8F91\u5BFC\u822A\uFF0C\u4E0D\u989D\u5916\u5806\u53E0\u91CD\u590D\u5206\u533A\u603B\u5F00\u3002</p><img src="${To.diagram1}" alt="\u7528\u6237\u63D0\u4F9B\u7684\u4E09\u76F8\u4E94\u7EBF\u914D\u7F6E\u56FE"><button class="btn" data-asset="diagram1">\u53C2\u8003\u56FE\u4E00</button><button class="btn" data-asset="diagram2">\u53C2\u8003\u56FE\u4E8C</button></section>
    <section class="source-item"><h3>\u4EA7\u54C1\u53C2\u6570</h3><p>\u65BD\u8010\u5FB7\u8BA2\u5355\u53F7\uFF1A\u9010\u4EFD\u5B98\u65B9\u6570\u636E\u8868\u6838\u5BF9\u6781\u6570\u3001\u5B9E\u9645\u5BBD\u5EA6\u3001\u989D\u5B9A\u7535\u6D41\u3001\u5269\u4F59\u7535\u6D41\u7C7B\u578B\u3001\u7AEF\u5B50\u622A\u9762\u548C\u76F8\u5173\u4F7F\u7528\u7C7B\u522B\u3002\u5730\u533A\u4F9B\u8D27\u4E0E\u8BA4\u8BC1\u4ECD\u987B\u91C7\u8D2D\u6838\u5B9E\u3002ABB DS201 \u53C2\u6570\u6765\u81EA 2018 \u5B98\u65B9\u76EE\u5F55\uFF0C\u4F5C\u4E3A\u53EF\u9009\u5BF9\u7167\uFF0C\u660E\u786E\u6807\u6CE8\u5386\u53F2\u8D44\u6599\u3002</p><p>\u68C0\u6D4B\u5230 A9R21440\u3001A9L16292\u3001A9D32625 \u7684\u6240\u67E5\u5730\u533A\u5B98\u65B9\u6570\u636E\u8868\u6807\u660E\u505C\u4EA7\uFF0C\u5DF2\u6392\u9664\u9ED8\u8BA4\u5E93\uFF0C\u672A\u4EE5\u65E7\u53F7\u5192\u5145\u73B0\u552E\u578B\u53F7\u3002</p></section>
    <section class="source-item"><h3>\u8F7D\u6D41\u91CF\u4E0E\u8BA1\u7B97\u6761\u4EF6</h3><p>ABB Electrical Installation Handbook Table 8\uFF08PDF \u7B2C 41\u201342 \u9875\uFF09\u63D0\u4F9B Cu/PVC\u30012/3 \u6839\u8F7D\u6D41\u5BFC\u4F53\u8868\uFF1BSchneider EIG G20 \u4EA4\u53C9\u6838\u5BF9\u4E09\u8F7D\u6D41\u503C\uFF0CG12/G16 \u63D0\u4F9B\u6E29\u5EA6\u4E0E\u6210\u675F\u4FEE\u6B63\u3002\u5B83\u4EEC\u662F\u660E\u786E\u6761\u4EF6\u4E0B\u7684\u521D\u7B5B\u6570\u636E\uFF0C\u4E0D\u662F\u4E2D\u56FD\u6240\u6709\u6577\u8BBE\u573A\u666F\u7EDF\u4E00\u8F7D\u6D41\u91CF\u3002</p><button class="btn" data-asset="cable">\u67E5\u770B\u8868\u683C\u8BC1\u636E</button></section>
  </div>`,R("#pane").innerHTML=`<div class="pane-head"><div><h2>\u6821\u6838\u4E0E\u4F9D\u636E</h2><p>\u8F93\u5165\u771F\u5B9E\u6027\u3001\u8BA1\u7B97\u6761\u4EF6\u3001\u5668\u4EF6\u53C2\u6570\u4E0E\u8FDE\u63A5\u5B8C\u6574\u6027\u5206\u5F00\u5BA1\u6838</p></div><button class="btn" id="audit-json">${Ut("download")}\u62A5\u544A</button></div>
    <div class="subnav"><button data-audit="issues" class="${zr==="issues"?"active":""}">\u95EE\u9898\u6E05\u5355 ${Je.length}</button><button data-audit="framework" class="${zr==="framework"?"active":""}">\u6846\u67B6\u6620\u5C04 21</button><button data-audit="sources" class="${zr==="sources"?"active":""}">\u7D20\u6750\u4E0E\u4F9D\u636E</button></div>${a}`,document.querySelectorAll("[data-audit]").forEach(t=>t.onclick=()=>{zr=t.dataset.audit,MX(),Ye()}),document.querySelectorAll("[data-asset]").forEach(t=>t.onclick=()=>MA("\u6765\u6E90\u8BC1\u636E",`<img class="modal-image" src="${To[t.dataset.asset]}" alt="\u6765\u6E90\u9875"><p class="tiny">\u539F\u59CB\u8D44\u6599\u53CA\u63D0\u53D6\u8BB0\u5F55\u5747\u4FDD\u5B58\u5728 V2 \u5DE5\u7A0B\u76EE\u5F55\u4E2D\u3002</p>`)),document.querySelectorAll("[data-select]").forEach(t=>t.onclick=()=>{VA(t.dataset.select),innerWidth<=1e3&&R(".right").classList.add("open")}),R("#audit-json").onclick=()=>nn("\u6761\u4EF6\u6821\u6838\u62A5\u544A.json",JSON.stringify({name:Y.name,generated:new Date().toISOString(),scope:"\u975E\u65BD\u5DE5\u5408\u683C\u7ED3\u8BBA",issues:Je},null,2))}function jU(a){if(a==="\u603B\u5F00")return"4P / 2P \u8FDB\u7EBF\u603B\u5F00\uFF0C\u540C\u65F6\u65AD\u5F00\u76F8\u7EBF\u548C N\uFF1B\u4FDD\u7559\u5FC5\u8981 SPD \u53CA\u5176\u540E\u5907\u4FDD\u62A4\uFF0C\u4E0D\u53E6\u8BBE\u63A7\u5236\u652F\u8DEF\u3002";if(a==="\u667A\u63A7\u7CFB\u7EDF")return"\u5F31\u7535\u3001\u7F51\u7EDC\u4E0E\u5B89\u9632\u72EC\u7ACB\u56DE\u8DEF\uFF1B\u5206\u533A\u4EC5\u4E3A\u903B\u8F91\u5206\u7EC4\uFF0C\u4E0D\u91CD\u590D\u8BBE\u7F6E\u5206\u533A\u603B\u5F00\u3002";let t=Y.circuits.filter(e=>e.path.includes(a));return t.length?t.map(e=>e.id+" "+e.name).join("\uFF1B"):"\u6309\u7236\u5206\u533A\u53CA\u72EC\u7ACB\u8BBE\u5907\u56DE\u8DEF\u5C55\u5F00\uFF1B\u672A\u628A\u680F\u76EE\u76F4\u63A5\u7B49\u540C\u4E8E\u4E00\u4E2A\u65AD\u8DEF\u5668\u3002"}function yX(){MA("方案设置",`
    ${Bt("方案名称",`<input id="settings-name" value="${it(Y.name)}" maxlength="80">`)}
    ${Bt("界面模式",`<select id="settings-ui-mode">${re([["simple","简易布置（推荐）· 通道备注 / 共用保护"],["full","完整工坊 · 强电计算与校核"]],getUiMode(Y))}</select>`)}
    ${Bt("零线排位置",`<select id="settings-nbar">${re([["bottom","箱体最下（横装）"],["top","箱体最上（横装）"],["left","箱体左侧（竖装）"],["right","箱体右侧（竖装）"]],Y.nBarPosition||'bottom')}</select>`)}
    <div class="field-grid">${Bt("总开额定电流",`<select id="settings-main">${re([...new Set([16,20,25,32,40,63,80,Y.mainAmps])].sort((a,t)=>a-t).map(a=>[a,a+" A"]),Y.mainAmps)}</select>`)}
      <span class="full-only" style="display:contents">${Bt("总进线需用系数",TA("settings-demand",Y.demand,"",.05,1,.01))}</span></div>
    <div class="full-only">
    <div class="field-grid">${Bt("接地系统",`<select id="settings-earth">${re([["TN-S","TN-S / PEN 已在上级分开"],["TT","TT · 本版不支持直接采用"],["TN-C","PEN 入户 · 须先核实"]],Y.earthing)}</select>`)}
      ${Bt("现场预期短路电流",TA("settings-isc",Y.sourceIsc,"kA",.1,100,.1))}</div>
    ${Bt("入户电缆敷设条件",`<select id="settings-method">${re(Object.entries(Eo),Y.feedMethod)}</select>`)}
    <div class="field-grid">${Bt("入户电缆环境温度",`<select id="settings-temp">${re(Object.keys(Yr).map(a=>[a,a+" °C"]),Y.feedAmbient)}</select>`)}
      ${Bt("入户电缆成束回路数",`<select id="settings-bunch">${re(Object.keys(_r).map(a=>[a,a+" 回路"]),Y.feedBunched)}</select>`)}</div>
    <p>需用系数只用于总进线需求估算。完整工坊模式可恢复 Ib/In/Iz 与校核。</p>
    </div>
    <p class="lib-preview">当前为「${getUiMode(Y)==="simple"?"简易布置":"完整工坊"}」。切换后立即生效，数据保留。</p>
    <button id="settings-save" class="btn primary">应用</button>`),R("#settings-save").onclick=()=>{
      const mode=R("#settings-ui-mode").value;
      const name=R("#settings-name").value.trim()||Y.name;
      const mainAmps=+R("#settings-main").value;
      const nBar=R("#settings-nbar")?.value||'bottom';
      if(isSimpleMode(Y)||mode==="simple"){
        R("#modal").close();
        de(r=>{r.name=name; r.nBarPosition=nBar; if(mainAmps!==r.mainAmps){r.mainAmps=mainAmps;r.mainProductId=null} setUiMode(r,mode)},true);
        pe(mode==="simple"?"已切换到简易布置":"已切换到完整工坊");
        return;
      }
      let a=R("#settings-demand").valueAsNumber,t=R("#settings-isc").value===""?null:R("#settings-isc").valueAsNumber;
      if(!Number.isFinite(a)||a<.05||a>1||t!==null&&(!Number.isFinite(t)||t<=0||t>100))return pe("请检查需用系数和短路电流范围");
      let e={name,mainAmps,demand:a,sourceIsc:t,earthing:R("#settings-earth").value,feedMethod:R("#settings-method").value,feedAmbient:+R("#settings-temp").value,feedBunched:+R("#settings-bunch").value,nBarPosition:nBar};
      R("#modal").close(),de(r=>{e.mainAmps!==r.mainAmps&&(r.mainProductId=null),Object.assign(r,e),setUiMode(r,mode)},!0)
    }}
function Uo(a){let t=Me(Y,a);t&&(MA("\u4EA7\u54C1\u53C2\u6570 \xB7 "+t.name,`<div class="inspector-top">${an(t)}<div><strong>${it(t.name)}</strong><small>${it(gA(t))}</small></div></div>${VX(t)}
    <p style="margin-top:18px">${it(t.note||"\u989D\u5B9A\u53C2\u6570\u53D6\u81EA\u5BF9\u5E94\u578B\u53F7\u8D44\u6599\uFF0C\u4E0D\u5141\u8BB8\u7F16\u8F91\u989D\u5B9A\u7535\u6D41\u540E\u4FDD\u7559\u539F\u8BA2\u5355\u53F7\u3002")}</p>
    <p>\u6765\u6E90\uFF1A${it(t.source.file)}\uFF0C\u7B2C ${t.source.pages} \u9875\u3002\u6280\u672F\u53C2\u6570\u7684\u6838\u5B9E\u4E0D\u7B49\u4E8E\u5730\u533A\u4F9B\u8D27\u3001CCC \u9002\u7528\u548C\u672C\u9879\u76EE\u5B89\u88C5\u517C\u5BB9\u6027\u5DF2\u786E\u8BA4\u3002</p>
    <div class="tools">${t.source.url?`<a href="${it(t.source.url)}" target="_blank" rel="noreferrer" class="btn">\u8D44\u6599\u6765\u6E90</a>`:""}
    <button class="btn primary" id="product-install">${Ut("plus")}\u88C5\u5165\u8BBE\u5907</button>${t.custom?'<button class="btn" id="product-edit">\u7F16\u8F91\u578B\u53F7</button><button class="btn danger" id="product-delete">\u5220\u9664\u81EA\u5B9A\u4E49\u578B\u53F7</button>':""}</div>`),R("#product-install").onclick=()=>{R("#modal").close(),PX(a)},R("#product-edit")?.addEventListener("click",()=>{R("#modal").close(),qX(a)}),R("#product-delete")?.addEventListener("click",()=>{if(kt.nodes.some(e=>e.product.id===a))return pe("\u8BE5\u578B\u53F7\u4ECD\u88AB\u88C5\u914D\u8BBE\u5907\u4F7F\u7528\uFF0C\u8BF7\u5148\u79FB\u9664\u6216\u66FF\u6362\u5B9E\u4F8B");R("#modal").close(),de(e=>e.customProducts=e.customProducts.filter(r=>r.id!==a),!0),pe("\u5DF2\u4ECE\u81EA\u5B9A\u4E49\u5E93\u79FB\u9664\uFF0C\u53EF\u64A4\u9500")}))}function qX(a=null){let t=a?Me(Y,a):null;if(t&&!t.custom)return pe("内置厂家参数不可直接改写；可新增自定义型号");let e=t||{id:"USR-"+crypto.randomUUID(),brand:"",name:"",sku:"",kind:"gateway",poles:2,amps:null,width:54,height:94,depth:59,minWire:1,maxWire:16,neutralSide:"left",protectedPoles:0,residual:30,rcdType:"A",icn:null,backup:40,voltage:"",sourceURL:"",protocol:["din"],channels:null,smart:!0},r=kt.nodes.filter(s=>s.product.id===e.id).length,tplActive=DIN_SIZE_TEMPLATES.find(s=>Math.abs(s.width-e.width)<.2&&Math.abs(s.height-e.height)<1&&Math.abs(s.depth-e.depth)<1)?.id||"";
MA(t?"编辑器件库型号":"新增品牌与型号",`
    <p>先点选精绘 DIN 尺寸模板，再填写品牌与型号；保存后自动生成可上架三维的模块。当前关联 ${r} 个装配实例。用户录入 · 电气额定未核验。</p>
    <div class="din-templates" id="lib-templates">${DIN_SIZE_TEMPLATES.map(s=>`<button type="button" class="din-chip${s.id===tplActive?" active":""}" data-tpl="${s.id}" title="${it(s.hint)}"><strong>${it(s.label)}</strong><small>${it(s.hint)}</small></button>`).join("")}</div>
    <div class="field-grid">${Bt("品牌",`<input id="lib-brand" value="${it(e.brand)}" maxlength="80" required>`)}
      ${Bt("设备名称",`<input id="lib-name" value="${it(e.name)}" maxlength="80" required>`)}</div>
    ${Bt("型号 / 订单号",`<input id="lib-sku" value="${it(e.sku)}" maxlength="80" required>`)}
    <div class="field-grid">${Bt("设备类型",`<select id="lib-kind">${re(CUSTOM_KIND_OPTIONS,e.kind)}</select>`)}
      ${Bt("电气极数（不等于模数）",`<select id="lib-poles">${re([1,2,3,4].map(s=>[s,s+" 极"]),e.poles||2)}</select>`)}</div>
    <div class="field-grid" id="lib-power-fields">${Bt("额定电流（SPD/智能可留空）",TA("lib-amps",e.amps,"A",0,125))}
      ${Bt("过流保护极数",TA("lib-protected",e.protectedPoles??0,"极",0,4))}</div>
    <div class="field-grid">${Bt("实际宽度",TA("lib-width",e.width,"mm",9,432,.1))}
      ${Bt("实际高度",TA("lib-height",e.height,"mm",30,250,.1))}</div>
    <div class="field-grid">${Bt("实际深度",TA("lib-depth",e.depth,"mm",20,200,.1))}
      ${Bt("中性端位置",`<select id="lib-neutral">${re([["left","左侧"],["right","右侧"]],e.neutralSide||"left")}</select>`)}</div>
    <div class="field-grid">${Bt("最小铜硬线截面",TA("lib-min",e.minWire??1,"mm²",.5,70,.5))}
      ${Bt("最大铜硬线截面",TA("lib-max",e.maxWire??16,"mm²",.5,70,.5))}</div>
    <div class="field-grid" id="lib-rcd-fields">${Bt("剩余电流类型（仅 RCBO/RCCB）",`<select id="lib-type">${re(["AC","A","A-SI","F","B"].map(s=>[s,s]),e.rcdType||"A")}</select>`)}
      ${Bt("剩余动作电流",`<select id="lib-residual">${re([10,30,100,300].map(s=>[s,s+" mA"]),e.residual||30)}</select>`)}</div>
    <div class="field-grid">${Bt("Icn（仅 MCB/RCBO，未填待核）",TA("lib-icn",e.icn,"kA",.1,100,.1))}
      ${Bt("SPD 厂家指定后备电流",`<select id="lib-backup">${re([16,20,25,32,40,63].map(s=>[s,s+" A"]),e.backup||40)}</select>`)}</div>
    <div class="field-grid" id="lib-smart-fields">${Bt("协议（智能模块，逗号分隔）",`<input id="lib-protocol" value="${it(Array.isArray(e.protocol)?e.protocol.join(", "):e.protocol||"din")}" maxlength="120" placeholder="din, knx, dali">`)}
      ${Bt("通道数（可选）",TA("lib-channels",e.channels,"路",0,64,1))}</div>
    ${Bt("适用电压 / 频率（未填待核）",`<input id="lib-voltage" value="${it(e.voltage||"")}" maxlength="100">`)}
    ${Bt("厂家资料链接（可留空）",`<input id="lib-source" value="${it(e.sourceURL||"")}" maxlength="1000" placeholder="https://">`)}
    <p class="lib-preview" id="lib-preview"></p>
    <button class="btn primary" id="lib-save">保存到器件库</button>`);
function syncKindUI(){let s=R("#lib-kind").value,n=isSmartCustomKind(s);R("#lib-amps").disabled=s==="spd"||n,["rccb","spd"].includes(s)?R("#lib-protected").value=0:n?R("#lib-protected").value=0:+R("#lib-protected").value==0&&s!=="rccb"&&s!=="spd"&&(R("#lib-protected").value=1),R("#lib-rcd-fields").style.opacity=["rcbo","rccb"].includes(s)?"1":".45",R("#lib-smart-fields").style.opacity=n?"1":".45",updatePreview()}
function updatePreview(){let s=R("#lib-brand").value.trim(),n=R("#lib-sku").value.trim(),o=R("#lib-name"),i=autoCustomName(s,n,o.value);(!o.dataset.touched||!o.value.trim())&&s&&n&&(o.value=i);let l=R("#lib-width").valueAsNumber,d=R("#lib-height").valueAsNumber,f=R("#lib-depth").valueAsNumber,u=Number.isFinite(l)?Math.ceil(l/18):"—";R("#lib-preview").textContent=`预览：${o.value||"(待填名称)"} · ${R("#lib-kind").value} · ${Number.isFinite(l)?l:"?"}×${Number.isFinite(d)?d:"?"}×${Number.isFinite(f)?f:"?"} mm · ${u}M · 精绘面板自动生成`}
R("#lib-name").oninput=()=>{R("#lib-name").dataset.touched="1",updatePreview()},R("#lib-brand").oninput=updatePreview,R("#lib-sku").oninput=updatePreview,["lib-width","lib-height","lib-depth"].forEach(s=>R("#"+s).addEventListener("input",updatePreview)),R("#lib-kind").onchange=syncKindUI,R("#lib-templates").onclick=s=>{let n=s.target.closest("[data-tpl]");if(!n)return;let o=DIN_SIZE_TEMPLATES.find(i=>i.id===n.dataset.tpl);if(!o)return;R("#lib-width").value=o.width,R("#lib-height").value=o.height,R("#lib-depth").value=o.depth,R("#lib-templates").querySelectorAll(".din-chip").forEach(i=>i.classList.toggle("active",i.dataset.tpl===o.id)),updatePreview()},syncKindUI(),R("#lib-save").onclick=()=>{try{let s=isSmartCustomKind(R("#lib-kind").value),n={...e,brand:R("#lib-brand").value,name:R("#lib-name").value||autoCustomName(R("#lib-brand").value,R("#lib-sku").value),sku:R("#lib-sku").value,kind:R("#lib-kind").value,poles:+R("#lib-poles").value,amps:R("#lib-amps").value===""||!Number.isFinite(R("#lib-amps").valueAsNumber)?null:R("#lib-amps").valueAsNumber,protectedPoles:R("#lib-protected").valueAsNumber||0,width:R("#lib-width").valueAsNumber,height:R("#lib-height").valueAsNumber,depth:R("#lib-depth").valueAsNumber,minWire:R("#lib-min").valueAsNumber,maxWire:R("#lib-max").valueAsNumber,neutralSide:R("#lib-neutral").value,residual:+R("#lib-residual").value,rcdType:R("#lib-type").value,icn:R("#lib-icn").value===""?null:R("#lib-icn").valueAsNumber,backup:+R("#lib-backup").value,voltage:R("#lib-voltage").value,sourceURL:R("#lib-source").value.trim(),protocol:R("#lib-protocol").value,channels:R("#lib-channels").value===""?null:R("#lib-channels").valueAsNumber,smart:s},o=Co(n),i=ea(Y);i.customProducts=i.customProducts.filter(l=>l.id!==e.id),i.customProducts.push(o),i.mainProductId===e.id&&Number.isFinite(o.amps)&&(i.mainAmps=o.amps),i.disconnected=[],i.wireOverrides={};let l=_s(i);$s(l),R("#modal").close(),de(d=>Object.assign(d,l),!0),pr="library",UA(),pe("器件库已保存，关联实例已更新 · 三维将使用精绘面板")}catch(s){pe(s.message)}}}
function PX(a){let t=Me(Y,a);if(!t)return;let e=es();if(t.kind==="rccb"){let r=Y.circuits.filter(s=>kA(Y,s).product.kind==="mcb"&&t.poles===(s.voltage===380?4:2));if(!r.length)return pe("\u6CA1\u6709\u53EF\u5173\u8054\u7684 MCB \u56DE\u8DEF\uFF1BRCBO \u5DF2\u81EA\u5E26\u6F0F\u4FDD\uFF0C\u4E0D\u91CD\u590D\u4E32\u8054");MA("\u88C5\u5165\u5173\u8054\u6F0F\u4FDD",`<p>${it(t.brand)} \xB7 ${it(t.name)}</p>${Bt("\u5173\u8054\u56DE\u8DEF",`<select id="install-circuit">${re(r.map(s=>[s.id,s.id+" "+s.name]),r.some(s=>s.id===e?.id)?e.id:r[0].id)}</select>`)}<button id="install-save" class="btn primary">\u88C5\u5165 / \u66FF\u6362</button>`),R("#install-save").onclick=()=>{let s=R("#install-circuit").value;R("#modal").close(),de(n=>n.circuits.find(o=>o.id===s).rcdProductId=t.id,!0),VA(s+"-RCD")};return}if(t.kind==="spd"){if(t.poles!==(Y.supply==="three"?4:2))return pe("SPD \u6781\u6570\u4E0E\u5F53\u524D\u4F9B\u7535\u76F8\u5236\u4E0D\u7B26");MA("\u88C5\u5165\u6D6A\u6D8C\u4FDD\u62A4\u7EC4\u5408",`<p>${it(t.name)}\uFF0C\u914D\u5957\u540E\u5907 ${t.backup}A\u3002${t.custom?"\u7528\u6237\u53C2\u6570\u548C\u540E\u5907\u7EC4\u5408\u9700\u6838\u5382\u5BB6\u8D44\u6599\u3002":"\u4F9D\u636E\u5BF9\u5E94\u578B\u53F7\u6570\u636E\u8868\u3002"}</p><button id="install-save" class="btn primary">\u88C5\u5165 / \u66FF\u6362 SPD</button>`),R("#install-save").onclick=()=>{R("#modal").close(),de(r=>{r.includeSpd=!0,r.spdProductId=t.id},!0),VA("SPD")};return}if(isSmartModuleKind(t)||isSharedModuleKind(t.kind)){openModuleDialog(t,null);return}openInstallDialog(t,e);}

function ensureModuleArrays(design){
  Array.isArray(design.modules)||(design.modules=[]);
  Array.isArray(design.buses)||(design.buses=[]);
  Array.isArray(design.protectGroups)||(design.protectGroups=[]);
}
function terminalOptions(preferConductor){
  const mods=(Y.modules||[]).filter(m=>{
    const p=Me(Y,m.productId);
    if(!p||p.kind!=="terminal") return false;
    if(preferConductor&&p.conductor&&p.conductor!==preferConductor) return false;
    return true;
  });
  return [["","— 未挂端子 —"],...mods.map(m=>{
    const p=Me(Y,m.productId);
    const tone=p?.terminalColor==="blue"?"蓝":"灰";
    return [m.id,`${m.id} · ${tone} · ${m.label||p?.name||""}`];
  })];
}
function channelAssignHtml(product, channels, channelLabels, channelTerminals){
  const n=Math.max(0, Number(product.channels)||0);
  if(!n) return '<p class="lib-preview">该型号无通道（网关/电源等），仅装入模块本体。</p>';
  if(product.kind==="terminal"){
    return `<p class="lib-preview">${product.terminalColor==="blue"?"蓝色零线端子：灯/负载 N 先上本端子，再接到 N 排或模块。":"灰色相线端子：灯线 L 先上本端子，再跳到继电器通道。"}共 ${n} 极。</p>`;
  }
  const simple=isSimpleMode(Y);
  const opts=[["","— 未分配 —"],...Y.circuits.map(c=>[c.id,c.id+" "+c.name])];
  const termOpts=terminalOptions("L");
  return `<div class="channel-label-grid">${Array.from({length:n},(_,i)=>{
    const ch=i+1;
    const cur=channels?.[ch]||channels?.[String(ch)]||"";
    const lab=channelLabels?.[ch]||channelLabels?.[String(ch)]||"";
    const term=channelTerminals?.[ch]||channelTerminals?.[String(ch)]||"";
    if(simple){
      return Bt("CH"+ch+" 接什么",`<input data-mod-label="${ch}" maxlength="80" value="${it(lab)}" placeholder="例：客厅灯 / 阳台窗帘">
        <select data-mod-term="${ch}" style="margin-top:4px">${re(termOpts,term)}</select>`);
    }
    return Bt("通道 CH"+ch,`<input data-mod-label="${ch}" maxlength="80" value="${it(lab)}" placeholder="备注"><select data-mod-ch="${ch}" style="margin-top:4px">${re(opts,cur)}</select><select data-mod-term="${ch}" style="margin-top:4px">${re(termOpts,term)}</select>`);
  }).join("")}</div>`;
}
function breakerOptions(moduleId){
  const bindings=resolveModuleFeedBindings(kt,Y);
  const current=bindings.find(b=>b.moduleId===moduleId);
  const used=new Set(bindings.filter(b=>b.moduleId!==moduleId).map(b=>b.breakerId));
  const nodes=(kt?.nodes||[]).filter(n=>n.role==='branch'&&!used.has(n.id));
  return [['',current?`自动对应 · ${current.breakerId}`:'自动按安装顺序对应'],...nodes.map(n=>[n.id,`${n.id} · ${n.label||n.product?.name||''}`])];
}
function openModuleDialog(product, existing){
  ensureModuleArrays(Y);
  const editing=!!existing;
  const simple=isSimpleMode(Y);
  const id=existing?.id||nextModuleId(Y, product.kind);
  let channels=emptyChannels(product.channels||0, existing?.channels||null);
  let channelLabels=emptyChannelLabels(product.channels||0, existing?.channelLabels||null);
  let channelTerminals={};
  for(let i=1;i<=(product.channels||0);i++){
    channelTerminals[i]=existing?.channelTerminals?.[i]||existing?.channelTerminals?.[String(i)]||null;
  }
  let feed=existing?.feed||(product.powerInput==="bus"||product.kind==="psu"||product.kind==="gateway"||product.kind==="terminal"?"none":"shared");
  let busId=existing?.busId||null;
  let feedCircuitId=existing?.feedCircuitId||null;
  let protectId=existing?.protectId||null;
  let label=existing?.label||id+" "+(product.name||"");
  const slots=freeSlots(product, existing?.id||null);
  const positionKind=product.kind==='terminal'?'terminal':'module';
  const posKey=existing?.position?existing.position.row+"_"+existing.position.slot:(Y.positions?.[id]?Y.positions[id].row+"_"+Y.positions[id].slot:editing?'auto':readInstallPosition(positionKind,slots));
  const busOpts=[["","不挂总线"],...Y.buses.map(b=>[b.id,b.label+" ("+b.type+")"]),["__new__","＋ 新建总线…"]];
  const feedOpts=[["shared","共用馈电（模块总进线）"],["perChannel","每路馈电"],["none","无强电馈电（总线/自取电）"]];
  const circuitOpts=[["","— 未指定 —"],...Y.circuits.map(c=>[c.id,c.id+" "+c.name])];
  const isTerm=product.kind==="terminal";
  MA(editing?"编辑模块 "+id:isTerm?"装入菲尼克斯端子":"装入智能模块",`
    <p>${it(product.brand)} · ${it(product.name)} · ${product.channels?product.channels+" 路 · ":""}${product.width!=null?product.width+" mm / "+product.modules+" M":"宽度待核"}</p>
    ${Bt("模块名称",`<input id="mod-label" maxlength="40" value="${it(label)}">`)}
    ${Bt('备注名称',`<input id="mod-display-name" maxlength="40" placeholder="例如：客厅灯光网关" value="${it(existing?.displayName||'')}">`)}
    ${Bt('地址类型',`<select id="mod-address-mode">${re([['none','无'],['id','模块 ID'],['ip','IP 地址'],['both','ID + IP']],moduleAddressMode(existing||{}))}</select>`)}
    <div id="mod-id-field">${Bt('模块 ID（十六进制）',`<input id="mod-hardware-id" maxlength="2" placeholder="01 / 0E" aria-describedby="mod-id-error" value="${it(existing?.hardwareId||'')}">`)}<p id="mod-id-error" role="alert" style="color:#bf3030" hidden></p></div>
    <div id="mod-ip-field">${Bt('IP 地址',`<input id="mod-ip-address" maxlength="45" placeholder="192.168.1.100" value="${it(existing?.ipAddress||'')}">`)}</div>
    ${isTerm?"":Bt("对应支路空开（一对一）",`<select id="mod-protect">${re(breakerOptions(id),protectId||"")}</select>`)}
    <div class="${simple||isTerm?"full-only":""}">
      <div class="field-grid">
        ${Bt("总线",`<select id="mod-bus">${re(busOpts,busId||"")}</select>`)}
        ${Bt("馈电方式",`<select id="mod-feed">${re(feedOpts,feed)}</select>`)}
      </div>
      ${Bt("取电回路（共用馈电时）",`<select id="mod-feed-c">${re(circuitOpts,feedCircuitId||"")}</select>`)}
    </div>
    <div id="mod-channels">${channelAssignHtml(product, channels, channelLabels, channelTerminals)}</div>
    ${Bt("安装位置",`<select id="mod-pos">${re([["auto","自动顺延"],...slots.map(r=>[r.row+"_"+r.slot,positionLabel(r)])],posKey)}</select>`)}
    <p class="lib-preview">${isTerm?"灯线先压到端子 FIELD 侧，PANEL 侧跳到继电器。零线用蓝色端子。":simple?"每个模块对应一个支路空开；总空开为上游，不参与模块分配。未指定时按安装顺序对应。":"多路模块只占一个导轨位；可同时备注通道并关联回路。"}</p>
    <p id="mod-save-error" role="alert" style="color:#bf3030" hidden></p>
    <div class="field-grid" style="margin-top:8px">
      ${simple||isTerm?"":`<button class="btn" type="button" id="mod-suggest-smart">建议创建 C-SMART 取电回路</button>`}
      <button class="btn primary" type="button" id="mod-save">${editing?"保存模块":"装入模块"}</button>
    </div>`);
  const feedEl=R("#mod-feed"), feedC=R("#mod-feed-c");
  rememberInstallPosition(R('#mod-pos'),positionKind);
  const validateDialogId=()=>{
    const input=R('#mod-hardware-id'), error=R('#mod-id-error');
    let message='';
    try { if(['id','both'].includes(R('#mod-address-mode').value)) validateHardwareId(Y,id,input.value); }
    catch(err) { message=err.message; }
    error.textContent=message; error.hidden=!message;
    input.setAttribute('aria-invalid',String(!!message));
    return !message;
  };
  R('#mod-hardware-id').addEventListener('input',validateDialogId);
  const syncAddressFields=()=>{
    const mode=R('#mod-address-mode').value;
    R('#mod-id-field').hidden=!['id','both'].includes(mode);
    R('#mod-ip-field').hidden=!['ip','both'].includes(mode);
    validateDialogId();
  };
  R('#mod-address-mode').onchange=syncAddressFields;syncAddressFields();
  if(feedEl&&feedC){
    const syncFeedUI=()=>{feedC.closest("label").style.opacity=feedEl.value==="shared"?"1":".45"};
    feedEl.onchange=syncFeedUI; syncFeedUI();
  }
  R("#mod-bus")?.addEventListener("change",ev=>{
    if(ev.target.value!=="__new__") return;
    const type=inferBusType(product.protocol||[]);
    const nid=nextBusId(Y,type);
    de(d=>{ensureModuleArrays(d); d.buses.push(busDefaults(type,nid))},true);
    openModuleDialog(product, existing||{id,label,busId:nid,feed,feedCircuitId,channels,channelLabels,protectId,position:null});
  });
  R("#mod-suggest-smart")?.addEventListener("click",()=>{
    const draft=suggestSmartFeedCircuit(Y);
    if(Y.circuits.some(c=>c.id===draft.id)) return pe("已存在 "+draft.id);
    de(d=>{d.circuits.push(draft)},true);
    pe("已创建 "+draft.id+"「智控电源」");
    openModuleDialog(product, {
      id, label:R("#mod-label").value, busId:R("#mod-bus")?.value||null,
      feed:R("#mod-feed")?.value||feed, feedCircuitId:draft.id, channels, channelLabels, protectId, position:null
    });
  });
  R("#mod-save").onclick=()=>{
    R('#mod-save-error').hidden=true;
    if(!validateDialogId()){R('#mod-hardware-id').focus();return;}
    const nextLabel=R("#mod-label").value.trim()||id;
    let nextBus=R("#mod-bus")?.value||""; if(nextBus==="__new__") return pe("请先完成总线创建");
    const nextFeed=R("#mod-feed")?.value||"none";
    const nextFeedC=R("#mod-feed-c")?.value||null;
    const nextProtect=R("#mod-protect")?.value||null;
    const nextCh={};
    const nextLabs={};
    const nextTerms={};
    document.querySelectorAll("[data-mod-ch]").forEach(el=>{ nextCh[+el.dataset.modCh]=el.value||null; });
    document.querySelectorAll("[data-mod-label]").forEach(el=>{ nextLabs[+el.dataset.modLabel]=el.value.trim(); });
    document.querySelectorAll("[data-mod-term]").forEach(el=>{ nextTerms[+el.dataset.modTerm]=el.value||null; });
    const posRaw=R("#mod-pos").value;
    const pos=posRaw==="auto"?null:{row:+posRaw.split("_")[0],slot:+posRaw.split("_")[1]};
    try{
      const addressMode=R('#mod-address-mode').value;
      const hardwareId=['id','both'].includes(addressMode)?validateHardwareId(Y,id,R('#mod-hardware-id').value):R('#mod-hardware-id').value;
      const mod=normalizeModule({
        displayName:R('#mod-display-name').value,
        addressMode,
        ipAddress: ['ip','both'].includes(addressMode)?validateIpAddress(R('#mod-ip-address').value):R('#mod-ip-address').value,
        hardwareId,
        terminalConnections: existing?.terminalConnections,
        id, productId:product.id, label:nextLabel, busId:nextBus||null,
        feed:simple||isTerm?"none":nextFeed, feedCircuitId:!simple&&!isTerm&&nextFeed==="shared"?nextFeedC:null,
        channels:emptyChannels(product.channels||0, simple||isTerm?channels:nextCh),
        channelLabels:emptyChannelLabels(product.channels||0, nextLabs),
        channelTerminals:nextTerms,
        protectId:isTerm?null:(nextProtect||null),
        position:pos
      }, product);
      R("#modal").close();
      de(d=>{
        ensureModuleArrays(d);
        const i=d.modules.findIndex(m=>m.id===id);
        i>=0?d.modules[i]=mod:d.modules.push(mod);
        for(const b of d.buses){
          b.psuModuleIds=(b.psuModuleIds||[]).filter(x=>x!==id);
          b.deviceModuleIds=(b.deviceModuleIds||[]).filter(x=>x!==id);
        }
        if(mod.busId){
          let bus=d.buses.find(b=>b.id===mod.busId);
          if(bus){
            if(product.kind==="psu") bus.psuModuleIds.push(id);
            else bus.deviceModuleIds.push(id);
          }
        }
        writePosition(d, id, pos);
        if(!isTerm){
          setModuleProtect(d, id, nextProtect||null, null);
          for(const [ch,tid] of Object.entries(nextTerms)){
            linkChannelTerminal(d, id, +ch, tid||null);
          }
        }
        syncCircuitDevices(d, pid=>Me(d,pid));
      }, true);
      VA(id);
      pe(editing?"模块已更新":"模块已装入 · "+id);
    }catch(err){
      const error=R('#mod-save-error');
      error.textContent=err.message||String(err);error.hidden=false;
      error.scrollIntoView({block:'nearest'});
    }
  };
}
function openModuleManager(){
  ensureModuleArrays(Y);
  const rows=(Y.modules||[]).map(m=>{
    const p=Me(Y,m.productId);
    const used=Object.values(m.channels||{}).filter(Boolean).length;
    const total=Object.keys(m.channels||{}).length;
    return `<tr>
      <td><button class="link" data-mod-sel="${it(m.id)}">${it(m.id)}</button></td>
      <td>${it(m.label)}</td>
      <td>${it(p?.name||m.productId)}</td>
      <td>${used}/${total||"—"}</td>
      <td>
        <button class="link" data-mod-edit="${it(m.id)}">编辑</button>
        <button class="link" data-mod-del="${it(m.id)}">删除</button>
      </td>
    </tr>`;
  }).join("")||'<tr><td colspan="5">暂无共享模块。从器件库装入继电器/调光/网关/电源等即进入此列表。</td></tr>';
  MA("共享模块",`
    <p>多路智能器件以模块形式跨回路共享；装配中每个模块只出现一次。</p>
    <table class="data"><thead><tr><th>编号</th><th>名称</th><th>型号</th><th>通道</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    <button class="btn" id="mod-mgr-close" type="button">关闭</button>`);
  R("#mod-mgr-close").onclick=()=>R("#modal").close();
  document.querySelectorAll("[data-mod-sel]").forEach(el=>el.onclick=()=>{R("#modal").close();VA(el.dataset.modSel)});
  document.querySelectorAll("[data-mod-edit]").forEach(el=>el.onclick=()=>{
    const m=Y.modules.find(x=>x.id===el.dataset.modEdit); const p=Me(Y,m?.productId);
    if(m&&p) openModuleDialog(p,m);
  });
  document.querySelectorAll("[data-mod-del]").forEach(el=>el.onclick=()=>{
    const mid=el.dataset.modDel;
    de(d=>{removeModule(d,mid); syncCircuitDevices(d,pid=>Me(d,pid))},true);
    pe("已删除模块 "+mid);
    openModuleManager();
  });
}

function openInstallDialog(t,e){
  if(isSimpleMode(Y)){
    let slots=freeSlots(t,null);
    let defaultGroup=e?.group||(t.smart||t.zone==="control"?"smart":"sockets");
    let groups=allGroupsOf();
    MA("装入空开 / 保护",`<p>${it(t.brand)} · ${it(t.name)} · ${t.amps!=null?t.amps+" A · ":""}${t.width} mm / ${t.modules} M</p>
      ${Bt("名称",`<input id="install-name" value="${it(t.name)}" maxlength="80">`)}
      ${Bt("逻辑分区",`<select id="install-group">${re(groups.filter(r=>r.id!=="other").map(r=>[r.id,r.name]),defaultGroup)}</select>`)}
      ${Bt("安装位置",`<select id="install-pos">${re([["auto","自动顺延"],...slots.map(r=>[r.row+"_"+r.slot,positionLabel(r)])],readInstallPosition('protection',slots))}</select>`)}
      <p class="lib-preview">装入后按顺序对应一个模块，也可在模块中指定支路空开。铭牌额定电流：${t.amps!=null?t.amps+" A":"—"}。</p>
      <button class="btn primary" id="install-save">装入</button>`);
    rememberInstallPosition(R('#install-pos'),'protection');
    R("#install-save").onclick=()=>{
      let name=R("#install-name").value.trim()||t.name;
      let group=R("#install-group").value;
      let posRaw=R("#install-pos").value;
      let pos=posRaw==="auto"?null:{row:+posRaw.split("_")[0],slot:+posRaw.split("_")[1]};
      if(Y.circuits.length>=100)return pe("当前方案最多支持 100 条末端回路");
      let volts=t.poles>=3?380:220;
      let id="C"+String(Math.max(0,...Y.circuits.map(l=>+l.id.slice(1)||0))+1).padStart(2,"0");
      R("#modal").close();
      de(l=>{
        l.circuits.push({id,name,group,path:groupName(group)+" / "+name,loadIds:[],voltage:volts,phase:volts===380?"ABC":"L1",pf:.8,method:"B2",ambient:30,bunched:1,length:20,wire:null,productId:t.id,rcdProductId:null,on:!0,position:null});
        writePosition(l,id,pos);
      },!0);
      VA(id);
      pe("已装入支路空开 · 按安装顺序对应模块");
    };
    return;
  }
  let pathTouched=!1,pathValue=null;
  let defaultGroup=e?.group||(t.smart||t.zone==="control"?"smart":"sockets");
  let render=groupId=>{
    let groups=allGroupsOf(),slots=freeSlots(t,null),
      roles=[["branch","独立末端回路"],...t.kind==="mcb"?[["main","入户总开"]]:[]],
      pathNow=pathTouched&&pathValue!=null?pathValue:groupName(groupId)+" / 用户扩展";
    MA("从器件库装入设备",`<p>${it(t.brand)} · ${it(t.name)} · ${t.width} mm / ${t.modules} M${t.custom?" · 用户录入，待核":""}</p>
    ${Bt("接入方式",`<select id="install-role">${re(roles,je==="Q0"&&t.kind==="mcb"?"main":"branch")}</select>`)}
    <div id="install-branch-fields">
      ${Bt("设备 / 回路名称",`<input id="install-name" value="${it(t.name+" 回路")}" maxlength="80">`)}
      ${Bt("逻辑分区",`<select id="install-group">${re([...groups.filter(r=>r.id!=="other").map(r=>[r.id,r.name]),["__new__","＋ 新建分区…"]],groupId)}</select>`)}
      ${Bt("用途说明",`<input id="install-path" value="${it(pathNow)}" maxlength="200" placeholder="例：厨房 / 台面插座">`)}
    </div>
    ${Bt("安装位置",`<select id="install-pos">${re([["auto","自动顺延（首个空位）"],...slots.map(r=>[r.row+"_"+r.slot,positionLabel(r)])],readInstallPosition('protection',slots))}</select>`)}
    <p class="lib-preview">共 ${slots.length} 个可用位置；装入后仍可在检视器或装配页「移动」模式调整。</p>
    <button class="btn primary" id="install-save">装入设备</button>`);
    let roleSel=R("#install-role"),toggle=()=>{R("#install-branch-fields").hidden=roleSel.value==="main"};
    rememberInstallPosition(R('#install-pos'),'protection');
    roleSel.onchange=toggle,toggle();
    R("#install-path").oninput=r=>{pathTouched=!0,pathValue=r.target.value};
    R("#install-group").onchange=r=>{
      if(r.target.value==="__new__"){openGroupEditor(null,g=>render(g));return}
      render(r.target.value)
    };
    R("#install-save").onclick=()=>{
      let role=roleSel.value,
        name=role==="main"?t.name:(R("#install-name").value.trim()||t.name),
        group=role==="main"?defaultGroup:R("#install-group").value,
        path=role==="main"?"":R("#install-path").value.trim(),
        posRaw=R("#install-pos").value,
        pos=posRaw==="auto"?null:{row:+posRaw.split("_")[0],slot:+posRaw.split("_")[1]};
      if(role==="main"){
        if(t.kind!=="mcb"||t.poles!==(Y.supply==="three"?4:2)||t.protectedPoles<(Y.supply==="three"?3:1))return pe("住宅主开需与相制匹配，保护所有相线，并同时断开所有相线与 N");
        R("#modal").close(),de(l=>{l.includeMain=!0,l.mainProductId=t.id,l.mainAmps=t.amps,writePosition(l,"Q0",pos)},!0),VA("Q0");return
      }
      if(Y.circuits.length>=100)return pe("当前方案最多支持 100 条末端回路");
      if(group==="__new__")return pe("请先选择或新建逻辑分区");
      let volts=t.poles>=3?380:220,
        id="C"+String(Math.max(0,...Y.circuits.map(l=>+l.id.slice(1)||0))+1).padStart(2,"0");
      R("#modal").close(),de(l=>{
        l.circuits.push({id,name,group,path:path||groupName(group)+" / 用户扩展",loadIds:[],voltage:volts,phase:volts===380?"ABC":"L1",pf:.8,method:"B2",ambient:30,bunched:1,length:20,wire:null,productId:t.id,rcdProductId:null,on:!0,position:null}),
        writePosition(l,id,pos)
      },!0),VA(id),pe(t.width==null||t.modules==null?"已装入，但该型号尚无导轨尺寸（待核），三维箱体暂不上架":pos?"已装入器件并固定位置":"已装入器件，负荷可在源表映射中分配")
    }
  };
  render(defaultGroup)
}
function writePosition(design,id,pos){
  design.positions&&typeof design.positions=="object"||(design.positions={});
  pos?design.positions[id]={row:pos.row,slot:pos.slot}:delete design.positions[id]
}
function cX(a){let t=kt.nodes.find(r=>r.id===a);if(!t)return;let e=t.circuit?.loadIds.length||0;MA("\u79FB\u9664\u88C5\u914D\u8BBE\u5907",`<p>${it(t.label)} \xB7 ${it(gA(t.product))}</p>
    <p>${t.role==="branch"?`\u5173\u8054\u7684 ${e} \u6761\u6E90\u8868\u8D1F\u8377\u4F1A\u4FDD\u7559\u4E3A\u5F85\u91CD\u65B0\u5206\u914D\uFF0C\u5173\u8054\u6F0F\u4FDD\u968F\u672C\u56DE\u8DEF\u4E00\u5E76\u79FB\u9664\u3002`:t.role==="main"?"\u79FB\u9664\u4E3B\u5F00\u540E\uFF0C\u672B\u7AEF\u4E0D\u518D\u63A5\u5165\u5E02\u7535\uFF0C\u62A5\u544A\u5C06\u663E\u793A\u7F3A\u5C11\u8FDB\u7EBF\u4FDD\u62A4\u3002":t.role==="module"?"将删除共享模块及其通道分配，关联回路保留。":["spd","spdBackup"].includes(t.role)?"SPD \u53CA\u5176\u540E\u5907\u4FDD\u62A4\u4F5C\u4E3A\u914D\u5957\u7EC4\u5408\u4E00\u5E76\u79FB\u9664\u3002":"\u4EC5\u79FB\u9664\u5173\u8054\u6F0F\u4FDD\uFF0C\u56DE\u8DEF\u548C\u6E90\u8868\u8D1F\u8377\u4FDD\u7559\uFF1B\u7F3A\u5C11\u6F0F\u4FDD\u5C06\u5217\u4E3A\u9700\u4FEE\u6B63\u3002"}</p>
    <button class="btn danger" id="remove-confirm">\u786E\u8BA4\u79FB\u9664</button>`),R("#remove-confirm").onclick=()=>{R("#modal").close(),de(r=>{
      if(t.role==="module"){removeModule(r,t.id);syncCircuitDevices(r,pid=>Me(r,pid));return}
      if(t.role==="branch"){releaseCircuitFromModules(r,t.id);r.circuits=r.circuits.filter(s=>s.id!==t.id);syncCircuitDevices(r,pid=>Me(r,pid));return}
      if(t.role==="branchRcd"){r.circuits.find(s=>s.id===t.circuit.id).rcdProductId=null;return}
      if(t.role==="main"){r.includeMain=!1,r.mainProductId=null;return}
      r.includeSpd=!1,r.spdProductId=null
    },!0),VA(t.role==="module"?"Q0":t.role==="branchRcd"?t.circuit.id:Y.circuits[0]?.id||"Q0"),pe("\u8BBE\u5907\u5DF2\u79FB\u9664\uFF0C\u5668\u4EF6\u5E93\u4E0E\u6E90\u8868\u4ECD\u4FDD\u7559\uFF1B\u53EF\u64A4\u9500")}}function JU(){
  let pathTouched=!1,pathValue=null;
  let render=groupId=>{
    let groups=allGroupsOf().filter(g=>g.id!=="other"),
      pathNow=pathTouched&&pathValue!=null?pathValue:groupName(groupId)+" / 用户扩展";
    MA("增加独立回路",`${Bt("回路名称",'<input id="new-name" maxlength="60" value="新增独立回路">')}
    <div class="field-grid">${Bt("逻辑分区",`<select id="new-group">${re([...groups.map(g=>[g.id,g.name]),["__new__","＋ 新建分区…"]],groupId)}</select>`)}
    ${Bt("电源规格",'<select id="new-voltage"><option value="220">220 V 单相</option><option value="380">380 V 三相</option></select>')}</div>
    ${Bt("用途说明",`<input id="new-path" value="${it(pathNow)}" maxlength="200" placeholder="例：阳台 / 洗衣机">`)}
    <p>新回路初始为空，不复制既有设备负荷。设备可在源表映射中重新分配，仍保持每条源记录只计入一次。保护器件先按自动选型，可在检视器改。</p><button class="btn primary" id="new-save">增加回路</button>`);
    R("#new-path").oninput=r=>{pathTouched=!0,pathValue=r.target.value};
    R("#new-group").onchange=r=>{
      if(r.target.value==="__new__"){openGroupEditor(null,g=>render(g));return}
      render(r.target.value)
    };
    R("#new-save").onclick=()=>{
      let name=R("#new-name").value.trim()||"新增独立回路",
        group=R("#new-group").value,
        volts=+R("#new-voltage").value,
        path=R("#new-path").value.trim(),
        id="C"+String(Math.max(0,...Y.circuits.map(s=>+s.id.slice(1)||0))+1).padStart(2,"0");
      if(group==="__new__")return pe("请先选择或新建逻辑分区");
      R("#modal").close(),de(s=>s.circuits.push({id,name,group,path:path||groupName(group)+" / 用户扩展",loadIds:[],voltage:volts,phase:volts===380?"ABC":"L1",pf:.8,method:"B2",ambient:30,bunched:1,length:20,wire:null,productId:null,rcdProductId:volts===380?"A9R61440":null,on:!0,position:null}),!0),VA(id),pe("已增加空回路，可在源表映射中分配设备")
    }
  };
  render("sockets")
}
function openGroupEditor(existing,onDone){
  let icons=[["shapes","通用"],["air-vent","暖通"],["cooking-pot","厨房"],["tv","影音"],["lightbulb","照明"],["plug","插座"],["network","智控"],["droplets","给排水"],["car","车库"],["trees","室外"],["shield","安防"],["thermometer","地暖"]];
  MA(existing?"编辑逻辑分区":"新建逻辑分区",`
    ${Bt("分区名称",`<input id="grp-name" maxlength="20" value="${it(existing?.name||"")}" placeholder="例：地暖 / 影音室 / 车库">`)}
    ${Bt("图标",`<select id="grp-icon">${re(icons,existing?.icon||"shapes")}</select>`)}
    <p class="lib-preview">分区只影响回路的归类、排布顺序与文档分组，不参与任何电气计算。分区随方案保存与导出。</p>
    <button class="btn primary" id="grp-save">${existing?"保存":"新建并选用"}</button>`);
  R("#grp-save").onclick=()=>{
    let name=R("#grp-name").value.trim(),icon=R("#grp-icon").value;
    if(!name)return pe("请填写分区名称");
    if(allGroups(Y).some(g=>g.name===name&&g.id!==existing?.id))return pe("已有同名分区");
    let id=existing?.id||nextGroupId(),draft;
    try{draft=validateCustomGroup({id,name,icon})}catch(err){return pe(err.message)}
    R("#modal").close(),de(d=>{
      Array.isArray(d.customGroups)||(d.customGroups=[]);
      let i=d.customGroups.findIndex(g=>g.id===id);
      i>=0?d.customGroups[i]=draft:d.customGroups.push(draft)
    }),onDone?.(id)
  }
}
function openGroupManager(){
  let rows=allGroupsOf().map(g=>{
    let n=circuitsOfGroup(g.id).length,custom=!!g.custom;
    return `<div class="library-row"><div class="library-info"><strong>${Ut(g.icon)} ${it(g.name)}</strong><small>${n} 条回路 · ${custom?"自定义":g.id==="other"?"未归类兜底":"内置"}</small></div><div class="library-actions">${custom?`<button class="ib" data-grp-edit="${g.id}" title="重命名">${Ut("pencil")}</button><button class="ib" data-grp-del="${g.id}" title="删除">${Ut("trash-2")}</button>`:""}</div></div>`
  }).join("");
  MA("逻辑分区",`<p>内置分区不可删除。删除自定义分区后，其下回路会落入「其它」，不会丢失。</p>${rows}
    <button class="btn primary" id="grp-add" style="margin-top:10px">${Ut("plus")}新建分区</button>`);
  R("#grp-add").onclick=()=>openGroupEditor(null,()=>openGroupManager());
  document.querySelectorAll("[data-grp-edit]").forEach(b=>b.onclick=()=>{
    let g=allGroups(Y).find(x=>x.id===b.dataset.grpEdit);
    openGroupEditor(g,()=>openGroupManager())
  });
  document.querySelectorAll("[data-grp-del]").forEach(b=>b.onclick=()=>{
    let id=b.dataset.grpDel,n=circuitsOfGroup(id).length;
    de(d=>{d.customGroups=(d.customGroups||[]).filter(g=>g.id!==id)}),
    openGroupManager(),pe(n?`分区已删除，${n} 条回路落入「其它」`:"分区已删除")
  })
}
function YU(a,t){let r=kt.nodes.find(s=>s.id===a);if(!r||!t||!Number.isInteger(t.slot)||t.row<0||t.row>=kt.box.rows||t.slot<0||t.slot+r.product.modules>kt.box.slots||kt.nodes.some(s=>s.id!==a&&s.row===t.row&&t.slot<s.slot+s.product.modules&&t.slot+r.product.modules>s.slot))return pe("\u76EE\u6807\u4F4D\u7F6E\u8D85\u51FA\u5BFC\u8F68\u6216\u5DF2\u6709\u5668\u4EF6");setNodePosition(a,t),VA(a)}function nn(a,t,e="application/json"){let r=URL.createObjectURL(new Blob([t],{type:e})),s=document.createElement("a");s.href=r,s.download=a,s.click(),setTimeout(()=>URL.revokeObjectURL(r),15e3)}function IX(a,t){let e=r=>{let s=String(r??"");return/^[=+\-@\t\r]/.test(s)&&(s="'"+s),'"'+s.replaceAll('"','""')+'"'};nn(a,"\uFEFF"+t.map(r=>r.map(e).join(",")).join(`\r
`),"text/csv;charset=utf-8")}function zX(){IX("\u5168\u5C4B\u56DE\u8DEF\u8BA1\u7B97.csv",[["\u56DE\u8DEF","\u540D\u79F0","\u6E90\u6846\u67B6","\u7535\u538BV","\u76F8\u4F4D","\u5DF2\u77E5\u8D1F\u8377W","\u529F\u7387\u56E0\u6570","Ib_A","\u5668\u4EF6\u8BA2\u5355\u53F7","In_A","\u5BBD\u5EA6mm","Iz_A","\u7EBF\u7F06","\u538B\u964D\u521D\u4F30\u767E\u5206\u6BD4","\u9700\u6838\u4E8B\u9879"],...Y.circuits.map(a=>{let t=kA(Y,a);return[a.id,a.name,a.path,a.voltage,a.phase,t.p,a.pf,t.ib.toFixed(3),gA(t.product),t.product.amps,t.product.width,t.iz.toFixed(2),t.cable,t.drop.toFixed(2),Je.filter(e=>e.circuit===a.id).map(e=>e.text).join("\uFF1B")]})])}function wX(){const net=buildDeliveryNet(Y,kt,Xe);IX("全柜端子接线表.csv",deliveryWireRows(net,deliveryLabels(Y,net)))}function standaloneHtmlString(){let a=document.documentElement.cloneNode(!0);a.querySelector("#app").innerHTML="";let t=a.querySelector("#v5-print-root");t&&t.remove();let e=a.querySelector("#v5-dialog");return e&&e.remove(),a.querySelector("#embedded-design").textContent=JSON.stringify(Y).replace(/</g,"\\u003c"),`<!doctype html>
`+a.outerHTML}function _U(){let a=document.documentElement.cloneNode(!0);a.querySelector("#app").innerHTML="",a.querySelector("#embedded-design").textContent=JSON.stringify(Y).replace(/</g,"\\u003c"),nn(Y.name+"-V4.html",`<!doctype html>
`+a.outerHTML,"text/html;charset=utf-8")}function $U(){MA(isSimpleMode(Y)?"导出方案":"导出 V4 方案",`<p>${it(Y.name)} · ${Y.circuits.length} 回路 · ${(Y.modules||[]).length} 模块。导出保留当前备注与共用保护，不能作为工程合格声明。</p>
    <div class="exports"><button class="btn" id="out-html">${Ut("file-code-2")}独立 HTML</button>
    <button class="btn" id="out-json">${Ut("braces")}方案 JSON</button>
    <button class="btn primary" id="out-channels">${Ut("sheet")}通道清单 CSV</button>
    <button class="btn full-only" id="out-circuits">${Ut("sheet")}回路计算 CSV</button>
    <button class="btn full-only" id="out-wires">${Ut("cable")}逐端子接线 CSV</button>
    <button class="btn full-only" id="out-audit">${Ut("clipboard-list")}条件校核 JSON</button>
    <button class="btn" id="out-image">${Ut("camera")}三维快照 PNG</button>
    <button class="btn full-only" id="out-print">${Ut("printer")}打印计算记录</button>
    <button class="btn" id="out-docs">${Ut("files")}打开文档中心</button>
    <button class="btn" id="out-zip">${Ut("package")}交底包 ZIP</button></div>`),R("#out-docs").onclick=()=>{R("#modal").close(),window.__V5_DOCS__?.open()},R("#out-zip").onclick=()=>{R("#modal").close(),window.__V5_DOCS__?.zip()},R("#out-html").onclick=_U,R("#out-json").onclick=()=>nn(Y.name+"-V4.json",JSON.stringify(Y,null,2)),R("#out-channels").onclick=()=>nn(Y.name+"-通道清单.csv",channelRowsToCsv(buildChannelRows(Y,id=>Me(Y,id))),"text/csv;charset=utf-8"),R("#out-circuits")?.addEventListener("click",zX),R("#out-wires")?.addEventListener("click",wX),R("#out-audit")?.addEventListener("click",()=>nn("V4校核记录.json",JSON.stringify({scope:"未签认的条件性计算",issues:Je},null,2))),R("#out-image").onclick=XX,R("#out-print")?.addEventListener("click",tW)}
function XX(){if(!qt)return pe("\u4E09\u7EF4\u753B\u5E03\u4E0D\u53EF\u7528");let a=document.createElement("a");a.href=qt.screenshot(),a.download="\u914D\u7535\u5DE5\u574AV4.png",a.click()}function tW(){R("#print").innerHTML=`<h1>${it(Y.name)} \xB7 V4</h1><p>${kt.box.name} / ${Y.supply==="three"?"\u4E09\u76F8\u4E94\u7EBF":"\u5355\u76F8 L+N+PE"} / \u4E3B\u5F00 ${Y.mainAmps} A \u6682\u5B9A / ${Y.circuits.length} \u56DE\u8DEF</p>
    <p>\u6761\u4EF6\u6027\u65B9\u6848\u8BB0\u5F55\uFF0C\u672A\u7B7E\u8BA4\uFF0C\u4E0D\u53EF\u76F4\u63A5\u7528\u4E8E\u65BD\u5DE5\u3002${Je.filter(a=>a.level==="error").length} \u9879\u9700\u4FEE\u6B63\uFF0C${Je.filter(a=>a.level!=="error").length} \u9879\u5F85\u6838\u3002</p>
    <table><thead><tr><th>\u56DE\u8DEF</th><th>\u540D\u79F0</th><th>\u7535\u538B/\u76F8\u4F4D</th><th>\u529F\u7387W</th><th>PF</th><th>Ib / In / Iz A</th><th>\u7EBF\u7F06</th></tr></thead><tbody>${Y.circuits.map(a=>{let t=kA(Y,a);return`<tr><td>${a.id}</td><td>${it(a.name)}</td><td>${a.voltage} / ${a.phase}</td><td>${t.p}</td><td>${a.pf}</td><td>${t.ib.toFixed(1)} / ${t.product.amps} / ${t.iz.toFixed(1)}</td><td>${t.cable}</td></tr>`}).join("")}</tbody></table>
    <p>${Je.filter(a=>a.level==="error").map(a=>it(a.text)).join("<br>")}</p>`,R("#modal").close(),window.print()}R("#close-modal").onclick=()=>R("#modal").close();R("#export").onclick=$U;R("#settings").onclick=yX;R("#snapshot").onclick=XX;R("#new-product").onclick=()=>qX();R("#source-button").onclick=()=>{if(isSimpleMode(Y)){yX();return}BA="audit",zr="sources",rs()};R("#footer-audit").onclick=()=>{BA="audit",zr="issues",rs()};R("#search").oninput=a=>{mX=a.target.value,UA()};R("#supply").onchange=a=>{let t=a.target.value;de(e=>{e.supply=t,e.mainProductId=null,e.spdProductId=null,[16,20,25,32,40,63,80].includes(e.mainAmps)||(e.mainAmps=80)},!0),t==="single"&&pe("380 V \u8BBE\u5907\u4ECD\u4FDD\u7559\u4E3A\u4E0D\u517C\u5BB9\u56DE\u8DEF\uFF0C\u4E0D\u4F1A\u9759\u9ED8\u8F6C\u6362\u4E3A 220 V")};R("#cabinet").onchange=a=>{let t=a.target.value;de(e=>{e.cabinet=t;let r=resolveCabinet(e),s=0;e.circuits.forEach(o=>{o.position&&r&&(o.position.row>=r.rows||o.position.slot>=r.slots)&&(o.position=null,s++)});let n=e.positions&&typeof e.positions=="object"?e.positions:{};for(let[o,i]of Object.entries(n))r&&(i.row>=r.rows||i.slot>=r.slots)&&(delete n[o],s++);e.positions=n,s&&setTimeout(()=>pe(`${s} 个器件的固定位置超出新箱体，已改为自动排布`),50)})};R("#custom-cabinet").onclick=()=>openCustomCabinetDialog();R("#design-templates").onclick=()=>openDesignTemplatesDialog();R("#manage-groups").onclick=()=>openGroupManager();R("#save-as-template").onclick=()=>openSaveAsTemplateDialog();R("#undo").onclick=()=>{Aa.length&&(sn.push(ea(Y)),Y=Aa.pop(),Ge.trip=null,Y1(),ra())};R("#redo").onclick=()=>{sn.length&&(Aa.push(ea(Y)),Y=sn.pop(),Ge.trip=null,Y1(),ra())};document.querySelectorAll("[data-tab]").forEach(a=>a.onclick=()=>{BA=a.dataset.tab,rs(),qt?.resize()});document.querySelectorAll("[data-left]").forEach(a=>a.onclick=()=>{pr=a.dataset.left,UA()});document.querySelectorAll("[data-mode]").forEach(a=>a.onclick=()=>{_a=a.dataset.mode,qt?.setMode(_a),qt&&(qt.moving=!1,qt.setPanMode(!1)),R("#pan-mode").classList.remove("active"),R("#move-mode").classList.remove("active"),R("#select-mode").classList.add("active"),document.querySelectorAll("[data-mode]").forEach(t=>t.classList.toggle("active",t.dataset.mode===_a))});R("#select-mode").onclick=()=>{qt&&(qt.moving=!1,qt.setPanMode(!1)),R("#pan-mode").classList.remove("active"),R("#select-mode").classList.add("active"),R("#move-mode").classList.remove("active")};R("#move-mode").onclick=()=>{qt&&(Ke=!1,cr=!1,WA(),qt.setPanMode(!1),R("#pan-mode").classList.remove("active"),_a="front",qt.setMode(_a),qt.moving=!qt.moving,R("#move-mode").classList.toggle("active",qt.moving),R("#select-mode").classList.toggle("active",!qt.moving),document.querySelectorAll("[data-mode]").forEach(a=>a.classList.toggle("active",a.dataset.mode===_a)))};R("#focus").onclick=()=>qt?.fit(!0);R("#inspect-only").onclick=()=>{Ke=!Ke,WA(),qt?.fit(Ke)};R("#fit").onclick=()=>{Ke=!1,hr=1,R("#zoom-value").textContent="100%",qt?.setZoom(1),WA(),qt?.fit()};R("#pan-mode").onclick=()=>{qt&&(qt.setPanMode(!qt.panMode),R("#pan-mode").classList.toggle("active",qt.panMode),R("#move-mode").classList.remove("active"),R("#select-mode").classList.toggle("active",!qt.panMode))};R("#explode").onclick=()=>{cr=!cr,WA()};R("#door").onclick=()=>{Bo=!Bo,R("#door").classList.toggle("active",Bo),WA()};R("#wire-mode").onchange=a=>{vX=a.target.value,WA()};R("#quality").onchange=a=>{pX=a.target.value,qt?.setQuality(pX)};var Nu={top:!1,bottom:!1};try{Nu=Object.assign(Nu,JSON.parse(localStorage.getItem("panel-studio-chrome")||"{}"))}catch{}function zU(){let a=R(".canvas-wrap");a&&(a.classList.toggle("chrome-hide-top",!!Nu.top),a.classList.toggle("chrome-hide-bottom",!!Nu.bottom));let t=R("#chrome-top"),e=R("#chrome-bottom");t&&(t.classList.toggle("active",!!Nu.top),t.title=Nu.top?"\u663E\u793A\u9876\u90E8\u673A\u67DC\u4FE1\u606F":"\u9690\u85CF\u9876\u90E8\u673A\u67DC\u4FE1\u606F",t.setAttribute("aria-label",t.title),t.setAttribute("aria-pressed",String(!!Nu.top))),e&&(e.classList.toggle("active",!!Nu.bottom),e.title=Nu.bottom?"\u663E\u793A\u5E95\u90E8\u7EC4\u4EF6\u6761":"\u9690\u85CF\u5E95\u90E8\u7EC4\u4EF6\u6761",e.setAttribute("aria-label",e.title),e.setAttribute("aria-pressed",String(!!Nu.bottom)));try{localStorage.setItem("panel-studio-chrome",JSON.stringify(Nu))}catch{}qt?.resize()}R("#chrome-top").onclick=()=>{Nu.top=!Nu.top,zU(),qt?.fit(Ke)};R("#chrome-bottom").onclick=()=>{Nu.bottom=!Nu.bottom,zU(),qt?.fit(Ke)};zU();R("#theme").onclick=()=>{Ya=Ya==="dark"?"light":"dark",R(".canvas-wrap").classList.toggle("studio-dark",Ya==="dark"),R("#theme").innerHTML=Ut(Ya==="dark"?"sun":"moon"),R("#theme").title=Ya==="dark"?"\u5207\u6362\u6D45\u8272\u5DE5\u4F5C\u53F0":"\u5207\u6362\u6DF1\u8272\u5DE5\u4F5C\u53F0",qt?.setTheme(Ya),Ye()};R("#zoom-plus").onclick=()=>{hr=Math.min(3,Math.round((hr+.15)*100)/100),qt?.setZoom(hr),R("#zoom-value").textContent=Math.round(hr*100)+"%"};R("#zoom-minus").onclick=()=>{hr=Math.max(.5,Math.round((hr-.15)*100)/100),qt?.setZoom(hr),R("#zoom-value").textContent=Math.round(hr*100)+"%"};R("#auto-wire").onclick=()=>{MA("\u6062\u590D\u81EA\u52A8\u914D\u7EBF",'<p>\u5C06\u6E05\u9664\u624B\u52A8\u5668\u4EF6\u9009\u62E9\u3001\u7EBF\u5F84\u8986\u76D6\u4E0E\u65AD\u7EBF\u8BD5\u9A8C\u72B6\u6001\uFF1B\u4FDD\u7559\u8BBE\u5907\u529F\u7387\u3001\u529F\u7387\u56E0\u6570\u3001\u6577\u8BBE\u6761\u4EF6\u548C\u5F53\u524D\u56DE\u8DEF\u5206\u914D\u3002</p><button class="btn primary" id="confirm-auto">\u6062\u590D\u81EA\u52A8\u503C</button>'),R("#confirm-auto").onclick=()=>{R("#modal").close(),de(a=>{a.circuits.forEach(t=>{t.wire=null,t.productId=null})},!0),pe("\u5DF2\u6062\u590D\u81EA\u52A8\u5339\u914D\uFF1B\u5F85\u6838\u6761\u4EF6\u4ECD\u4FDD\u7559")}};R("#balance").onclick=()=>{MA("\u5747\u8861\u5355\u76F8\u56DE\u8DEF",'<p>\u6309\u56DE\u8DEF\u5DF2\u77E5\u8BBE\u8BA1\u7535\u6D41\u91CD\u65B0\u5206\u914D L1 / L2 / L3\uFF0C\u4E0D\u6539\u53D8 380V \u4E09\u76F8\u56DE\u8DEF\u3002\u8FDE\u63A5\u5C06\u91CD\u65B0\u751F\u6210\uFF0C\u65AD\u7EBF\u8BD5\u9A8C\u4E0E\u5BFC\u7EBF\u8986\u76D6\u503C\u4F1A\u6E05\u9664\uFF1B\u4E09\u6B21\u8C10\u6CE2\u4E2D\u6027\u7EBF\u7535\u6D41\u4E0D\u5728\u672C\u6A21\u578B\u8BA1\u7B97\u8303\u56F4\u3002</p><button class="btn primary" id="confirm-balance">\u91CD\u65B0\u5747\u8861</button>'),R("#confirm-balance").onclick=()=>{R("#modal").close(),de(a=>N1(a),!0)}};R("#power")?.addEventListener("change",a=>{Ge.power=a.target.checked,Ge.trip=null,ra()});R("#mobile-left").onclick=()=>{R(".left").classList.toggle("open"),R(".right").classList.remove("open")};R("#mobile-right").onclick=()=>{R(".right").classList.toggle("open"),R(".left").classList.remove("open")};R("#canvas").addEventListener("pointerdown",()=>{R(".left").classList.remove("open"),R(".right").classList.remove("open")});R("#import").onclick=()=>R("#file").click();R("#file").onchange=async a=>{let t=a.target.files[0];if(a.target.value="",!!t){if(t.size>3e6)return pe("JSON \u65B9\u6848\u4E0D\u80FD\u8D85\u8FC7 3 MB");try{let e=_s(JSON.parse(await t.text()));$s(e),de(r=>Object.assign(r,e)),Ge={power:!1,trip:null},je=Y.circuits[0]?.id,EA=null,ra(),pe("\u5DF2\u5BFC\u5165 V2 \u65B9\u6848")}catch(e){pe("\u5BFC\u5165\u5931\u8D25\uFF1A"+e.message)}}};document.addEventListener("keydown",a=>{R("#modal").open||a.target.closest("input,select,textarea")||((a.metaKey||a.ctrlKey)&&a.key.toLowerCase()==="z"&&(a.preventDefault(),R(a.shiftKey?"#redo":"#undo").click()),a.key==="Escape"&&(R(".left").classList.remove("open"),R(".right").classList.remove("open"),EA=null,As()))});function positionPanel(id){
  let node=kt.nodes.find(n=>n.id===id);
  if(!node)return"";
  let pinned=!!nodePosition(Y,id,node.circuit),
    slots=freeSlots(node.product,id),
    opts=[["auto","自动顺延"],...slots.map(p=>[p.row+"_"+p.slot,positionLabel(p)])],
    value=pinned&&!node.overflow?node.row+"_"+node.slot:"auto";
  return `<section class="side-section"><h3>安装位置</h3>
    ${Bt("排 / 位",`<select id="pos-select" data-node="${it(id)}">${re(opts,value)}</select>`)}
    <p class="tiny">${node.overflow?"当前箱体放不下，已溢出（容量或尺寸不足）":`现在第 ${node.row+1} 排第 ${node.slot+1} 位 · ${pinned?"已固定":"自动排布"}`}${node.placementError?" · 固定位置冲突，已回退自动":""}</p>
    ${pinned?`<button class="btn" id="pos-auto" data-node="${it(id)}" style="width:100%;margin-top:8px">${Ut("wand-sparkles")}恢复自动排布</button>`:""}
  </section>`
}
R("#inspector").addEventListener("change",ev=>{
  let sel=ev.target.closest?.("#pos-select");
  if(!sel)return;
  let id=sel.dataset.node,v=sel.value;
  if(v==="auto")return setNodePosition(id,null),pe("已恢复自动排布");
  let[row,slot]=v.split("_").map(Number);
  setNodePosition(id,{row,slot}),pe(`已固定到第 ${row+1} 排第 ${slot+1} 位`)
});
R("#inspector").addEventListener("click",ev=>{
  let btn=ev.target.closest?.("#pos-auto");
  btn&&(setNodePosition(btn.dataset.node,null),pe("已恢复自动排布"))
});
gX();try{qt=new Qo(R("#canvas"),{select:VA,wire:bX,move:YU,inspect:CX,status:a=>{R("#render-status").textContent=a.contextLost?"\u56FE\u5F62\u4E0A\u4E0B\u6587\u4E22\u5931":`\u6309\u9700\u6E32\u67D3 \xB7 ${a.drawCalls} \u6B21\u7ED8\u5236`,R("#render-status").title=a.contextLost?"\u53EF\u5C1D\u8BD5\u91CD\u65B0\u8F7D\u5165\u6587\u4EF6":`\u51E0\u4F55 ${a.geometries} \xB7 \u7EB9\u7406 ${a.textures} \xB7 CPU P50 ${a.renderCpuP50.toFixed(1)}ms`}})}catch(a){R("#canvas").innerHTML='<p class="empty" style="padding:180px 30px">\u5F53\u524D\u6D4F\u89C8\u5668\u65E0\u6CD5\u521B\u5EFA WebGL \u753B\u5E03\u3002\u7AEF\u5B50\u63A5\u7EBF\u3001\u56DE\u8DEF\u8BA1\u7B97\u548C\u5BFC\u51FA\u4ECD\u53EF\u4F7F\u7528\u3002</p>',console.warn("WebGL unavailable:",a.message)}ra();
G1&&pe(G1);
