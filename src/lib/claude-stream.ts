import { query } from "@anthropic-ai/claude-agent-sdk";
import { makeCanUseTool, type EmitFn } from "@/lib/chat-permissions";
import type { Attachment } from "@/lib/chat-types";
import { randomUUID } from "node:crypto";

export { decidePermission } from "@/lib/chat-permissions";
export type { EmitFn };

interface ToolBuf { name: string; id: string | null; input: string }

// Build a one-shot AsyncIterable<SDKUserMessage> that delivers a single user
// message with multimodal content blocks (text + image). Used when the caller
// passes an attachment; the plain string prompt path is preserved for
// text-only chats so multimodal-disabled code paths don't change shape.
async function* multimodalPrompt(
  message: string,
  attachment: Attachment,
): AsyncIterable<{
  type: "user";
  message: { role: "user"; content: Array<Record<string, unknown>> };
  parent_tool_use_id: null;
  session_id: string;
}> {
  const content: Array<Record<string, unknown>> = [];
  if (message) content.push({ type: "text", text: message });
  content.push({
    type: "image",
    source: {
      type: "base64",
      media_type: attachment.mime,
      data: attachment.dataBase64,
    },
  });
  yield {
    type: "user",
    message: { role: "user", content },
    parent_tool_use_id: null,
    session_id: randomUUID(),
  };
}

export async function spawnClaude({
  message,
  attachment,
  sessionId,
  cwd,
  emit,
  onClose,
  abortSignal,
}: {
  message: string;
  attachment?: Attachment | null;
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

  // Multimodal: stream a single SDKUserMessage with content blocks.
  // Text-only: keep the cheaper string prompt path.
  const prompt = attachment
    ? (multimodalPrompt(message, attachment) as Parameters<typeof query>[0]["prompt"])
    : message;

  const iter = query({
    prompt,
    options: {
      cwd,
      abortController: ac,
      includePartialMessages: true,
      // Hard cap on agentic turns so a runaway / autonomous (heartbeat/loop-style)
      // agent can't exhaust memory on a small box. Tune via CHAT_MAX_TURNS.
      maxTurns: Number(process.env.CHAT_MAX_TURNS) || 20,
      ...(sessionId && /^[a-f0-9-]{8,}$/.test(sessionId) ? { resume: sessionId } : {}),
      // Default: surface every tool call as an Allow/Reject permission card in the
      // UI (answerable by mouse or the 1/2/3 keyboard shortcut). Set
      // CHAT_BYPASS_PERMISSION=1 for an unattended/demo run that streams without prompts.
      ...(process.env.CHAT_BYPASS_PERMISSION === "1"
        ? { permissionMode: "bypassPermissions" as const }
        : { canUseTool: makeCanUseTool(emit, () => activeSessionId) }),
    },
  });

  try {
    for await (const msg of iter) {
      if (msg.type === "system" && msg.subtype === "init") {
        activeSessionId = msg.session_id;
        emit("session", { id: msg.session_id });
      } else if (msg.type === "stream_event") {
        handleStreamEvent(msg.event as unknown as Record<string, unknown>, emit, toolBufs);
      } else if (msg.type === "result") {
        emitDone(msg as unknown as Record<string, unknown>, emit);
        break;
      }
    }
  } catch (e: unknown) {
    if (!ac.signal.aborted) {
      emit("error", { message: e instanceof Error ? e.message : String(e) });
    }
  } finally {
    await iter?.return?.();
    onClose();
  }
}

function emitDone(msg: Record<string, unknown>, emit: EmitFn) {
  emit("done", doneEventPayload(msg));
}

/**
 * Flattens an SDK result message into the `done` event.
 *
 * Both result shapes carry usage/cost/stop_reason — only the error ones lack
 * `result` text (SDKResultSuccess | SDKResultError). Reading them regardless of
 * subtype keeps a capped or failed turn from reporting zero spend, and forwards
 * the subtype so the UI can say why a run stopped instead of just going quiet
 * (e.g. error_max_turns from the CHAT_MAX_TURNS cap).
 */
export function doneEventPayload(msg: Record<string, unknown>) {
  const usage = msg.usage as Record<string, number> | undefined;
  const modelUsage = msg.modelUsage as Record<string, { contextWindow?: number }> | null;
  const modelKey = modelUsage ? Object.keys(modelUsage)[0] : null;
  return {
    subtype: typeof msg.subtype === "string" ? msg.subtype : null,
    errors: Array.isArray(msg.errors) ? (msg.errors as string[]) : null,
    reason: (msg.stop_reason as string | null) ?? null,
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
  };
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
