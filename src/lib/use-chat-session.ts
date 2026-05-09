"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Agent } from "@/lib/api";
import {
  EMPTY_STATS,
  type ChatMessage,
  type CumulativeStats,
  type TurnInfo,
} from "@/lib/chat-types";
import { rand } from "@/lib/chat-fmt";
import { parseSseBlock } from "@/lib/sse-parse";
import {
  accumulate,
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
  turnFromPayload,
} from "@/lib/chat-helpers";
import {
  applyAskUserQuestion,
  applyDelta,
  applyPermissionRequest,
  applyToolEnd,
  applyToolStart,
  type DispatchCtx,
} from "@/lib/chat-dispatch";
import { streamSse } from "@/lib/chat-stream-reader";
import { postAnswer, postDecide } from "@/lib/chat-actions";

export function useChatSession(agent: Agent | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnInfo | null>(null);
  const [stats, setStats] = useState<CumulativeStats>(EMPTY_STATS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const statsRef = useRef<CumulativeStats>(EMPTY_STATS);
  const currentAsstIdRef = useRef<string | null>(null);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  useEffect(() => {
    if (!agent) return;
    const snap = loadSnapshot(agent.id);
    setMessages(snap?.messages || []);
    setSessionId(snap?.sessionId ?? null);
    setLastTurn(snap?.lastTurn ?? null);
    setStats(snap?.stats || EMPTY_STATS);
    setError(null);
  }, [agent?.id]);

  useEffect(() => {
    if (!agent) return;
    saveSnapshot(agent.id, { messages, sessionId, lastTurn, stats });
  }, [agent?.id, messages, sessionId, lastTurn, stats]);

  const dispatchEvent = useCallback((block: string) => {
    const parsed = parseSseBlock(block);
    if (!parsed || !parsed.payload) return;
    const ctx: DispatchCtx = { setMessages, currentAsstIdRef };
    const { event, payload } = parsed;
    if (event === "session" && typeof payload.id === "string") setSessionId(payload.id);
    else if (event === "delta" && typeof payload.text === "string") applyDelta(payload.text, ctx);
    else if (event === "tool_start") applyToolStart({ index: payload.index as number, name: (payload.name as string) || "tool", id: (payload.id as string | null) ?? null }, ctx);
    else if (event === "tool_end") applyToolEnd({ index: payload.index as number, input: (payload.input as Record<string, unknown> | null) ?? null }, ctx);
    else if (event === "permission_request") applyPermissionRequest(payload, ctx);
    else if (event === "ask_user_question") applyAskUserQuestion(payload, ctx);
    else if (event === "done") {
      const t = turnFromPayload(payload);
      setLastTurn(t);
      setStats((s) => accumulate(s, t));
    } else if (event === "error" && typeof payload.message === "string") setError(payload.message);
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!agent || !text.trim() || busy) return;
      setError(null);
      const userMsg: ChatMessage = { id: rand(), role: "user", text: text.trim() };
      const asstId = rand();
      const asstMsg: ChatMessage = { id: asstId, role: "assistant", text: "", streaming: true };
      currentAsstIdRef.current = asstId;
      setMessages((m) => [...m, userMsg, asstMsg]);
      setBusy(true);
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: agent.id, message: text.trim(), session_id: sessionId }),
          signal: ac.signal,
        });
        await streamSse(res, dispatchEvent);
      } catch (e: unknown) {
        if (!(e instanceof Error && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setBusy(false);
        currentAsstIdRef.current = null;
        setMessages((arr) => arr.map((x) => (x.streaming ? { ...x, streaming: false, done: true } : x)));
        abortRef.current = null;
      }
    },
    [agent, sessionId, busy, dispatchEvent]
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const decide = useCallback(
    (toolUseId: string, decision: "allow" | "deny", always?: boolean) =>
      postDecide(toolUseId, decision, always, setMessages, setError),
    []
  );

  const answer = useCallback(
    (toolUseId: string, answers: Record<string, string>) =>
      postAnswer(toolUseId, answers, setMessages, setError),
    []
  );

  const clear = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setLastTurn(null);
    setStats(EMPTY_STATS);
    setError(null);
    if (agent) clearSnapshot(agent.id);
  }, [agent]);

  return { messages, sessionId, lastTurn, stats, busy, error, send, cancel, clear, decide, answer };
}
