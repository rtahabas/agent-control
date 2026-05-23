import { spawnClaude } from "@/lib/claude-stream";
import { agentHooks } from "@/lib/hooks";
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

function determineStatus(
  aborted: boolean,
  error: string | undefined,
): AgentHarnessAttemptResult["status"] {
  if (aborted) return "aborted";
  if (error) return "error";
  return "ok";
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
    const replyCtx = await agentHooks.emit("before_agent_reply", {
      agentId: params.agentId,
      cwd: params.cwd,
      sessionId: params.sessionId ?? null,
      userMessage: params.message,
      contextSections: [],
    });

    const augmentedMessage =
      replyCtx.contextSections.length > 0
        ? replyCtx.contextSections.join("\n\n") + "\n\n" + params.message
        : params.message;

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
      message: augmentedMessage,
      attachment: params.attachment ?? null,
      sessionId: params.sessionId,
      cwd: params.cwd,
      emit: emitWrap,
      onClose: params.onClose,
      abortSignal: params.abortSignal,
    });

    const status = determineStatus(params.abortSignal.aborted, capturedError);

    await agentHooks.emit("agent_end", {
      agentId: params.agentId,
      sessionId: capturedSessionId,
      status,
      ...(capturedError ? { error: capturedError } : {}),
    });

    if (status === "error") {
      return { sessionId: capturedSessionId, status, error: capturedError };
    }
    return { sessionId: capturedSessionId, status };
  },
};
