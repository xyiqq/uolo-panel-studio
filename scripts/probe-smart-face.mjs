import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "docs/_smoke-smart-face-hi.png");

const html = `<!DOCTYPE html><html><body style="margin:0;background:#0d1110;display:grid;place-items:center;min-height:100vh">
<canvas id="c" width="1944" height="504" style="width:972px;height:252px"></canvas>
<script>
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function paintSmartFace(ctx, W, H, product) {
  const brand = product.brand || "";
  const accent = "#6eb5ff";
  const kind = product.kind || "gateway";
  const name = String(product.name || product.id);
  const protocols = product.protocol || [];
  const channels = product.channels || 8;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#343c48");
  bg.addColorStop(0.45, "#252c36");
  bg.addColorStop(1, "#1a1f27");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#0d1014";
  ctx.lineWidth = Math.max(2, H * 0.04);
  ctx.strokeRect(1, 1, W - 2, H - 2);
  const barH = Math.max(6, Math.round(H * 0.1));
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, barH);
  const strip = Math.max(6, Math.round(W * 0.018));
  ctx.fillRect(0, barH, strip, H - barH);
  const padL = strip + Math.round(W * 0.03);
  const padR = Math.round(W * 0.03);
  const contentW = W - padL - padR;
  const midY = barH + (H - barH) * 0.5;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#dce6f0";
  ctx.font = "600 " + Math.round(H * 0.16) + "px Arial";
  ctx.fillText(brand, padL, barH + (H - barH) * 0.22, contentW * 0.42);
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 " + Math.round(H * 0.28) + "px Arial";
  ctx.fillText(name, W - padR, barH + (H - barH) * 0.28, contentW * 0.55);
  ctx.textAlign = "left";
  ctx.fillStyle = "#8fa0b0";
  ctx.font = "500 " + Math.round(H * 0.12) + "px Arial";
  ctx.fillText("SWITCHING ACTUATOR", padL, midY + H * 0.02, contentW * 0.5);
  let bx = W - padR;
  const bh = Math.round(H * 0.22);
  const by = midY - bh / 2 + H * 0.02;
  ctx.textAlign = "center";
  for (let i = protocols.length - 1; i >= 0; i--) {
    const label = protocols[i].toUpperCase();
    ctx.font = "700 " + Math.round(H * 0.11) + "px Arial";
    const tw = ctx.measureText(label).width;
    const bw = tw + Math.round(H * 0.28);
    bx -= bw;
    roundRect(ctx, bx, by, bw, bh, Math.round(bh * 0.2));
    ctx.fillStyle = "#0e1319";
    ctx.fill();
    ctx.lineWidth = Math.max(2, H * 0.035);
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillText(label, bx + bw / 2, by + bh / 2);
    bx -= Math.round(W * 0.012);
  }
  const ledY = barH + (H - barH) * 0.78;
  const ledR = Math.max(3, H * 0.055);
  const ledSpan = Math.min(contentW * 0.7, channels * ledR * 3.2);
  for (let i = 0; i < channels; i++) {
    const x = padL + ledSpan * ((i + 0.5) / channels);
    ctx.beginPath();
    ctx.arc(x, ledY, ledR, 0, Math.PI * 2);
    const on = i === 0;
    ctx.fillStyle = on ? "#3dff9a" : "#1e4a34";
    ctx.fill();
    ctx.strokeStyle = on ? "#b8ffe0" : "#0a1810";
    ctx.stroke();
    ctx.fillStyle = on ? "#2ab56e" : "#243028";
    ctx.fillRect(x - ledR * 0.7, ledY + ledR + 2, ledR * 1.4, Math.max(2, H * 0.04));
  }
  ctx.textAlign = "right";
  ctx.fillStyle = "#6a7a88";
  ctx.font = "500 " + Math.round(H * 0.1) + "px Consolas,monospace";
  ctx.fillText("9M  162×95×60", W - padR, H - Math.round(H * 0.1));
}
const c = document.getElementById("c");
paintSmartFace(c.getContext("2d"), c.width, c.height, {
  brand: "Crestron", name: "DIN-8SW8-I", kind: "relay", protocol: ["cresnet"], channels: 8
});
window.__DONE = true;
</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 400 } });
await page.setContent(html, { waitUntil: "load" });
await page.waitForFunction(() => window.__DONE === true);
await page.locator("#c").screenshot({ path: out });
console.log("wrote", out);
await browser.close();
