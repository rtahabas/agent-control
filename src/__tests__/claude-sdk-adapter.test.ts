import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentHarnessAttemptParams, AgentHarnessEmit } from "@/lib/agent-harness";

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
});

describe("claudeSdkAdapter", () => {
  describe("identity", () => {
    it("has stable id and label", () => {
      expect(claudeSdkAdapter.id).toBe("claude-sdk");
      expect(claudeSdkAdapter.label).toBe("Claude Agent SDK");
    });
  });

  describe("supports", () => {
    it("returns supported=true for anthropic provider", () => {
      const result = claudeSdkAdapter.supports({ provider: "anthropic" });
      expect(result.supported).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("returns supported=false with reason for unsupported provider", () => {
      const result = claudeSdkAdapter.supports({ provider: "openai" });
      expect(result.supported).toBe(false);
      expect(result.reason).toMatch(/openai/);
    });
  });

  describe("runAttempt", () => {
    it("returns status=ok and captures new session id when none provided", async () => {
      const result = await claudeSdkAdapter.runAttempt(buildParams());
      expect(result.status).toBe("ok");
      expect(result.sessionId).toBe("new-session-id");
      expect(result.error).toBeUndefined();
    });

    it("forwards events to caller emit", async () => {
      const events: Array<{ event: string; data: unknown }> = [];
      const params = buildParams({
        emit: (event, data) => events.push({ event, data }),
      });
      await claudeSdkAdapter.runAttempt(params);
      const sessionEvents = events.filter((e) => e.event === "session");
      expect(sessionEvents).toHaveLength(1);
    });

    it("preserves existing sessionId when caller passes one", async () => {
      mockSpawnClaude.mockImplementationOnce(async ({ onClose }) => {
        onClose();
      });
      const result = await claudeSdkAdapter.runAttempt(
        buildParams({ sessionId: "existing-session-abc" })
      );
      expect(result.sessionId).toBe("existing-session-abc");
      expect(result.status).toBe("ok");
    });

    it("returns status=aborted when abort signal fires during run", async () => {
      const ac = new AbortController();
      mockSpawnClaude.mockImplementationOnce(async ({ onClose }) => {
        ac.abort();
        onClose();
      });
      const result = await claudeSdkAdapter.runAttempt(
        buildParams({ abortSignal: ac.signal })
      );
      expect(result.status).toBe("aborted");
    });

    it("returns status=error when an error event is emitted", async () => {
      mockSpawnClaude.mockImplementationOnce(async ({ emit, onClose }) => {
        emit("error", { message: "spawn failed" });
        onClose();
      });
      const result = await claudeSdkAdapter.runAttempt(buildParams());
      expect(result.status).toBe("error");
      expect(result.error).toBe("spawn failed");
    });

    it("ignores non-string id in session payload (type guard)", async () => {
      mockSpawnClaude.mockImplementationOnce(async ({ emit, onClose }) => {
        emit("session", { id: 12345 as unknown as string });
        onClose();
      });
      const result = await claudeSdkAdapter.runAttempt(buildParams());
      expect(result.sessionId).toBeNull();
    });
  });
});
