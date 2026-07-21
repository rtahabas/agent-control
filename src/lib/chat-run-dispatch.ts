"use client";

import type { ChatMessage } from "@/lib/chat-types";
import { parseSseBlock } from "@/lib/sse-parse";
import { accumulate, turnFromPayload } from "@/lib/chat-helpers";
import { asstRef, updateRun } from "@/lib/chat-store";
import {
  applyAskUserQuestion,
  applyDelta,
  applyPermissionRequest,
  applyToolEnd,
  applyToolStart,
  type DispatchCtx,
} from "@/lib/chat-dispatch";
import { runEndedMessage } from "@/lib/run-outcome";
import { runNotification, showNotice } from "@/lib/run-notify";

/** Writes messages for one agent, wherever that agent's transcript currently lives. */
export function messageWriter(agentId: string) {
  return (updater: (arr: ChatMessage[]) => ChatMessage[]) =>
    updateRun(agentId, (s) => ({ ...s, messages: updater(s.messages) }));
}

export function errorWriter(agentId: string) {
  return (e: string | null) => updateRun(agentId, (s) => ({ ...s, error: e }));
}

/**
 * Translates one SSE event into state for the agent that started the run —
 * bound to that agent, not to whoever is selected when the event arrives.
 */
export function makeDispatch(agentId: string, agentName: string | null) {
  const setMessages = messageWriter(agentId);
  const setError = errorWriter(agentId);
  const ctx: DispatchCtx = { setMessages, currentAsstIdRef: asstRef(agentId) };

  return (block: string) => {
    const parsed = parseSseBlock(block);
    if (!parsed || !parsed.payload) return;
    const { event, payload } = parsed;
    if (event === "session" && typeof payload.id === "string") {
      const id = payload.id;
      updateRun(agentId, (s) => ({ ...s, sessionId: id }));
    } else if (event === "delta" && typeof payload.text === "string") {
      applyDelta(payload.text, ctx);
    } else if (event === "tool_start") {
      applyToolStart(
        {
          index: payload.index as number,
          name: (payload.name as string) || "tool",
          id: (payload.id as string | null) ?? null,
        },
        ctx
      );
    } else if (event === "tool_end") {
      applyToolEnd(
        {
          index: payload.index as number,
          input: (payload.input as Record<string, unknown> | null) ?? null,
        },
        ctx
      );
    } else if (event === "permission_request") {
      applyPermissionRequest(payload, ctx);
    } else if (event === "ask_user_question") {
      applyAskUserQuestion(payload, ctx);
    } else if (event === "done") {
      const t = turnFromPayload(payload);
      // A run can end without an error event — hitting the turn or cost cap just
      // stops. Say so, otherwise the agent looks like it quit for no reason.
      const ended = runEndedMessage(
        payload.subtype as string | null,
        payload.num_turns as number | null,
        payload.errors as string[] | null
      );
      updateRun(agentId, (s) => ({
        ...s,
        lastTurn: t,
        stats: accumulate(s.stats, t),
        busy: false,
        messages: s.messages.map((x) =>
          x.streaming ? { ...x, streaming: false, done: true } : x
        ),
        ...(ended ? { error: ended } : {}),
      }));
      // Tell the user a long run is over when they are not looking at the tab.
      // Hooked to `done` rather than a busy transition on purpose: a run the user
      // cancelled never emits `done`, and they already know they cancelled it.
      if (document.hidden) {
        showNotice(
          runNotification(
            {
              subtype: payload.subtype as string | null,
              numTurns: (payload.num_turns as number | null) ?? t.num_turns,
              errors: payload.errors as string[] | null,
              costUsd: t.cost_usd,
              durationMs: t.duration_ms,
            },
            agentName
          )
        );
      }
    } else if (event === "error" && typeof payload.message === "string") {
      setError(payload.message);
    }
  };
}

