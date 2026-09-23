/**
 * SVG 视觉 Token（系统图 / 面标 / 端子示意共用）
 * 目标：颜色、字号、线宽、字体栈单一来源，避免多处魔法数分叉。
 * 色彩延续现有工程绿灰：页眉浅绿灰、强调深绿、免责暗红；
 * 相线与 CONDUCTOR_COLORS 保持一致（此处为视图层唯一来源），
 * 并为 L1/L2/L3 提供线型兜底，黑白打印仍可辨。
 * 口径：条件性方案 · 非施工合格结论。
 */

/** 文案口径（页眉 / 页脚 / 水印 / 文档页共用） */
export const DISCLAIMER = "条件性方案 · 非施工合格结论";

/** 字体栈：中文优先系统字体，不依赖联网 Web 字体。
 * 注意：栈内不使用引号，保证可直接放入 SVG/XML 属性值。 */
export const FONT_STACK = "Microsoft YaHei,PingFang SC,Segoe UI,Arial,sans-serif";

/** 颜色 Token */
export const C = {
  ink: "#1a1a1a", // 主文字 / 符号描边
  muted: "#445", // 次级文字
  faint: "#667", // 辅助文字 / 字段标签
  line: "#c9d2ca", // 分隔线 / 卡片描边
  paper: "#ffffff", // 纸面
  card: "#fafcfa", // 回路列底
  headerBg: "#eef3ee", // 页眉带
  accent: "#2a8d68", // 工程绿强调
  danger: "#a33", // 免责声明（克制使用）
  busWarn: "#c75548", // 未接通/告警
  peOk: "#398957", // PE 已连通
  peIdle: "#d2b737", // PE 路径黄线
  watermark: "#c9d2c9", // 水印
  off: "#aab7af", // 未带电/未达端口
};

/** 相线颜色（含 N / PE），与原 CONDUCTOR_COLORS 一致 */
export const PHASE_COLORS = {
  L1: "#d9aa30",
  L2: "#27925d",
  L3: "#d9574f",
  N: "#429cdd",
  PE: "#afc143",
};

/**
 * 相线线型兜底（stroke-dasharray；"" 表示实线）。
 * 黑白打印时颜色不可辨，用线型 + 文字标注双兜底。
 */
export const PHASE_DASH = {
  L1: "",
  L2: "3.5 1.6",
  L3: "1.4 1.4",
  N: "",
  PE: "",
};

/** 字号阶梯（系统图 mm 坐标系） */
export const FS = {
  title: 3.8, // 页眉主标题
  sub: 2.2, // 页眉次行
  section: 3.2, // 分区标题（进线区）
  id: 2.6, // 回路 id
  name: 2.1, // 回路名称
  body: 1.8, // 参数字段
  tiny: 1.6, // 路径等弱信息
  foot: 2.0, // 页脚
  bus: 2.2, // 母排标注
  watermark: 14, // 水印
};

/** 线宽阶梯（与符号库一致） */
export const LW = {
  thin: 0.25, // 引线 / 卡片描边
  sym: 0.35, // 符号细线
  bold: 0.5, // 符号主线
  bus: 0.7, // 母排
};

/** 省略号截断：超出 max 时保留前 max-1 字并加 …（ slice 视觉升级版） */
export function ellipsis(v, max) {
  const s = String(v ?? "");
  if (!max || s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + "…";
}
