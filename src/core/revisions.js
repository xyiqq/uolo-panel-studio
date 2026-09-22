/**
 * 修订记录与签认（P3-3）
 * commit 不写修订；导出 / 打印时追加一条，版本号即 revisions.length。
 */

import { localStamp } from "./checklist-spec.js";

const ROLES = ["designer", "reviewer", "installer"];

export const SIGNOFF_ROLE_LABELS = {
  designer: "设计",
  reviewer: "审核",
  installer: "安装",
};

/**
 * 追加一条修订（就地修改 design，返回新版本号）
 * @param {object} design
 * @param {string} summary 修订摘要
 * @param {{ errors?: number, pending?: number }} counts
 * @param {string} [now] ISO 时间，便于测试注入
 * @returns {number} 新的 Rev 序号
 */
export function addRevision(design, summary, counts = {}, now) {
  if (!design) return 0;
  if (!Array.isArray(design.revisions)) design.revisions = [];
  const at = localStamp(now);
  design.revisions.push({
    at,
    summary: String(summary || "").trim() || "未填写摘要",
    errors: Number(counts.errors || 0),
    pending: Number(counts.pending || 0),
  });
  design.updatedAt = at;
  return design.revisions.length;
}

/** 当前版本标签 */
export function revisionLabel(design) {
  const n = Array.isArray(design?.revisions) ? design.revisions.length : 0;
  return n > 0 ? `Rev ${n}` : "Rev 0 · 未记录修订";
}

/**
 * 写入签认（就地修改）
 * @param {object} design
 * @param {"designer"|"reviewer"|"installer"} role
 * @param {{ name?: string, at?: string, note?: string }} value
 * @param {string} [now]
 */
export function setSignoff(design, role, value = {}, now) {
  if (!design || !ROLES.includes(role)) return design?.signoff;
  if (!design.signoff || typeof design.signoff !== "object") design.signoff = {};
  const name = String(value.name || "").trim();
  if (!name) {
    delete design.signoff[role];
    return design.signoff;
  }
  design.signoff[role] = {
    name,
    at: signoffDate(value.at, now),
    note: String(value.note || "").trim(),
  };
  return design.signoff;
}

function signoffDate(value, now) {
  if (!value) return localStamp(now).slice(0, 10);
  const date = String(value).trim();
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new RangeError('签认日期必须是有效的 YYYY-MM-DD 日期');
  }
  return date;
}

/** 同一次导出的所有文件共用的版本元信息。 */
export function deliveryMetadata(design) {
  const revisions = design?.revisions || [];
  return { designId: design?.designId || '', name: design?.name || '', revision: revisionLabel(design),
    at: revisions.at(-1)?.at || design?.updatedAt || design?.createdAt || '',
    summary: revisions.at(-1)?.summary || '', signoff: structuredClone(design?.signoff || {}) };
}

/** 签认状态摘要文案 */
export function signoffSummary(design) {
  const s = design?.signoff || {};
  const filled = ROLES.filter((r) => s[r]?.name);
  if (!filled.length) return "未签认";
  return filled.map((r) => `${SIGNOFF_ROLE_LABELS[r]} ${s[r].name}`).join(" · ");
}

export { ROLES as SIGNOFF_ROLES };
