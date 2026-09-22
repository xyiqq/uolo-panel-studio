import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  normalizeUiMode,
  getUiMode,
  isSimpleMode,
  setUiMode,
} from "../../src/core/ui-mode.js";

describe("ui-mode", () => {
  const KEY = "panel-studio-ui-mode";
  beforeEach(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  });
  afterEach(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  });

  it("normalize 仅允许 simple|full，其它回落 simple", () => {
    expect(normalizeUiMode("full")).toBe("full");
    expect(normalizeUiMode("simple")).toBe("simple");
    expect(normalizeUiMode("x")).toBe("simple");
    expect(normalizeUiMode(null)).toBe("simple");
  });

  it("design.uiMode 优先于 localStorage", () => {
    setUiMode({}, "full");
    expect(getUiMode({ uiMode: "simple" })).toBe("simple");
    expect(isSimpleMode({ uiMode: "simple" })).toBe(true);
    expect(isSimpleMode({ uiMode: "full" })).toBe(false);
  });

  it("缺省回落 simple", () => {
    expect(getUiMode({})).toBe("simple");
    expect(isSimpleMode({})).toBe(true);
  });
});
