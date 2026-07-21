"use client";

import { EMPTY_STATS, type ChatMessage, type CumulativeStats, type TurnInfo } from "@/lib/chat-types";
import { loadSnapshot, saveSnapshot } from "@/lib/chat-helpers";

/**
 * Everything the chat panel renders for one agent.
 *
 * A run belongs to the agent that started it, not to the panel showing it. The
 * panel is a single component driven by whichever agent is selected, so without
 * a per-agent home a still-streaming run would write into whatever is on screen
 * when you switch — appending another agent's tool cards and permission prompts
 * to the wrong transcript, and leaving the new agent's composer stuck on Stop.
 */
export type RunState = {
  messages: ChatMessage[];
  sessionId: string | null;
  lastTurn: TurnInfo | null;
  stats: CumulativeStats;
  busy: boolean;
  error: string | null;
};

export const EMPTY_RUN: RunState = {
  messages: [],
  sessionId: null,
  lastTurn: null,
  stats: EMPTY_STATS,
  busy: false,
  error: null,
};

const states = new Map<string, RunState>();
const listeners = new Map<string, Set<() => void>>();
const hydrated = new Set<string>();
const storageWarned = new Set<string>();

/**
 * Run-scoped handles. Deliberately outside RunState: mutating them must never
 * force a re-render, and they must not be persisted.
 */
const aborts = new Map<string, AbortController>();
const asstRefs = new Map<string, { current: string | null }>();

/** Pure and stable — safe to call during render (useSyncExternalStore). */
export function getRun(agentId: string): RunState {
  return states.get(agentId) ?? EMPTY_RUN;
}

export function subscribeRun(agentId: string, cb: () => void): () => void {
  let set = listeners.get(agentId);
  if (!set) {
    set = new Set();
    listeners.set(agentId, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}

export function updateRun(agentId: string, updater: (s: RunState) => RunState) {
  let next = updater(getRun(agentId));
  const saved = saveSnapshot(agentId, {
    messages: next.messages,
    sessionId: next.sessionId,
    lastTurn: next.lastTurn,
    stats: next.stats,
  });
  // Say it once. Storage failing is worth knowing about — a reload will lose the
  // conversation — but it fails on every keystroke of a run, so repeating it
  // would bury the chat under its own warning.
  if (!saved && !storageWarned.has(agentId)) {
    storageWarned.add(agentId);
    next = {
      ...next,
      error: "Ran out of room to store this chat — it will not survive a reload.",
    };
  }
  states.set(agentId, next);
  listeners.get(agentId)?.forEach((cb) => cb());
}

/**
 * Restores a persisted transcript, once per agent per page load. Switching away
 * and back must not re-read storage: the in-memory state is the live one, and a
 * re-read would roll a running turn back to whatever was last written.
 */
export function hydrateRun(agentId: string) {
  if (hydrated.has(agentId)) return;
  hydrated.add(agentId);
  const snap = loadSnapshot(agentId);
  if (!snap) return;
  states.set(agentId, {
    ...getRun(agentId),
    messages: snap.messages || [],
    sessionId: snap.sessionId ?? null,
    lastTurn: snap.lastTurn ?? null,
    stats: snap.stats || EMPTY_STATS,
  });
  listeners.get(agentId)?.forEach((cb) => cb());
}

/** Wipes an agent's transcript and session, leaving a run in flight untouched. */
export function resetRun(agentId: string) {
  updateRun(agentId, (s) => ({ ...EMPTY_RUN, busy: s.busy }));
}

export function setAbort(agentId: string, ac: AbortController | null) {
  if (ac) aborts.set(agentId, ac);
  else aborts.delete(agentId);
}

export function abortRun(agentId: string) {
  aborts.get(agentId)?.abort();
}

/** Stable per-agent mutable cell for the streaming assistant message id. */
export function asstRef(agentId: string): { current: string | null } {
  let ref = asstRefs.get(agentId);
  if (!ref) {
    ref = { current: null };
    asstRefs.set(agentId, ref);
  }
  return ref;
}

/** Test seam — drops all in-memory state. */
export function __resetStore() {
  states.clear();
  listeners.clear();
  hydrated.clear();
  storageWarned.clear();
  aborts.clear();
  asstRefs.clear();
}
