import { describe, it, expect, beforeEach } from "vitest";
import { agentHooks } from "@/lib/hooks";
import type { SkillEntry } from "@/lib/skill-parse";
import type { SkillRegisterFn } from "@/lib/skill-api";
import {
  registerSkillSubscriptions,
  _resetSkillSubscriptionsForTests,
} from "@/lib/skill-subscriber";

function listLoader(skills: SkillEntry[]): () => Promise<SkillEntry[]> {
  return async () => skills;
}

function moduleLoaderFor(map: Record<string, SkillRegisterFn | null>) {
  return async (skillDir: string): Promise<SkillRegisterFn | null> => {
    const name = skillDir.split("/").pop() ?? "";
    return map[name] ?? null;
  };
}

beforeEach(() => {
  agentHooks.clear();
  _resetSkillSubscriptionsForTests();
});

describe("registerSkillSubscriptions", () => {
  it("loads each enabled skill module and counts api.on calls", async () => {
    const count = await registerSkillSubscriptions({
      sourceDir: "/skills",
      loader: listLoader([
        { name: "a", description: "x" },
        { name: "b", description: "x" },
      ]),
      moduleLoader: moduleLoaderFor({
        a: (api) => {
          api.on("before_agent_reply", (ctx) => ctx);
          api.on("agent_end", () => undefined);
        },
        b: (api) => {
          api.on("before_tool_call", (ctx) => ctx);
        },
      }),
    });
    expect(count).toBe(3);
  });

  it("skips skills with enabled === false", async () => {
    const count = await registerSkillSubscriptions({
      sourceDir: "/skills",
      loader: listLoader([
        { name: "off", description: "x", enabled: false },
        { name: "on", description: "x", enabled: true },
      ]),
      moduleLoader: moduleLoaderFor({
        off: (api) => api.on("agent_end", () => undefined),
        on: (api) => api.on("agent_end", () => undefined),
      }),
    });
    expect(count).toBe(1);
  });

  it("skips skills whose module loader returns null", async () => {
    const count = await registerSkillSubscriptions({
      sourceDir: "/skills",
      loader: listLoader([
        { name: "code", description: "x" },
        { name: "manifest-only", description: "x" },
      ]),
      moduleLoader: moduleLoaderFor({
        code: (api) => api.on("agent_end", () => undefined),
        "manifest-only": null,
      }),
    });
    expect(count).toBe(1);
  });

  it("isolates a throwing register so the next skill still loads", async () => {
    const count = await registerSkillSubscriptions({
      sourceDir: "/skills",
      loader: listLoader([
        { name: "bad", description: "x" },
        { name: "good", description: "x" },
      ]),
      moduleLoader: moduleLoaderFor({
        bad: () => {
          throw new Error("intentional");
        },
        good: (api) => {
          api.on("before_agent_reply", (ctx) => ctx);
          api.on("agent_end", () => undefined);
        },
      }),
    });
    expect(count).toBe(2);
  });

  it("disposes partial subscriptions when register throws mid-way", async () => {
    await registerSkillSubscriptions({
      sourceDir: "/skills",
      loader: listLoader([{ name: "partial", description: "x" }]),
      moduleLoader: moduleLoaderFor({
        partial: (api) => {
          api.on("before_agent_reply", (ctx) => ({
            ...ctx,
            contextSections: [...ctx.contextSections, "leak"],
          }));
          throw new Error("after first on()");
        },
      }),
    });

    const result = await agentHooks.emit("before_agent_reply", {
      agentId: "a",
      cwd: "/x",
      sessionId: null,
      userMessage: "hi",
      contextSections: [],
    });
    expect(result.contextSections).toEqual([]);
  });

  it("returns 0 when SKILLS_SOURCE_DIR is unset and no override provided", async () => {
    const prev = process.env.SKILLS_SOURCE_DIR;
    delete process.env.SKILLS_SOURCE_DIR;
    try {
      const count = await registerSkillSubscriptions({
        loader: listLoader([{ name: "a", description: "x" }]),
        moduleLoader: moduleLoaderFor({
          a: (api) => api.on("agent_end", () => undefined),
        }),
      });
      expect(count).toBe(0);
    } finally {
      if (prev !== undefined) process.env.SKILLS_SOURCE_DIR = prev;
    }
  });

  it("is idempotent — second call returns 0 and does not re-subscribe", async () => {
    const opts = {
      sourceDir: "/skills",
      loader: listLoader([{ name: "a", description: "x" }]),
      moduleLoader: moduleLoaderFor({
        a: (api) => api.on("before_agent_reply", (ctx) => ctx),
      }),
    };
    const first = await registerSkillSubscriptions(opts);
    const second = await registerSkillSubscriptions(opts);
    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it("registered handler is actually wired to the hook bus", async () => {
    await registerSkillSubscriptions({
      sourceDir: "/skills",
      loader: listLoader([{ name: "tag", description: "x" }]),
      moduleLoader: moduleLoaderFor({
        tag: (api) => {
          api.on("before_agent_reply", (ctx) => ({
            ...ctx,
            contextSections: [...ctx.contextSections, "tagged"],
          }));
        },
      }),
    });
    const result = await agentHooks.emit("before_agent_reply", {
      agentId: "a",
      cwd: "/x",
      sessionId: null,
      userMessage: "hi",
      contextSections: ["seed"],
    });
    expect(result.contextSections).toEqual(["seed", "tagged"]);
  });
});

