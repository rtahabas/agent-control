import { query } from "@anthropic-ai/claude-agent-sdk";
import { makeCanUseTool, type EmitFn } from "@/lib/chat-permissions";

export { decidePermission } from "@/lib/chat-permissions";
export type { EmitFn };

interface ToolBuf { name: string; id: string | null; input: string }

export async function spawnClaude({
  message,
  sessionId,
  cwd,
  emit,
  onClose,
  abortSignal,
}: {
  message: string;
  sessionId: string | null | undefined;
  cwd: string;
  emit: EmitFn;
  onClose: () => void;
  abortSignal: AbortSignal;
}) {
  const ac = new AbortController();
  abortSignal.addEventListener("abort", () => ac.abort());

  let activeSessionId: string | null = sessionId ?? null;
  const toolBufs: Record<number, ToolBuf> = {};

  try {
    const iter = query({
      prompt: message,
      options: {
        cwd,
        abortController: ac,
        includePartialMessages: true,
        // AskUserQuestion has no UI surface in this chat — agent must ask in plain text
        // and the user replies in the next turn. Disabling it avoids double-prompts.
        disallowedTools: ["AskUserQuestion"],
        ...(sessionId && /^[a-f0-9-]{8,}$/.test(sessionId) ? { resume: sessionId } : {}),
        canUseTool: makeCanUseTool(emit, () => activeSessionId),
      },
    });

    for await (const msg of iter) {
      if (msg.type === "system" && msg.subtype === "init") {
        activeSessionId = msg.session_id;
        emit("session", { id: msg.session_id });
      } else if (msg.type === "stream_event") {
        handleStreamEvent(msg.event as unknown as Record<string, unknown>, emit, toolBufs);
      } else if (msg.type === "result") {
        emitDone(msg as unknown as Record<string, unknown>, emit);
      }
    }
  } catch (e: unknown) {
    if (!ac.signal.aborted) {
      emit("error", { message: e instanceof Error ? e.message : String(e) });
    }
  } finally {
    onClose();
  }
}

function emitDone(msg: Record<string, unknown>, emit: EmitFn) {
  const usage = msg.subtype === "success" ? (msg.usage as Record<string, number>) : null;
  const modelUsage = msg.subtype === "success"
    ? (msg.modelUsage as Record<string, { contextWindow?: number }> | null)
    : null;
  const modelKey = modelUsage ? Object.keys(modelUsage)[0] : null;
  emit("done", {
    reason: msg.subtype === "success" ? msg.stop_reason : null,
    duration_ms: msg.duration_ms,
    duration_api_ms: msg.duration_api_ms,
    num_turns: msg.num_turns,
    cost_usd: msg.total_cost_usd,
    model: modelKey,
    usage: usage
      ? {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          cache_read_input_tokens: usage.cache_read_input_tokens,
          cache_creation_input_tokens: usage.cache_creation_input_tokens,
        }
      : null,
    context_window: modelKey && modelUsage ? modelUsage[modelKey].contextWindow ?? null : null,
  });
}

function handleStreamEvent(
  inner: Record<string, unknown> | undefined,
  emit: EmitFn,
  toolBufs: Record<number, ToolBuf>
) {
  if (!inner) return;
  const innerType = inner.type as string | undefined;
  const idx = inner.index as number | undefined;
  if (innerType === "content_block_start") {
    const block = inner.content_block as Record<string, unknown> | undefined;
    if (block?.type === "tool_use" && typeof idx === "number") {
      const name = (block.name as string) || "tool";
      const id = (block.id as string) || null;
      toolBufs[idx] = { name, id, input: "" };
      emit("tool_start", { index: idx, name, id });
    }
    return;
  }
  if (innerType === "content_block_delta") {
    const delta = inner.delta as Record<string, unknown> | undefined;
    if (delta?.type === "text_delta" && typeof delta.text === "string") {
      emit("delta", { text: delta.text });
    } else if (
      delta?.type === "input_json_delta" &&
      typeof delta.partial_json === "string" &&
      typeof idx === "number" &&
      toolBufs[idx]
    ) {
      toolBufs[idx].input += delta.partial_json;
    }
    return;
  }
  if (innerType === "content_block_stop" && typeof idx === "number") {
    const tb = toolBufs[idx];
    if (!tb) return;
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(tb.input) as Record<string, unknown>; } catch { /* ignore */ }
    emit("tool_end", { index: idx, name: tb.name, id: tb.id, input: parsed });
    delete toolBufs[idx];
  }
}
