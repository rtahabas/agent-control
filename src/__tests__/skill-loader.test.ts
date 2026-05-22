import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadSkillModule } from "@/lib/skill-loader";
import { createSkillApi } from "@/lib/skill-api";
import { agentHooks } from "@/lib/hooks";

const FIXTURES = path.resolve(__dirname, "__fixtures__/skills");

describe("loadSkillModule", () => {
  it("returns the register function for a skill exposing a named export", async () => {
    const register = await loadSkillModule(path.join(FIXTURES, "echo-context"));
    expect(typeof register).toBe("function");
  });

  it("returns the register function when exported via default", async () => {
    const register = await loadSkillModule(path.join(FIXTURES, "default-export"));
    expect(typeof register).toBe("function");
  });

  it("returns null when the skill directory has no entry file", async () => {
    const register = await loadSkillModule(path.join(FIXTURES, "no-module"));
    expect(register).toBeNull();
  });

  it("returns null when the module exposes no register function", async () => {
    const register = await loadSkillModule(path.join(FIXTURES, "no-register"));
    expect(register).toBeNull();
  });

  it("returns null when the directory does not exist", async () => {
    const register = await loadSkillModule(path.join(FIXTURES, "__missing__"));
    expect(register).toBeNull();
  });

  it("loaded register actually subscribes a working handler", async () => {
    agentHooks.clear();
    const register = await loadSkillModule(path.join(FIXTURES, "echo-context"));
    expect(register).not.toBeNull();
    const handle = createSkillApi("echo-context");
    await register!(handle.api);
    expect(handle.hookCount()).toBe(1);

    const result = await agentHooks.emit("before_agent_reply", {
      agentId: "alpha",
      cwd: "/x",
      sessionId: null,
      userMessage: "hi",
      contextSections: ["seed"],
    });
    expect(result.contextSections).toEqual(["seed", "echo:alpha"]);

    handle.dispose();
    agentHooks.clear();
  });
});
