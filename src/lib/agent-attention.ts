import type { AgentAttention } from "@/lib/chat-store";
import { BASE_TITLE } from "@/lib/attention";

export type AgentStatus = "waiting" | "working" | "idle";

export function statusOf(a: AgentAttention | undefined): AgentStatus {
  if (!a) return "idle";
  // A blocked agent outranks a busy one: it stays blocked until you act, while
  // a running turn is making progress on its own.
  if (a.needsYou) return "waiting";
  return a.busy ? "working" : "idle";
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  waiting: "needs you",
  working: "working",
  idle: "idle",
};

/**
 * The agent the tab title should name.
 *
 * Whichever agent you happen to be looking at is the wrong thing to report:
 * you can already see it. The one worth surfacing is any agent blocked on a
 * card, because it will sit there until somebody answers — and while driving
 * three at once, that is exactly the one you are not watching. The selected
 * agent only wins ties, so the title stops flickering between two idle agents.
 */
export function titleAgent(
  attention: Record<string, AgentAttention>,
  selectedId: string | null
): { id: string; status: AgentStatus } | null {
  const ranked = Object.entries(attention)
    .map(([id, a]) => ({ id, status: statusOf(a) }))
    .filter((x) => x.status !== "idle");
  if (ranked.length === 0) return null;

  const waiting = ranked.filter((x) => x.status === "waiting");
  const pool = waiting.length > 0 ? waiting : ranked;
  return pool.find((x) => x.id === selectedId) ?? pool[0];
}

/** Tab title naming whichever agent wants attention, not the one on screen. */
export function attentionTitleFor(
  attention: Record<string, AgentAttention>,
  selectedId: string | null,
  nameOf: (id: string) => string | null
): string {
  const top = titleAgent(attention, selectedId);
  if (!top) return BASE_TITLE;
  const who = nameOf(top.id);
  const suffix = who ? ` — ${who}` : "";
  return top.status === "waiting" ? `● Needs you${suffix}` : `⋯ Working${suffix}`;
}
