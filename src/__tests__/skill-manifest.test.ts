import { describe, it, expect } from "vitest";
import { parseFrontmatter, buildSkillEntry } from "@/lib/skill-fs";

describe("parseFrontmatter", () => {
  it("returns an empty object when there is no frontmatter block", () => {
    expect(parseFrontmatter("just markdown body")).toEqual({});
  });

  it("parses flat key/value pairs (backward compatible)", () => {
    const raw = `---
name: test-skill
description: Single line description
---
# Body`;
    const fm = parseFrontmatter(raw);
    expect(fm.name).toBe("test-skill");
    expect(fm.description).toBe("Single line description");
  });

  it("parses nested objects and arrays", () => {
    const raw = `---
name: nested-skill
description: nested
activation:
  onStartup: true
lifecycle:
  hooks:
    - before_agent_reply
    - agent_end
configSchema:
  apiKey:
    type: string
    required: true
---
body`;
    const fm = parseFrontmatter(raw);
    expect(fm.activation).toEqual({ onStartup: true });
    expect(fm.lifecycle).toEqual({ hooks: ["before_agent_reply", "agent_end"] });
    expect(fm.configSchema).toEqual({ apiKey: { type: "string", required: true } });
  });

  it("returns an empty object on malformed YAML", () => {
    const raw = `---
this is: not: valid: yaml:
nested: { broken
---
body`;
    expect(parseFrontmatter(raw)).toEqual({});
  });
});

describe("buildSkillEntry", () => {
  it("falls back to the directory name when frontmatter has no name", () => {
    const entry = buildSkillEntry({}, "fallback-dir");
    expect(entry.name).toBe("fallback-dir");
    expect(entry.description).toBe("");
  });

  it("preserves name and description from frontmatter", () => {
    const entry = buildSkillEntry({ name: "x", description: "y" }, "dir");
    expect(entry).toEqual({ name: "x", description: "y" });
  });

  it("includes activation when onStartup is a boolean", () => {
    const entry = buildSkillEntry(
      { name: "x", description: "y", activation: { onStartup: true } },
      "d",
    );
    expect(entry.activation).toEqual({ onStartup: true });
  });

  it("rejects activation when onStartup is not a boolean", () => {
    const entry = buildSkillEntry(
      { name: "x", description: "y", activation: { onStartup: "yes" } },
      "d",
    );
    expect(entry.activation).toBeUndefined();
  });

  it("includes lifecycle.hooks when it is a string array", () => {
    const entry = buildSkillEntry(
      { name: "x", description: "y", lifecycle: { hooks: ["before_agent_reply"] } },
      "d",
    );
    expect(entry.lifecycle).toEqual({ hooks: ["before_agent_reply"] });
  });

  it("filters out non-string entries from lifecycle.hooks", () => {
    const entry = buildSkillEntry(
      { name: "x", description: "y", lifecycle: { hooks: ["valid", 123, true] } },
      "d",
    );
    expect(entry.lifecycle).toEqual({ hooks: ["valid"] });
  });

  it("rejects lifecycle when hooks is missing", () => {
    const entry = buildSkillEntry(
      { name: "x", description: "y", lifecycle: {} },
      "d",
    );
    expect(entry.lifecycle).toBeUndefined();
  });

  it("preserves configSchema as a plain object", () => {
    const entry = buildSkillEntry(
      {
        name: "x",
        description: "y",
        configSchema: { apiKey: { type: "string" } },
      },
      "d",
    );
    expect(entry.configSchema).toEqual({ apiKey: { type: "string" } });
  });

  it("does not add optional fields when not provided (backward compat)", () => {
    const entry = buildSkillEntry({ name: "x", description: "y" }, "d");
    expect(entry.activation).toBeUndefined();
    expect(entry.lifecycle).toBeUndefined();
    expect(entry.configSchema).toBeUndefined();
  });
});
