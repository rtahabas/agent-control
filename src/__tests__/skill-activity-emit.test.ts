import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { emitSkillActivity, resolveLogPath } from "@/lib/skill-activity-emit";
import { agentHooks } from "@/lib/hooks";
import {
  registerSkillSubscriptions,
  _resetSkillSubscriptionsForTests,
} from "@/lib/skill-subscriber";
import type { SkillRegisterFn } from "@/lib/skill-api";
import type { SkillEntry } from "@/lib/skill-parse";

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), "skill-activity-emit-"));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  delete process.env.SKILL_ACTIVITY_LOG_PATH;
  delete process.env.SKILLS_SOURCE_DIR;
});

describe("resolveLogPath", () => {
  it("prefers explicit logPath option", () => {
    const out = resolveLogPath({ logPath: "/explicit/log" });
    expect(out).toBe("/explicit/log");
  });

  it("falls back to SKILL_ACTIVITY_LOG_PATH env var", () => {
    process.env.SKILL_ACTIVITY_LOG_PATH = "/env/log";
    expect(resolveLogPath()).toBe("/env/log");
  });

  it("defaults to nested layout (memory/memory/) when no log file exists yet", () => {
    process.env.SKILLS_SOURCE_DIR = path.join(tmpRoot, ".claude", "skills");
    expect(resolveLogPath()).toBe(
      path.join(tmpRoot, "memory", "memory", "skill-activity.log"),
    );
  });

  it("prefers existing flat-layout log when nested is missing (legacy compat)", () => {
    const flatPath = path.join(tmpRoot, "memory", "skill-activity.log");
    mkdirSync(path.dirname(flatPath), { recursive: true });
    writeFileSync(flatPath, "# placeholder\n");
    process.env.SKILLS_SOURCE_DIR = path.join(tmpRoot, ".claude", "skills");
    expect(resolveLogPath()).toBe(flatPath);
  });

  it("prefers existing nested log over flat when both exist", () => {
    const flatPath = path.join(tmpRoot, "memory", "skill-activity.log");
    const nestedPath = path.join(tmpRoot, "memory", "memory", "skill-activity.log");
    mkdirSync(path.dirname(nestedPath), { recursive: true });
    writeFileSync(flatPath, "# placeholder\n");
    writeFileSync(nestedPath, "# placeholder\n");
    process.env.SKILLS_SOURCE_DIR = path.join(tmpRoot, ".claude", "skills");
    expect(resolveLogPath()).toBe(nestedPath);
  });

  it("returns null when no source can be resolved", () => {
    expect(resolveLogPath()).toBeNull();
  });
});

describe("emitSkillActivity", () => {
  it("creates the log file with header on first write", () => {
    const target = path.join(tmpRoot, "memory", "skill-activity.log");
    const ok = emitSkillActivity("memory-search", 42, { logPath: target });
    expect(ok).toBe(true);
    expect(existsSync(target)).toBe(true);
    const body = readFileSync(target, "utf8");
    expect(body).toContain("# Skill activity log");
    expect(body).toContain("# Format: ISO8601 | skill-name | args-length-chars");
    expect(body).toMatch(/\| memory-search \| 42\n$/);
  });

  it("appends without rewriting header on subsequent writes", () => {
    const target = path.join(tmpRoot, "skill-activity.log");
    emitSkillActivity("first", 1, { logPath: target });
    emitSkillActivity("second", 7, { logPath: target });
    const body = readFileSync(target, "utf8");
    const headerCount = body.match(/# Skill activity log/g)?.length ?? 0;
    expect(headerCount).toBe(1);
    const dataLines = body.split("\n").filter((l) => l && !l.startsWith("#"));
    expect(dataLines).toHaveLength(2);
    expect(dataLines[0]).toMatch(/\| first \| 1$/);
    expect(dataLines[1]).toMatch(/\| second \| 7$/);
  });

  it("uses ISO8601 second-precision timestamp", () => {
    const target = path.join(tmpRoot, "skill-activity.log");
    emitSkillActivity("test", 0, { logPath: target });
    const body = readFileSync(target, "utf8");
    expect(body).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z \| test \| 0$/m);
  });

  it("falls back to <unknown> for empty skill name and clamps negative argLen", () => {
    const target = path.join(tmpRoot, "skill-activity.log");
    emitSkillActivity("", -5, { logPath: target });
    const body = readFileSync(target, "utf8");
    expect(body).toMatch(/\| <unknown> \| 0$/m);
  });

  it("returns false when no log path can be resolved", () => {
    expect(emitSkillActivity("x", 1)).toBe(false);
  });
});

describe("integration via skill-subscriber", () => {
  beforeEach(() => {
    agentHooks.clear();
    _resetSkillSubscriptionsForTests();
  });

  function loader(skills: SkillEntry[]): () => Promise<SkillEntry[]> {
    return async () => skills;
  }

  function moduleLoaderFor(map: Record<string, SkillRegisterFn>) {
    return async (dir: string): Promise<SkillRegisterFn | null> => {
      const name = dir.split("/").pop() ?? "";
      return map[name] ?? null;
    };
  }

  it("emits only for handlers that grow contextSections", async () => {
    const target = path.join(tmpRoot, "skill-activity.log");
    process.env.SKILL_ACTIVITY_LOG_PATH = target;

    await registerSkillSubscriptions({
      sourceDir: "/skills",
      loader: loader([
        { name: "noop-skill", description: "x" },
        { name: "active-skill", description: "x" },
      ]),
      moduleLoader: moduleLoaderFor({
        "noop-skill": (api) => {
          api.on("before_agent_reply", (ctx) => ctx);
        },
        "active-skill": (api) => {
          api.on("before_agent_reply", (ctx) => ({
            ...ctx,
            contextSections: [...ctx.contextSections, "banner"],
          }));
        },
      }),
    });

    await agentHooks.emit("before_agent_reply", {
      agentId: "a",
      cwd: "/x",
      sessionId: null,
      userMessage: "hello world",
      contextSections: [],
    });

    const lines = readFileSync(target, "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/\| active-skill \| 11$/);
    expect(lines[0]).not.toContain("noop-skill");
  });
});
