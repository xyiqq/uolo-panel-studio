/**
 * 菲尼克斯 PT 2.5 推入式端子（导轨附件）。
 * 灰 = 相线 / 负载；蓝 = 零线。灯线先上端子，再跳到继电器。
 * 外形按厂家 PT 2.5 系列常见值：宽 5.2 mm。
 */
import { makeSmartProduct } from "./_smart-factory.js";

const PT_SOURCE = {
  file: "Phoenix Contact PT 2.5 系列",
  url: "https://www.phoenixcontact.com/us/products/3209510/pdf",
  pages: "PT 2.5",
};

function ptStrip(color, poles, orderNo, name) {
  const unit = 5.2;
  const width = +(unit * poles).toFixed(1);
  const modules = +(width / 18).toFixed(3);
  return makeSmartProduct({
    id: `phoenix-pt25-${color}-${poles}`,
    brand: "Phoenix Contact",
    name,
    sku: orderNo,
    kind: "terminal",
    zone: "control",
    smart: true,
    poles,
    channels: poles,
    channelAmps: 24,
    amps: 24,
    width,
    height: 48.6,
    depth: 35.3,
    modules,
    color: color === "bu" ? "#2f6fbf" : "#8a8f96",
    terminalColor: color === "bu" ? "blue" : "gray",
    conductor: color === "bu" ? "N" : "L",
    powerInput: "none",
    source: color === "bu" ? {
      ...PT_SOURCE,
      url: "https://www.phoenixcontact.com/assets/e3493887-5de4-4af1-9966-f497e60dfd31/index.html",
      pages: "71 · PT 2,5 / PT 2,5 BU",
    } : PT_SOURCE,
    note:
      color === "bu"
        ? "蓝色零线端子：灯/负载 N 先上端子，再跳线到模块或 N 排。推入式 PT 2.5。"
        : "灰色相线端子：灯线 L 先上端子，再跳线到继电器通道出线。推入式 PT 2.5。",
  });
}

/** @type {object[]} */
export const PHOENIX_TERMINAL_PRODUCTS = [
  ptStrip("gy", 1, "3209510", "PT 2.5 灰 · 相线/负载"),
  ptStrip("bu", 1, "3209523", "PT 2.5 BU 蓝 · 零线"),
  ptStrip("gy", 4, "3209510×4", "PT 2.5 灰 ×4 排"),
  ptStrip("bu", 4, "3209523×4", "PT 2.5 BU 蓝 ×4 排"),
  ptStrip("gy", 8, "3209510×8", "PT 2.5 灰 ×8 排"),
  ptStrip("bu", 8, "3209523×8", "PT 2.5 BU 蓝 ×8 排"),
  ptStrip("gy", 12, "3209510×12", "PT 2.5 灰 ×12 排"),
  ptStrip("bu", 12, "3209523×12", "PT 2.5 BU 蓝 ×12 排"),
];
