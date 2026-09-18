/** 电气符号库（GB/T 4728 风格，单位 mm，线宽 0.35 / 0.5） */

const LW = 0.35;
const LB = 0.5;

function g(cls, body, attrs = "") {
  return `<g class="${cls}"${attrs ? ` ${attrs}` : ""} fill="none" stroke="#1a1a1a" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}

/** 断路器 poles: 1–4 */
export function breaker(poles = 1) {
  const n = Math.max(1, Math.min(4, Number(poles) || 1));
  const gap = 4;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const x = i * gap;
    parts.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="4" stroke-width="${LB}"/>` +
        `<line x1="${x}" y1="4" x2="${x + 2.2}" y2="10" stroke-width="${LB}"/>` +
        `<circle cx="${x}" cy="12" r="0.7" fill="#1a1a1a" stroke="none"/>` +
        `<line x1="${x}" y1="12" x2="${x}" y2="18" stroke-width="${LB}"/>`,
    );
  }
  if (n > 1) {
    parts.push(
      `<line x1="0" y1="7" x2="${(n - 1) * gap}" y2="7" stroke-width="${LW}" stroke-dasharray="1.2 0.8"/>`,
    );
  }
  return g("sym-breaker", parts.join(""), `data-poles="${n}"`);
}

/** 剩余电流动作断路器（RCD / RCCB） */
export function rcd() {
  return g(
    "sym-rcd",
    `<rect x="-3" y="2" width="6" height="14" rx="0.4" stroke-width="${LW}"/>` +
      `<line x1="0" y1="0" x2="0" y2="2" stroke-width="${LB}"/>` +
      `<line x1="0" y1="16" x2="0" y2="18" stroke-width="${LB}"/>` +
      `<path d="M-1.6 8.5 Q0 6.2 1.6 8.5" stroke-width="${LW}"/>` +
      `<text x="0" y="13.2" text-anchor="middle" font-size="2.4" fill="#1a1a1a" stroke="none">RCD</text>`,
  );
}

/** 剩余电流动作保护断路器（RCBO） */
export function rcbo() {
  return g(
    "sym-rcbo",
    `<line x1="0" y1="0" x2="0" y2="4" stroke-width="${LB}"/>` +
      `<line x1="0" y1="4" x2="2.2" y2="10" stroke-width="${LB}"/>` +
      `<circle cx="0" cy="12" r="0.7" fill="#1a1a1a" stroke="none"/>` +
      `<line x1="0" y1="12" x2="0" y2="18" stroke-width="${LB}"/>` +
      `<rect x="3.2" y="4" width="5.5" height="10" rx="0.3" stroke-width="${LW}"/>` +
      `<path d="M4.4 9.2 Q6 7.2 7.6 9.2" stroke-width="${LW}"/>` +
      `<text x="6" y="12.8" text-anchor="middle" font-size="2" fill="#1a1a1a" stroke="none">Vigi</text>`,
  );
}

/** 浪涌保护器 SPD */
export function spd() {
  return g(
    "sym-spd",
    `<line x1="0" y1="0" x2="0" y2="5" stroke-width="${LB}"/>` +
      `<path d="M-2.5 5 L2.5 5 L0 11 Z" stroke-width="${LB}"/>` +
      `<line x1="0" y1="11" x2="0" y2="14" stroke-width="${LB}"/>` +
      `<path d="M-2.2 14 H2.2 M-1.4 16 H1.4 M-0.6 18 H0.6" stroke-width="${LW}"/>` +
      `<text x="4.5" y="10" font-size="2.4" fill="#1a1a1a" stroke="none">SPD</text>`,
  );
}

/** 隔离开关 */
export function isolator() {
  return g(
    "sym-isolator",
    `<line x1="0" y1="0" x2="0" y2="5" stroke-width="${LB}"/>` +
      `<line x1="0" y1="5" x2="3.5" y2="12" stroke-width="${LB}"/>` +
      `<circle cx="0" cy="14" r="0.8" stroke-width="${LW}"/>` +
      `<line x1="0" y1="14.8" x2="0" y2="18" stroke-width="${LB}"/>` +
      `<text x="5" y="10" font-size="2.2" fill="#1a1a1a" stroke="none">ISO</text>`,
  );
}

/** 接触器 */
export function contactor() {
  return g(
    "sym-contactor",
    `<line x1="0" y1="0" x2="0" y2="4" stroke-width="${LB}"/>` +
      `<line x1="-2.5" y1="6" x2="2.5" y2="6" stroke-width="${LB}"/>` +
      `<line x1="-2.5" y1="12" x2="2.5" y2="12" stroke-width="${LB}"/>` +
      `<line x1="0" y1="6" x2="0" y2="12" stroke-width="${LW}"/>` +
      `<line x1="0" y1="12" x2="0" y2="18" stroke-width="${LB}"/>` +
      `<text x="4" y="10" font-size="2.2" fill="#1a1a1a" stroke="none">K</text>`,
  );
}

