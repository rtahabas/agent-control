"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { Agent } from "@/lib/api";
import { type Attachment, type ChatMessage } from "@/lib/chat-types";
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
import { accumulate, clearSnapshot, turnFromPayload } from "@/lib/chat-helpers";
import {
  EMPTY_RUN,
  abortRun,
  asstRef,
  getRun,
  hydrateRun,
  resetRun,
  setAbort,
  subscribeRun,
  updateRun,
} from "@/lib/chat-store";
import {
  applyAskUserQuestion,
  applyDelta,
  applyPermissionRequest,
  applyToolEnd,
  applyToolStart,
  settleOpenCards,
  type DispatchCtx,
} from "@/lib/chat-dispatch";
import { streamSse } from "@/lib/chat-stream-reader";
import { postAnswer, postDecide } from "@/lib/chat-actions";
import { keyToPermDecision, keyToOptionIndex, shortcutAllowed } from "@/lib/perm-keys";
import { attentionTitle, BASE_TITLE } from "@/lib/attention";
import { runEndedMessage } from "@/lib/run-outcome";
import { runNotification, showNotice } from "@/lib/run-notify";

/** Writes messages for one agent, wherever that agent's transcript currently lives. */
function messageWriter(agentId: string) {
  return (updater: (arr: ChatMessage[]) => ChatMessage[]) =>
    updateRun(agentId, (s) => ({ ...s, messages: updater(s.messages) }));
}

function errorWriter(agentId: string) {
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

/**
 * @param visible whether the chat surface is the tab on screen. The panel stays
 * mounted behind other tabs so a run keeps streaming, which means keyboard
 * shortcuts have to be told what is actually being looked at.
 */
export function useChatSession(agent: Agent | null, visible = true) {
  const agentId = agent?.id ?? null;

  // State lives per agent rather than in this component, so selecting another
  // agent shows that agent's transcript while the first one keeps streaming.
  const run = useSyncExternalStore(
    useCallback(
      (cb: () => void) => (agentId ? subscribeRun(agentId, cb) : () => {}),
      [agentId]
    ),
    useCallback(() => (agentId ? getRun(agentId) : EMPTY_RUN), [agentId]),
    () => EMPTY_RUN
  );
  const { messages, sessionId, lastTurn, stats, busy, error } = run;

  useEffect(() => {
    if (agentId) hydrateRun(agentId);
  }, [agentId]);

  const send = useCallback(
    async (text: string, attachment: Attachment | null = null) => {
      const trimmed = text.trim();
      if (!agent) return;
      const id = agent.id;
      // Read straight from the store: the captured render's `busy` can be stale
      // if the user was on another agent when this run started.
      if (getRun(id).busy) return;
      if (!trimmed && !attachment) return;

      const setMessages = messageWriter(id);
      const setError = errorWriter(id);
      setError(null);

      // Slash commands: this chat runs on the Agent SDK, not the CLI REPL, so slash
      // commands never reach a REPL. Handle dashboard-native ones here; expand a custom
      // project command (.claude/commands/<name>.md) into a normal prompt.
      let messageToSend = trimmed;
      if (trimmed.startsWith("/") && !attachment) {
        const parsed = parseSlash(trimmed);
        if (parsed?.name === "clear") {
          resetRun(id);
          clearSnapshot(id);
          return;
        }
        if (!parsed || parsed.name === "help") {
          const names = await fetchCustomCommandNames(id);
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
            const cur = await fetchAgentModel(id);
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
            const r = await setAgentModel(id, parsed.args);
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
        const cmdBody = await fetchCustomCommand(id, parsed.name);
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
      asstRef(id).current = asstId;
      updateRun(id, (s) => ({ ...s, messages: [...s.messages, userMsg, asstMsg], busy: true }));

      const dispatch = makeDispatch(id, agent.name ?? null);
      const ac = new AbortController();
      setAbort(id, ac);
      try {
        const body: Record<string, unknown> = {
          agent_id: id,
          message: messageToSend,
          session_id: getRun(id).sessionId,
        };
        if (attachment) body.attachment = attachment;
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ac.signal,
        });
        await streamSse(res, dispatch);
      } catch (e: unknown) {
        if (!(e instanceof Error && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        asstRef(id).current = null;
        setAbort(id, null);
        updateRun(id, (s) => ({
          ...s,
          busy: false,
          messages: settleOpenCards(
            s.messages.map((x) => (x.streaming ? { ...x, streaming: false, done: true } : x))
          ),
        }));
      }
    },
    [agent]
  );

  const cancel = useCallback(() => {
    if (agentId) abortRun(agentId);
  }, [agentId]);

  const decide = useCallback(
    (toolUseId: string, decision: "allow" | "deny", always?: boolean) => {
      if (!agentId) return;
      return postDecide(
        toolUseId,
        decision,
        always,
        messageWriter(agentId),
        errorWriter(agentId)
      );
    },
    [agentId]
  );

  const answer = useCallback(
    (toolUseId: string, answers: Record<string, string>) => {
      if (!agentId) return;
      return postAnswer(toolUseId, answers, messageWriter(agentId), errorWriter(agentId));
    },
    [agentId]
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
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

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
  // priority if both are somehow pending.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !shortcutAllowed({
          chatVisible: visibleRef.current,
          documentHidden: document.hidden,
          target: document.activeElement,
          modifiers: { meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey },
        })
      ) {
        return;
      }

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

  // Attention signal. A pending card blocks the agent until it is answered, so
  // surface that in the browser tab — otherwise it goes unnoticed while you are
  // in another tab (or driving a second agent).
  const needsYou = messages.some(
    (m) =>
      (m.role === "permission" && m.permission?.status === "pending") ||
      (m.role === "question" && m.question?.status === "pending")
  );
  useEffect(() => {
    document.title = attentionTitle({ needsYou, busy }, agent?.name ?? null);
  }, [needsYou, busy, agent?.name]);
  // Restore the plain title once, on unmount — not on every state change.
  useEffect(() => () => void (document.title = BASE_TITLE), []);

  // Desktop notification when a card appears while the tab is hidden. Fires only
  // if permission was already granted — this never prompts on its own.
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!needsYou) {
      notifiedRef.current = false;
      return;
    }
    if (notifiedRef.current || !document.hidden) return;
    notifiedRef.current = true;
    showNotice({
      title: `${agent?.name ?? "Agent"} needs you`,
      body: "A permission or question is waiting in the chat.",
    });
  }, [needsYou, agent?.name]);

  const clear = useCallback(() => {
    if (!agentId) return;
    resetRun(agentId);
    clearSnapshot(agentId);
  }, [agentId]);

  return { messages, sessionId, lastTurn, stats, busy, error, send, cancel, clear, decide, answer };
}
