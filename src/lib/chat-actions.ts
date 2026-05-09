"use client";

import type { ChatMessage } from "@/lib/chat-types";

type SetMessages = (updater: (arr: ChatMessage[]) => ChatMessage[]) => void;
type SetError = (e: string | null) => void;

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
    await fetch("/api/chat/permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_use_id: toolUseId, decision, always: !!always }),
    });
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
    await fetch("/api/chat/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_use_id: toolUseId, answers }),
    });
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }
}
