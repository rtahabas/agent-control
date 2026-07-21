import { fmtCost, fmtMs } from "@/lib/chat-fmt";
import { runEndedMessage } from "@/lib/run-outcome";

/** The tail of a `done` event — everything needed to describe how a run ended. */
export type RunEnd = {
  subtype?: string | null;
  numTurns?: number | null;
  errors?: string[] | null;
  costUsd?: number | null;
  durationMs?: number | null;
};

export type Notice = { title: string; body: string };

/**
 * Describes a finished run for a desktop notification. The tab title already
 * says a run is in flight; this is the other half — you started something long,
 * switched away, and nothing told you it was over.
 *
 * A run that stopped early reuses runEndedMessage, so the notification and the
 * in-chat message say the same thing.
 */
export function runNotification(end: RunEnd, agentName?: string | null): Notice {
  const who = agentName || "Agent";
  const stopped = runEndedMessage(end.subtype, end.numTurns, end.errors);
  if (stopped) return { title: `${who} stopped`, body: stopped };
  return { title: `${who} finished`, body: summarize(end) };
}

/** "12 turns · $0.3421 · 1m" — whichever of those the run actually reported. */
function summarize(end: RunEnd): string {
  const parts: string[] = [];
  if (end.numTurns != null && end.numTurns > 0) {
    parts.push(`${end.numTurns} ${end.numTurns === 1 ? "turn" : "turns"}`);
  }
  if (end.costUsd != null && end.costUsd > 0) parts.push(fmtCost(end.costUsd));
  if (end.durationMs != null && end.durationMs > 0) parts.push(fmtMs(end.durationMs));
  return parts.length > 0 ? parts.join(" · ") : "The run finished.";
}

/**
 * Shows a desktop notification only if permission was already granted — this
 * never prompts on its own (the header's "Enable alerts" button is the only
 * place that asks). Returns whether one was shown.
 */
export function showNotice(n: Notice): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  new Notification(n.title, { body: n.body });
  return true;
}
