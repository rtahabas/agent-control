import { describe, it, expect, vi, beforeEach } from "vitest";
import { agentHooks } from "@/lib/hooks";
import { makeCanUseTool } from "@/lib/chat-permissions";

type CanUseToolOpts = Parameters<ReturnType<typeof makeCanUseTool>>[2];

function makeOpts(toolUseID: string, signal: AbortSignal): CanUseToolOpts {
  return {
    toolUseID,
    signal,
    suggestions: [],
  } as CanUseToolOpts;
}

beforeEach(() => {
  agentHooks.clear();
});

describe("chat-permissions hook integration", () => {
  it("emits before_tool_call with toolName, input, and sessionId at gate entry", async () => {
    const seen: unknown[] = [];
    agentHooks.on("before_tool_call", (ctx) => {
      seen.push(ctx);
    });

    const ac = new AbortController();
    const emit = vi.fn();
    const can = makeCanUseTool(emit, () => "sess-1");
    const promise = can("ReadFile", { path: "/x" }, makeOpts("t-1", ac.signal));

    await Promise.resolve();
    await Promise.resolve();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      toolName: "ReadFile",
      input: { path: "/x" },
      sessionId: "sess-1",
    });

    ac.abort();
    await promise;
  });

  it("emits after_tool_call with the resolved decision when the gate aborts", async () => {
    const seen: unknown[] = [];
    agentHooks.on("after_tool_call", (ctx) => {
      seen.push(ctx);
    });

    const ac = new AbortController();
    const emit = vi.fn();
    const can = makeCanUseTool(emit, () => "sess-2");
    const promise = can("WriteFile", { path: "/y" }, makeOpts("t-2", ac.signal));

    await Promise.resolve();
    await Promise.resolve();
    ac.abort();
    const result = await promise;

    expect(result.behavior).toBe("deny");
    expect(seen).toHaveLength(1);
    const ctx = seen[0] as { toolName: string; sessionId: string; result: { behavior: string } };
    expect(ctx.toolName).toBe("WriteFile");
    expect(ctx.sessionId).toBe("sess-2");
    expect(ctx.result.behavior).toBe("deny");
  });

  it("forwards input mutated by a before_tool_call subscriber to permission_request", async () => {
    agentHooks.on("before_tool_call", (ctx) => ({
      ...ctx,
      input: { path: "/redacted" },
    }));

    const ac = new AbortController();
    const emit = vi.fn();
    const can = makeCanUseTool(emit, () => "sess-3");
    const promise = can("ReadFile", { path: "/secret" }, makeOpts("t-3", ac.signal));

    await Promise.resolve();
    await Promise.resolve();

    expect(emit).toHaveBeenCalledWith(
      "permission_request",
      expect.objectContaining({ input: { path: "/redacted" } }),
    );

    ac.abort();
    await promise;
  });

  it("does not throw when no subscribers are registered (hooks are emit-and-forget)", async () => {
    const ac = new AbortController();
    const emit = vi.fn();
    const can = makeCanUseTool(emit, () => null);
    const promise = can("ListDir", { path: "/" }, makeOpts("t-4", ac.signal));

    await Promise.resolve();
    await Promise.resolve();
    ac.abort();
    const result = await promise;

    expect(result.behavior).toBe("deny");
    if (result.behavior === "deny") {
      expect(result.message).toBe("aborted");
    }
  });
});
