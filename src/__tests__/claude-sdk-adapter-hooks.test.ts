import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentHarnessAttemptParams, AgentHarnessEmit } from "@/lib/agent-harness";
import { agentHooks } from "@/lib/hooks";

vi.mock("@/lib/claude-stream", () => ({
  spawnClaude: vi.fn(),
}));

import { spawnClaude } from "@/lib/claude-stream";
import { claudeSdkAdapter } from "@/lib/claude-sdk-adapter";

const mockSpawnClaude = vi.mocked(spawnClaude);

function buildParams(overrides?: Partial<AgentHarnessAttemptParams>): AgentHarnessAttemptParams {
  return {
    agentId: "test-agent",
    message: "hello",
    sessionId: null,
    cwd: "/tmp/agent",
    emit: (() => {}) as AgentHarnessEmit,
    onClose: () => {},
    abortSignal: new AbortController().signal,
    ...overrides,
  };
}

beforeEach(() => {
  mockSpawnClaude.mockReset();
  mockSpawnClaude.mockImplementation(async ({ emit, sessionId, onClose }) => {
    if (!sessionId) emit("session", { id: "new-session-id" });
    onClose();
  });
  agentHooks.clear();
});

describe("claudeSdkAdapter — before_agent_reply hook", () => {
  it("emits with agentId, cwd, sessionId, and an empty contextSections array", async () => {
    const seen: unknown[] = [];
    agentHooks.on("before_agent_reply", (ctx) => {
      seen.push(ctx);
    });
    await claudeSdkAdapter.runAttempt(
      buildParams({ agentId: "alpha", cwd: "/x", sessionId: "s1" })
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      agentId: "alpha",
      cwd: "/x",
      sessionId: "s1",
      contextSections: [],
    });
  });

  it("prepends contextSections returned by a subscriber to the message", async () => {
    agentHooks.on("before_agent_reply", (ctx) => ({
      ...ctx,
      contextSections: ["Memory: previous conversation"],
    }));
    await claudeSdkAdapter.runAttempt(buildParams({ message: "Hello" }));
    const call = mockSpawnClaude.mock.calls[0][0];
    expect(call.message).toBe("Memory: previous conversation\n\nHello");
  });

  it("joins multiple subscribers' context sections with double newlines", async () => {
    agentHooks.on("before_agent_reply", (ctx) => ({
      ...ctx,
      contextSections: [...ctx.contextSections, "Section A"],
    }));
    agentHooks.on("before_agent_reply", (ctx) => ({
      ...ctx,
      contextSections: [...ctx.contextSections, "Section B"],
    }));
    await claudeSdkAdapter.runAttempt(buildParams({ message: "Q" }));
    const call = mockSpawnClaude.mock.calls[0][0];
    expect(call.message).toBe("Section A\n\nSection B\n\nQ");
  });

  it("leaves the message unchanged when no subscribers are registered", async () => {
    await claudeSdkAdapter.runAttempt(buildParams({ message: "Plain" }));
    const call = mockSpawnClaude.mock.calls[0][0];
    expect(call.message).toBe("Plain");
  });
});

describe("claudeSdkAdapter — agent_end hook", () => {
  it("emits with status=ok on a successful run", async () => {
    const seen: unknown[] = [];
    agentHooks.on("agent_end", (ctx) => {
      seen.push(ctx);
    });
    await claudeSdkAdapter.runAttempt(buildParams({ agentId: "beta" }));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      agentId: "beta",
      status: "ok",
    });
  });

  it("emits with status=error and the error message when the run fails", async () => {
    mockSpawnClaude.mockImplementationOnce(async ({ emit, onClose }) => {
      emit("error", { message: "kaboom" });
      onClose();
    });
    const seen: unknown[] = [];
    agentHooks.on("agent_end", (ctx) => {
      seen.push(ctx);
    });
    await claudeSdkAdapter.runAttempt(buildParams());
    expect(seen[0]).toMatchObject({
      status: "error",
      error: "kaboom",
    });
  });

  it("emits with status=aborted when the abort signal fires during the run", async () => {
    const ac = new AbortController();
    mockSpawnClaude.mockImplementationOnce(async ({ onClose }) => {
      ac.abort();
      onClose();
    });
    const seen: unknown[] = [];
    agentHooks.on("agent_end", (ctx) => {
      seen.push(ctx);
    });
    await claudeSdkAdapter.runAttempt(buildParams({ abortSignal: ac.signal }));
    expect(seen[0]).toMatchObject({
      status: "aborted",
    });
  });
});
