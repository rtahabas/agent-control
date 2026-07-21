"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Agent } from "@/lib/api";
import { BASE_TITLE } from "@/lib/attention";
import { attentionTitleFor, statusOf } from "@/lib/agent-attention";
import { showNotice } from "@/lib/run-notify";
import { useAgentAttention } from "@/lib/use-agent-attention";

/**
 * Puts the tab title and desktop alerts on every agent rather than the one on
 * screen.
 *
 * This used to live inside the chat session, which by construction only ever
 * saw the selected agent — so a second agent stopping on a permission card was
 * invisible, and it stayed stopped until you happened to switch to it. Lives at
 * the page level now, above whichever agent is being read.
 */
export function useAttentionSignal(agents: Agent[], selectedId: string | null) {
  const attention = useAgentAttention();
  // Looked up through a stable callback rather than a fresh closure per render,
  // so the effects below depend on the agent list itself and not on identity.
  const nameOf = useCallback(
    (id: string) => agents.find((a) => a.id === id)?.name ?? null,
    [agents]
  );

  useEffect(() => {
    document.title = attentionTitleFor(attention, selectedId, nameOf);
  }, [attention, selectedId, nameOf]);

  // Restore the plain title once, on unmount — not on every state change.
  useEffect(() => () => void (document.title = BASE_TITLE), []);

  // One alert per agent per blocked episode: it clears when that agent is
  // unblocked, so the next card can announce itself.
  const announced = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const [id, a] of Object.entries(attention)) {
      const waiting = statusOf(a) === "waiting";
      if (!waiting) {
        announced.current.delete(id);
        continue;
      }
      if (announced.current.has(id) || !document.hidden) continue;
      announced.current.add(id);
      showNotice({
        title: `${nameOf(id) ?? "Agent"} needs you`,
        body: "A permission or question is waiting in the chat.",
      });
    }
  }, [attention, nameOf]);
}
