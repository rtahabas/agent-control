import { describe, it, expect, beforeEach } from "vitest";
import { agentHooks } from "@/lib/hooks";
import {
  registerRuntimeContext,
  _resetRuntimeContextForTests,
} from "@/lib/runtime-context-subscriber";

const FIXED_NOW = () => new Date("2026-05-14T12:00:00Z");

beforeEach(() => {
  agentHooks.clear();
  _resetRuntimeContextForTests();
});

describe("registerRuntimeContext", () => {
  it("appends a runtime context section with agentId and ISO date", async () => {
    registerRuntimeContext(FIXED_NOW);
    const result = await agentHooks.emit("before_agent_reply", {
      agentId: "alpha",
      cwd: "/x",
      sessionId: null,
      contextSections: [],
    });
    expect(result.contextSections).toHaveLength(1);
    expect(result.contextSections[0]).toBe(
      "Runtime context: agent=alpha, date=2026-05-14",
    );
  });

  it("is idempotent — calling register multiple times subscribes only once", async () => {
    registerRuntimeContext(FIXED_NOW);
    registerRuntimeContext(FIXED_NOW);
    registerRuntimeContext(FIXED_NOW);
    const result = await agentHooks.emit("before_agent_reply", {
      agentId: "alpha",
      cwd: "/x",
      sessionId: null,
      contextSections: [],
    });
    expect(result.contextSections).toHaveLength(1);
  });

  it("preserves context sections already produced by earlier subscribers", async () => {
    agentHooks.on("before_agent_reply", (ctx) => ({
      ...ctx,
      contextSections: [...ctx.contextSections, "Pre-existing section"],
    }));
    registerRuntimeContext(FIXED_NOW);
    const result = await agentHooks.emit("before_agent_reply", {
      agentId: "beta",
      cwd: "/y",
      sessionId: null,
      contextSections: [],
    });
    expect(result.contextSections).toHaveLength(2);
    expect(result.contextSections[0]).toBe("Pre-existing section");
    expect(result.contextSections[1]).toBe(
      "Runtime context: agent=beta, date=2026-05-14",
    );
  });

  it("uses the agentId from each invocation, not the registration time", async () => {
    registerRuntimeContext(FIXED_NOW);
    const a = await agentHooks.emit("before_agent_reply", {
      agentId: "first",
      cwd: "/x",
      sessionId: null,
      contextSections: [],
    });
    const b = await agentHooks.emit("before_agent_reply", {
      agentId: "second",
      cwd: "/x",
      sessionId: null,
      contextSections: [],
    });
    expect(a.contextSections[0]).toContain("agent=first");
    expect(b.contextSections[0]).toContain("agent=second");
  });
});
