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

export function useChatSession(agent: Agent | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnInfo | null>(null);
  const [stats, setStats] = useState<CumulativeStats>(EMPTY_STATS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const dispatchEvent = useCallback((block: string, asstId: string) => {
    const parsed = parseSseBlock(block);
    if (!parsed || !parsed.payload) return;
    const { event, payload } = parsed;
    if (event === "session" && typeof payload.id === "string") {
      setSessionId(payload.id);
    } else if (event === "delta" && typeof payload.text === "string") {
      const text = payload.text;
      setMessages((arr) => arr.map((x) => (x.id === asstId ? { ...x, text: x.text + text } : x)));
    } else if (event === "done") {
      const t = turnFromPayload(payload);
      setLastTurn(t);
      setStats((s) => accumulate(s, t));
    } else if (event === "error" && typeof payload.message === "string") {
      setError(payload.message);
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!agent || !text.trim() || busy) return;
      setError(null);
      const userMsg: ChatMessage = { id: rand(), role: "user", text: text.trim() };
      const asstMsg: ChatMessage = { id: rand(), role: "assistant", text: "", streaming: true };
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
        if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let sep;
          while ((sep = buf.indexOf("\n\n")) !== -1) {
            dispatchEvent(buf.slice(0, sep), asstMsg.id);
            buf = buf.slice(sep + 2);
          }
        }
      } catch (e: unknown) {
        if (!(e instanceof Error && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setBusy(false);
        setMessages((arr) =>
          arr.map((x) => (x.id === asstMsg.id ? { ...x, streaming: false, done: true } : x))
        );
        abortRef.current = null;
      }
    },
    [agent, sessionId, busy, dispatchEvent]
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setLastTurn(null);
    setStats(EMPTY_STATS);
    setError(null);
    if (agent) clearSnapshot(agent.id);
  }, [agent]);

  return { messages, sessionId, lastTurn, stats, busy, error, send, cancel, clear };
}
