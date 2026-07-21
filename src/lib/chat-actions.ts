"use client";

import type { ChatMessage } from "@/lib/chat-types";

type SetMessages = (updater: (arr: ChatMessage[]) => ChatMessage[]) => void;
type SetError = (e: string | null) => void;

/**
 * The server no longer has this request — restarted, aborted, or already
 * resolved. The permission route reports that as 410 and the answer route as
 * 404; either way the card is dead and the optimistic status we just painted
 * is a lie.
 */
function isGone(status: number): boolean {
  return status === 404 || status === 410;
}

function expirePermission(toolUseId: string, setMessages: SetMessages) {
  setMessages((arr) =>
    arr.map((x) =>
      x.role === "permission" && x.permission?.tool_use_id === toolUseId
        ? { ...x, permission: { ...x.permission, status: "expired" as const } }
        : x
    )
  );
}

function expireQuestion(toolUseId: string, setMessages: SetMessages) {
  setMessages((arr) =>
    arr.map((x) =>
      x.role === "question" && x.question?.tool_use_id === toolUseId
        ? { ...x, question: { ...x.question, status: "expired" as const } }
        : x
    )
  );
}

export async function postDecide(
  toolUseId: string,
  decision: "allow" | "deny",
  always: boolean | undefined,
  setMessages: SetMessages,
  setError: SetError
) {
  setMessages((arr) =>
    arr.map((x) =>
      x.role === "permission" && x.permission?.tool_use_id === toolUseId
        ? {
            ...x,
            permission: {
              ...x.permission,
              status: decision === "allow" ? "allowed" : "denied",
              always: !!always,
            },
          }
        : x
    )
  );
  try {
    const res = await fetch("/api/chat/permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_use_id: toolUseId, decision, always: !!always }),
    });
    if (isGone(res.status)) expirePermission(toolUseId, setMessages);
    else if (!res.ok) setError(`Could not record that decision (HTTP ${res.status}).`);
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }
}

export async function postAnswer(
  toolUseId: string,
  answers: Record<string, string>,
  setMessages: SetMessages,
  setError: SetError
) {
  setMessages((arr) =>
    arr.map((x) =>
      x.role === "question" && x.question?.tool_use_id === toolUseId
        ? { ...x, question: { ...x.question, status: "answered", answers } }
        : x
    )
  );
  try {
    const res = await fetch("/api/chat/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_use_id: toolUseId, answers }),
    });
    // This half was missing: the card read "Answered" whatever came back, so an
    // answer nobody received looked exactly like one that landed.
    if (isGone(res.status)) expireQuestion(toolUseId, setMessages);
    else if (!res.ok) setError(`Could not submit that answer (HTTP ${res.status}).`);
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }
}
