import { spawnClaude } from "@/lib/claude-stream";
import type {
  AgentHarness,
  AgentHarnessAttemptParams,
  AgentHarnessAttemptResult,
  AgentHarnessEmit,
  AgentHarnessSupport,
  AgentHarnessSupportContext,
} from "@/lib/agent-harness";

const SUPPORTED_PROVIDERS = new Set(["anthropic"]);

function isSessionPayload(d: unknown): d is { id: string } {
  return (
    typeof d === "object" &&
    d !== null &&
    "id" in d &&
    typeof (d as Record<string, unknown>).id === "string"
  );
}

function isErrorPayload(d: unknown): d is { message: string } {
  return (
    typeof d === "object" &&
    d !== null &&
    "message" in d &&
    typeof (d as Record<string, unknown>).message === "string"
  );
}

export const claudeSdkAdapter: AgentHarness = {
  id: "claude-sdk",
  label: "Claude Agent SDK",

  supports(ctx: AgentHarnessSupportContext): AgentHarnessSupport {
    if (!SUPPORTED_PROVIDERS.has(ctx.provider)) {
      return { supported: false, reason: `provider '${ctx.provider}' not supported` };
    }
    return { supported: true };
  },

  async runAttempt(params: AgentHarnessAttemptParams): Promise<AgentHarnessAttemptResult> {
    let capturedSessionId: string | null = params.sessionId ?? null;
    let capturedError: string | undefined;

    const emitWrap: AgentHarnessEmit = (event, data) => {
      if (event === "session" && isSessionPayload(data)) {
        capturedSessionId = data.id;
      } else if (event === "error" && isErrorPayload(data)) {
        capturedError = data.message;
      }
      params.emit(event, data);
    };

    await spawnClaude({
      message: params.message,
      sessionId: params.sessionId,
      cwd: params.cwd,
      emit: emitWrap,
      onClose: params.onClose,
      abortSignal: params.abortSignal,
    });

    if (params.abortSignal.aborted) {
      return { sessionId: capturedSessionId, status: "aborted" };
    }
    if (capturedError) {
      return { sessionId: capturedSessionId, status: "error", error: capturedError };
    }
    return { sessionId: capturedSessionId, status: "ok" };
  },
};