/** 继电器 */
export function relay() {
  return g(
    "sym-relay",
    `<rect x="-3.5" y="3" width="7" height="12" rx="0.4" stroke-width="${LW}"/>` +
      `<line x1="0" y1="0" x2="0" y2="3" stroke-width="${LB}"/>` +
      `<line x1="0" y1="15" x2="0" y2="18" stroke-width="${LB}"/>` +
      `<circle cx="0" cy="9" r="1.6" stroke-width="${LW}"/>` +
      `<text x="5" y="10" font-size="2.2" fill="#1a1a1a" stroke="none">RELAY</text>`,
  );
}

/** 调光器 */
export function dimmer() {
  return g(
    "sym-dimmer",
    `<rect x="-3.5" y="3" width="7" height="12" rx="0.4" stroke-width="${LW}"/>` +
      `<line x1="0" y1="0" x2="0" y2="3" stroke-width="${LB}"/>` +
      `<line x1="0" y1="15" x2="0" y2="18" stroke-width="${LB}"/>` +
      `<path d="M-1.8 11 L0 6 L1.8 11 Z" stroke-width="${LW}"/>` +
      `<text x="5" y="10" font-size="2.2" fill="#1a1a1a" stroke="none">DIM</text>`,
  );
}

/** 电能表 */
export function meter() {
  return g(
    "sym-meter",
    `<circle cx="0" cy="9" r="5.5" stroke-width="${LB}"/>` +
      `<line x1="0" y1="0" x2="0" y2="3.5" stroke-width="${LB}"/>` +
      `<line x1="0" y1="14.5" x2="0" y2="18" stroke-width="${LB}"/>` +
      `<text x="0" y="10.2" text-anchor="middle" font-size="2.6" fill="#1a1a1a" stroke="none">Wh</text>`,
  );
}

/** 端子 */
export function terminal() {
  return g(
    "sym-terminal",
    `<circle cx="0" cy="9" r="2.2" stroke-width="${LB}"/>` +
      `<line x1="0" y1="0" x2="0" y2="6.8" stroke-width="${LW}"/>` +
      `<line x1="0" y1="11.2" x2="0" y2="18" stroke-width="${LW}"/>`,
  );
}

/** 母排（水平段） */
export function busbar(length = 20) {
  const len = Math.max(4, Number(length) || 20);
  return g(
    "sym-busbar",
    `<line x1="0" y1="0" x2="${len}" y2="0" stroke-width="${LB}"/>` +
      `<line x1="0" y1="-0.8" x2="0" y2="0.8" stroke-width="${LW}"/>` +
      `<line x1="${len}" y1="-0.8" x2="${len}" y2="0.8" stroke-width="${LW}"/>`,
  );
}

/** PE / 接地符号 */
export function pe() {
  return g(
    "sym-pe",
    `<line x1="0" y1="0" x2="0" y2="8" stroke-width="${LB}"/>` +
      `<line x1="-3.5" y1="8" x2="3.5" y2="8" stroke-width="${LB}"/>` +
      `<line x1="-2.2" y1="10.2" x2="2.2" y2="10.2" stroke-width="${LW}"/>` +
      `<line x1="-1" y1="12.4" x2="1" y2="12.4" stroke-width="${LW}"/>` +
      `<text x="5" y="10" font-size="2.4" fill="#1a1a1a" stroke="none">PE</text>`,
  );
}

/** 网关 */
export function gateway() {
  return g(
    "sym-gateway",
    `<rect x="-5" y="2" width="10" height="14" rx="0.5" stroke-width="${LW}"/>` +
      `<line x1="0" y1="0" x2="0" y2="2" stroke-width="${LB}"/>` +
      `<line x1="0" y1="16" x2="0" y2="18" stroke-width="${LB}"/>` +
      `<text x="0" y="10.5" text-anchor="middle" font-size="2.8" fill="#1a1a1a" stroke="none">GW</text>`,
  );
}

/** 电源模块 */
export function psu() {
  return g(
    "sym-psu",
    `<rect x="-5" y="2" width="10" height="14" rx="0.5" stroke-width="${LW}"/>` +
      `<line x1="0" y1="0" x2="0" y2="2" stroke-width="${LB}"/>` +
      `<line x1="0" y1="16" x2="0" y2="18" stroke-width="${LB}"/>` +
      `<text x="0" y="10.5" text-anchor="middle" font-size="2.6" fill="#1a1a1a" stroke="none">PSU</text>`,
  );
}
