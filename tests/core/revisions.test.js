import { describe, it, expect } from "vitest";
import {
  addRevision,
  revisionLabel,
  setSignoff,
  signoffSummary,
} from "../../src/core/revisions.js";
import {
  setChecklistItem,
  checklistProgress,
  checklistItemIds,
} from "../../src/core/checklist-spec.js";

describe("revisions · 修订与签认", () => {
  it("连续导出得到 Rev 1 / Rev 2", () => {
    const design = {};
    expect(revisionLabel(design)).toContain("Rev 0");
    expect(addRevision(design, "首次导出", { errors: 0, pending: 56 }, "2026-09-19T10:00")).toBe(1);
    expect(addRevision(design, "调整线径", { errors: 1, pending: 55 }, "2026-09-19T11:00")).toBe(2);
    expect(revisionLabel(design)).toBe("Rev 2");
    expect(design.revisions[0].summary).toBe("首次导出");
    expect(design.revisions[1].errors).toBe(1);
  });

  it("空摘要不丢记录", () => {
    const design = {};
    addRevision(design, "   ", {}, "2026-09-19T10:00");
    expect(design.revisions[0].summary).toBe("未填写摘要");
  });

  it("签认可写入与清除", () => {
    const design = {};
    setSignoff(design, "designer", { name: "张工" }, "2026-09-19T10:00");
    expect(signoffSummary(design)).toBe("设计 张工");
    setSignoff(design, "designer", { name: "" });
    expect(signoffSummary(design)).toBe("未签认");
  });
});

describe("checklist · 检查记录", () => {
  it("勾选与记录值写入并可撤回", () => {
    const ids = checklistItemIds();
    expect(ids.length).toBe(14);
    let state = setChecklistItem({}, ids[0], { checked: true }, "2026-09-19T10:00");
    expect(state[ids[0]].checked).toBe(true);
    expect(state[ids[0]].at).toBe("2026-09-19 10:00");
    state = setChecklistItem(state, ids[1], { value: "0.5 MΩ" });
    expect(checklistProgress(state)).toEqual({ done: 1, total: ids.length });
    state = setChecklistItem(state, ids[0], { checked: false });
    expect(state[ids[0]]).toBeUndefined();
  });
});
