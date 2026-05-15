import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type SkillStateModule = typeof import("@/lib/skill-state");

let tmpDb: string;
let mod: SkillStateModule;

beforeEach(async () => {
  tmpDb = path.join(os.tmpdir(), `skill-state-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  process.env.AGENT_DB_PATH = tmpDb;
  vi.resetModules();
  mod = await import("@/lib/skill-state");
});

afterEach(() => {
  try { fs.unlinkSync(tmpDb); } catch { /* ignore */ }
  delete process.env.AGENT_DB_PATH;
});

describe("skill-state", () => {
  it("defaults to enabled when no row exists", () => {
    expect(mod.isSkillEnabled("memory-search")).toBe(true);
  });

  it("setSkillEnabled(false) persists disabled state", () => {
    mod.setSkillEnabled("memory-search", false);
    expect(mod.isSkillEnabled("memory-search")).toBe(false);
  });

  it("setSkillEnabled(true) clears the row (default behaviour)", () => {
    mod.setSkillEnabled("foo", false);
    expect(mod.getDisabledSkills().has("foo")).toBe(true);
    mod.setSkillEnabled("foo", true);
    expect(mod.isSkillEnabled("foo")).toBe(true);
    expect(mod.getDisabledSkills().has("foo")).toBe(false);
  });

  it("getDisabledSkills returns the set of disabled names", () => {
    mod.setSkillEnabled("a", false);
    mod.setSkillEnabled("b", false);
    mod.setSkillEnabled("c", true);
    const disabled = mod.getDisabledSkills();
    expect(disabled.has("a")).toBe(true);
    expect(disabled.has("b")).toBe(true);
    expect(disabled.has("c")).toBe(false);
  });

  it("toggleSkillEnabled flips the state", () => {
    expect(mod.toggleSkillEnabled("x")).toEqual({ changed: true, enabled: false });
    expect(mod.isSkillEnabled("x")).toBe(false);
    expect(mod.toggleSkillEnabled("x")).toEqual({ changed: true, enabled: true });
    expect(mod.isSkillEnabled("x")).toBe(true);
  });

  it("rejects invalid skill names", () => {
    expect(mod.isValidSkillName("")).toBe(false);
    expect(mod.isValidSkillName("../etc/passwd")).toBe(false);
    expect(mod.isValidSkillName("UPPER")).toBe(false);
    expect(mod.isValidSkillName("a".repeat(65))).toBe(false);
    expect(mod.setSkillEnabled("../bad", false)).toBe(false);
    expect(mod.toggleSkillEnabled("../bad")).toEqual({ changed: false, enabled: true });
    expect(mod.isSkillEnabled("../bad")).toBe(true);
  });
});
