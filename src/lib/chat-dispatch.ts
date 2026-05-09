"use client";

import type { ChatMessage, QuestionItem } from "@/lib/chat-types";
import { rand } from "@/lib/chat-fmt";

type SetMessages = (updater: (arr: ChatMessage[]) => ChatMessage[]) => void;

export interface DispatchCtx {
  setMessages: SetMessages;
  currentAsstIdRef: { current: string | null };
}

export function applyDelta(text: string, ctx: DispatchCtx) {
  let id = ctx.currentAsstIdRef.current;
  if (!id) {
    id = rand();
    ctx.currentAsstIdRef.current = id;
    const msg: ChatMessage = { id, role: "assistant", text, streaming: true };
    ctx.setMessages((arr) => [...arr, msg]);
    return;
  }
  const target = id;
  ctx.setMessages((arr) => arr.map((x) => (x.id === target ? { ...x, text: x.text + text } : x)));
}

export function applyToolStart(
  payload: { index: number; name: string; id: string | null },
  ctx: DispatchCtx
) {
  const asstId = ctx.currentAsstIdRef.current;
  ctx.currentAsstIdRef.current = null;
  const msg: ChatMessage = {
    id: rand(),
    role: "tool",
    text: "",
    streaming: true,
    tool: { index: payload.index, name: payload.name, id: payload.id },
  };
  ctx.setMessages((arr) => insertAfterAsst(arr, asstId, msg));
}

export function applyToolEnd(
  payload: { index: number; input: Record<string, unknown> | null },
  ctx: DispatchCtx
) {
  ctx.setMessages((arr) =>
    arr.map((x) =>
      x.role === "tool" && x.tool?.index === payload.index && !x.tool.done
        ? { ...x, streaming: false, tool: { ...x.tool, input: payload.input, done: true } }
        : x
    )
  );
}

export function applyPermissionRequest(
  payload: Record<string, unknown>,
  ctx: DispatchCtx
) {
  const asstId = ctx.currentAsstIdRef.current;
  ctx.currentAsstIdRef.current = null;
  const msg: ChatMessage = {
    id: rand(),
    role: "permission",
    text: "",
    streaming: false,
    permission: {
      tool_use_id: payload.tool_use_id as string,
      tool_name: payload.tool_name as string,
      input: (payload.input as Record<string, unknown>) ?? {},
      title: (payload.title as string | null) ?? null,
      display_name: (payload.display_name as string | null) ?? null,
      description: (payload.description as string | null) ?? null,
      status: "pending",
    },
  };
  ctx.setMessages((arr) => insertAfterAsst(arr, asstId, msg));
}

function insertAfterAsst(arr: ChatMessage[], asstId: string | null, msg: ChatMessage): ChatMessage[] {
  if (!asstId) return [...arr, msg];
  const cur = arr.find((x) => x.id === asstId);
  if (cur && cur.text === "") return [...arr.filter((x) => x.id !== asstId), msg];
  return [...arr.map((x) => (x.id === asstId ? { ...x, streaming: false } : x)), msg];
}

export function applyAskUserQuestion(payload: Record<string, unknown>, ctx: DispatchCtx) {
  const asstId = ctx.currentAsstIdRef.current;
  ctx.currentAsstIdRef.current = null;
  const input = (payload.input as Record<string, unknown>) ?? {};
  const questions = (input.questions as QuestionItem[]) ?? [];
  const msg: ChatMessage = {
    id: rand(),
    role: "question",
    text: "",
    streaming: false,
    question: {
      tool_use_id: payload.tool_use_id as string,
      questions,
      status: "pending",
    },
  };
  ctx.setMessages((arr) => insertAfterAsst(arr, asstId, msg));
}
