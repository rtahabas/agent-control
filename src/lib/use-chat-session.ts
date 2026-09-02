"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Agent } from "@/lib/api";
import { type Attachment, type ChatMessage } from "@/lib/chat-types";
import { rand } from "@/lib/chat-fmt";
import { runSlashCommand } from "@/lib/chat-slash-run";
import { clearSnapshot } from "@/lib/chat-helpers";
import { persistRun } from "@/lib/conversation-sync";
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
import { settleOpenCards } from "@/lib/chat-dispatch";
import { errorWriter, makeDispatch, messageWriter } from "@/lib/chat-run-dispatch";
import { streamSse } from "@/lib/chat-stream-reader";
import { postAnswer, postDecide } from "@/lib/chat-actions";
import { useCardShortcuts } from "@/lib/use-card-shortcuts";

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

      // Slash commands: answered by the dashboard itself, since this chat runs on
      // the Agent SDK rather than the CLI prompt that would otherwise read them.
      let messageToSend = trimmed;
      if (trimmed.startsWith("/") && !attachment) {
        const outcome = await runSlashCommand(id, trimmed, setMessages);
        if (outcome.kind === "done") return;
        messageToSend = outcome.message;
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
        // The turn is over, so the transcript is worth keeping. Not awaited:
        // the chat is usable again the moment the stream closes, and history
        // failing to save is a warning, not a reason to block the UI.
        void persistRun(id);
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

  useCardShortcuts(messages, visible, decide, answer);

  // The tab title and desktop alerts deliberately do not live here: this hook
  // only ever sees the selected agent, and the whole point is noticing the one
  // you are not looking at. See use-attention-signal, mounted at page level.

  const clear = useCallback(() => {
    if (!agentId) return;
    resetRun(agentId);
    clearSnapshot(agentId);
  }, [agentId]);

  return { messages, sessionId, lastTurn, stats, busy, error, send, cancel, clear, decide, answer };
}
