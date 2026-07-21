"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Agent } from "@/lib/api";
import {
  EMPTY_STATS,
  type Attachment,
  type ChatMessage,
  type CumulativeStats,
  type TurnInfo,
} from "@/lib/chat-types";
import { rand } from "@/lib/chat-fmt";
import { parseSseBlock } from "@/lib/sse-parse";
import {
  parseSlash,
  helpText,
  fetchCustomCommandNames,
  fetchCustomCommand,
  fetchAgentModel,
  setAgentModel,
} from "@/lib/slash-commands";
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
import { keyToPermDecision, keyToOptionIndex, isComposing } from "@/lib/perm-keys";

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
      setBusy(false);
      setMessages((arr) => arr.map((x) => (x.streaming ? { ...x, streaming: false, done: true } : x)));
    } else if (event === "error" && typeof payload.message === "string") setError(payload.message);
  }, []);

  const send = useCallback(
    async (text: string, attachment: Attachment | null = null) => {
      const trimmed = text.trim();
      if (!agent || busy) return;
      if (!trimmed && !attachment) return;
      setError(null);

      // Slash commands: this chat runs on the Agent SDK, not the CLI REPL, so slash
      // commands never reach a REPL. Handle dashboard-native ones here; expand a custom
      // project command (.claude/commands/<name>.md) into a normal prompt.
      let messageToSend = trimmed;
      if (trimmed.startsWith("/") && !attachment) {
        const parsed = parseSlash(trimmed);
        if (parsed?.name === "clear") {
          setMessages([]);
          clearSnapshot(agent.id);
          return;
        }
        if (!parsed || parsed.name === "help") {
          const names = await fetchCustomCommandNames(agent.id);
          const echo: ChatMessage = { id: rand(), role: "user", text: trimmed };
          const out: ChatMessage = {
            id: rand(),
            role: "assistant",
            text: helpText(names),
            done: true,
          };
          setMessages((m) => [...m, echo, out]);
          return;
        }
        if (parsed.name === "model") {
          const echo: ChatMessage = { id: rand(), role: "user", text: trimmed };
          let out: ChatMessage;
          if (!parsed.args) {
            const cur = await fetchAgentModel(agent.id);
            out = {
              id: rand(),
              role: "assistant",
              done: true,
              text:
                `Current model: ${cur ?? "(default)"}\n` +
                `Set with: /model <name>  (e.g. opus[1m], sonnet, haiku, claude-opus-4-8[1m])\n` +
                `Takes effect on the next message/session.`,
            };
          } else {
            const r = await setAgentModel(agent.id, parsed.args);
            out = {
              id: rand(),
              role: "assistant",
              done: true,
              text: r.ok
                ? `Model set to "${parsed.args}". Takes effect on the next message/session.`
                : `Failed to set model: ${r.error}`,
            };
          }
          setMessages((m) => [...m, echo, out]);
          return;
        }
        const cmdBody = await fetchCustomCommand(agent.id, parsed.name);
        if (cmdBody == null) {
          const echo: ChatMessage = { id: rand(), role: "user", text: trimmed };
          const out: ChatMessage = {
            id: rand(),
            role: "assistant",
            text: `Unknown command: /${parsed.name}. Type /help for the list.`,
            done: true,
          };
          setMessages((m) => [...m, echo, out]);
          return;
        }
        messageToSend = parsed.args ? `${cmdBody}\n\n${parsed.args}` : cmdBody;
      }

      const userMsg: ChatMessage = {
        id: rand(),
        role: "user",
        text: trimmed,
        ...(attachment ? { attachment } : {}),
      };
      const asstId = rand();
      const asstMsg: ChatMessage = { id: asstId, role: "assistant", text: "", streaming: true };
      currentAsstIdRef.current = asstId;
      setMessages((m) => [...m, userMsg, asstMsg]);
      setBusy(true);
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const body: Record<string, unknown> = {
          agent_id: agent.id,
          message: messageToSend,
          session_id: sessionId,
        };
        if (attachment) body.attachment = attachment;
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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

  // Track the pending permission card and the pending single-question card in refs,
  // so the keydown listener stays stable instead of re-binding on every message.
  // The question shortcut is only offered when there is exactly ONE question — with
  // multiple questions a bare digit is ambiguous (which question?), so we fall back
  // to clicking there.
  const pendingPermRef = useRef<string | null>(null);
  const pendingQuestionRef = useRef<{
    toolUseId: string;
    question: string;
    options: string[];
  } | null>(null);
  useEffect(() => {
    const perm = messages.find(
      (m) => m.role === "permission" && m.permission?.status === "pending"
    );
    pendingPermRef.current = perm?.permission?.tool_use_id ?? null;

    const q = messages.find(
      (m) => m.role === "question" && m.question?.status === "pending"
    )?.question;
    pendingQuestionRef.current =
      q && q.questions.length === 1
        ? {
            toolUseId: q.tool_use_id,
            question: q.questions[0].question,
            options: q.questions[0].options.map((o) => o.label),
          }
        : null;
  }, [messages]);

  // Keyboard shortcuts mirroring the CLI's numbered prompt so a card can be answered
  // without the mouse. Permission card: 1 = Allow, 2 = Reject, 3 = Allow always.
  // Single-question card: 1..N picks that option and submits. Permission takes
  // priority if both are somehow pending. Yields while the user is composing a message.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isComposing(document.activeElement)) return;

      const permId = pendingPermRef.current;
      if (permId) {
        const mapped = keyToPermDecision(e.key);
        if (!mapped) return;
        e.preventDefault();
        decide(permId, mapped.decision, mapped.always);
        return;
      }

      const q = pendingQuestionRef.current;
      if (q) {
        const idx = keyToOptionIndex(e.key, q.options.length);
        if (idx === null) return;
        e.preventDefault();
        answer(q.toolUseId, { [q.question]: q.options[idx] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, answer]);

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
