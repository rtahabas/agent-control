/** Matches the app title in app/layout.tsx — the tab reverts to this when idle. */
export const BASE_TITLE = "Agent Control Plane";

export type AttentionState = {
  /** A permission or question card is waiting on the user. */
  needsYou: boolean;
  /** A turn is in flight. */
  busy: boolean;
};

/**
 * Tab title for the current chat state. A card waiting on the user outranks an
 * in-flight turn: "needs you" is the state worth noticing from another tab,
 * since the agent is blocked until it is answered.
 */
export function attentionTitle(
  state: AttentionState,
  agentName?: string | null,
  base: string = BASE_TITLE
): string {
  const who = agentName ? ` — ${agentName}` : "";
  if (state.needsYou) return `● Needs you${who}`;
  if (state.busy) return `⋯ Working${who}`;
  return `${base}${who}`;
}
