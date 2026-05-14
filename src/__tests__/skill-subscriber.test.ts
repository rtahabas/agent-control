import { describe, it, expect, beforeEach, vi } from "vitest";
import { agentHooks } from "@/lib/hooks";
import type { SkillEntry } from "@/lib/skill-parse";
import {
  registerSkillSubscriptions,
  _resetSkillSubscriptionsForTests,
} from "@/lib/skill-subscriber";

function loader(skills: SkillEntry[]): () => Promise<SkillEntry[]> {
  return async () => skills;
}

beforeEach(() => {
  agentHooks.clear();
  _resetSkillSubscriptionsForTests();
});

describe("registerSkillSubscriptions", () => {
  it("subscribes a no-op handler for each valid hook in lifecycle.hooks", async () => {
    const count = await registerSkillSubscriptions(
      loader([
        {
          name: "skill-a",
          description: "x",
          lifecycle: { hooks: ["before_agent_reply", "agent_end"] },
        },
      ]),
    );
    expect(count).toBe(2);

    const seen: string[] = [];
    agentHooks.on("before_agent_reply", (ctx) => {
      seen.push("manual");
      return ctx;
    });
    await agentHooks.emit("before_agent_reply", {
      agentId: "a",
      cwd: "/x",
      sessionId: null,
      contextSections: [],
    });
    expect(seen).toEqual(["manual"]);
  });

  it("skips skills without lifecycle.hooks", async () => {
    const count = await registerSkillSubscriptions(
      loader([
        { name: "no-hooks", description: "x" },
        { name: "empty-lifecycle", description: "x", lifecycle: {} },
      ]),
    );
    expect(count).toBe(0);
  });

  it("filters out unknown hook names", async () => {
    const count = await registerSkillSubscriptions(
      loader([
        {
          name: "mixed",
          description: "x",
          lifecycle: { hooks: ["before_agent_reply", "fake_hook", "agent_end"] },
        },
      ]),
    );
    expect(count).toBe(2);
  });

  it("aggregates subscriptions across multiple skills", async () => {
    const count = await registerSkillSubscriptions(
      loader([
        { name: "a", description: "x", lifecycle: { hooks: ["before_tool_call"] } },
        { name: "b", description: "x", lifecycle: { hooks: ["after_tool_call", "agent_end"] } },
      ]),
    );
    expect(count).toBe(3);
  });

  it("is idempotent — second call returns 0 and does not re-subscribe", async () => {
    const first = await registerSkillSubscriptions(
      loader([
        { name: "a", description: "x", lifecycle: { hooks: ["before_agent_reply"] } },
      ]),
    );
    const second = await registerSkillSubscriptions(
      loader([
        { name: "a", description: "x", lifecycle: { hooks: ["before_agent_reply"] } },
      ]),
    );
    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it("placeholder subscriber leaves context unchanged", async () => {
    await registerSkillSubscriptions(
      loader([
        { name: "a", description: "x", lifecycle: { hooks: ["before_agent_reply"] } },
      ]),
    );
    const result = await agentHooks.emit("before_agent_reply", {
      agentId: "alpha",
      cwd: "/x",
      sessionId: null,
      contextSections: ["initial"],
    });
    expect(result.contextSections).toEqual(["initial"]);
  });

  it("supports an empty catalog without throwing", async () => {
    const count = await registerSkillSubscriptions(loader([]));
    expect(count).toBe(0);
  });

  it("does not throw when a skill defines an empty hooks array", async () => {
    const fakeSkill = {
      name: "empty",
      description: "x",
      lifecycle: { hooks: [] as string[] },
    } as SkillEntry;
    const count = await registerSkillSubscriptions(loader([fakeSkill]));
    expect(count).toBe(0);
  });
});
