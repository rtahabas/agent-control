import {
  EMPTY_STATS,
  type ChatMessage,
  type ChatSnapshot,
  type CumulativeStats,
  type TurnInfo,
  type TurnUsage,
} from "@/lib/chat-types";

const STORAGE_PREFIX = "chat:";

/**
 * Per-agent share of sessionStorage. Browsers give an origin a few megabytes in
 * total and this dashboard drives several agents at once, so no single
 * transcript may spend the whole allowance.
 */
export const SNAPSHOT_BUDGET_BYTES = 1_200_000;

/**
 * Shrinks a transcript to fit the budget, worst-value-per-byte first.
 *
 * A single pasted screenshot is base64 and can run to megabytes — one of them
 * outweighs thousands of turns of text. So images go before words: their
 * metadata stays, which keeps the bubble honest about what was sent, and only
 * then do the oldest turns get dropped.
 */
export function trimForStorage(
  snap: ChatSnapshot,
  budget = SNAPSHOT_BUDGET_BYTES
): ChatSnapshot {
  if (sizeOf(snap) <= budget) return snap;

  const withoutImages = snap.messages.map(stripAttachmentData);
  let messages = withoutImages;
  // Drop from the front: the newest turns are the ones worth restoring.
  while (messages.length > 1 && sizeOf({ ...snap, messages }) > budget) {
    messages = messages.slice(1);
  }
  return { ...snap, messages };
}

function stripAttachmentData(m: ChatMessage): ChatMessage {
  if (!m.attachment) return m;
  return { ...m, attachment: { ...m.attachment, dataBase64: "" } };
}

function sizeOf(snap: ChatSnapshot): number {
  return JSON.stringify(snap).length;
}

export function loadSnapshot(agentId: string): ChatSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + agentId);
    return raw ? (JSON.parse(raw) as ChatSnapshot) : null;
  } catch {
    return null;
  }
}

/**
 * Persists a transcript for reload. Returns false when it could not be kept —
 * the caller is expected to say so rather than let the user believe a history
 * is being saved that is not.
 */
export function saveSnapshot(agentId: string, snap: ChatSnapshot): boolean {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + agentId, JSON.stringify(trimForStorage(snap)));
    return true;
  } catch {
    return false;
  }
}

export function clearSnapshot(agentId: string) {
  try { sessionStorage.removeItem(STORAGE_PREFIX + agentId); } catch { /* ignore */ }
}

export function turnFromPayload(payload: Record<string, unknown>): TurnInfo {
  return {
    cost_usd: (payload.cost_usd as number) || 0,
    duration_ms: (payload.duration_ms as number) || 0,
    duration_api_ms: payload.duration_api_ms as number | undefined,
    num_turns: payload.num_turns as number | undefined,
    model: payload.model as string | null | undefined,
    usage: (payload.usage as TurnUsage | null) || null,
    context_window: payload.context_window as number | null | undefined,
  };
}

// claude CLI's `result` event reports cumulative session totals (cost + usage),
// not per-turn. Subtract prior session stats to get the actual last-turn delta.
export function deltaTurn(cumulative: TurnInfo, prev: CumulativeStats): TurnInfo {
  const sub = (cur: number | undefined, prior: number) =>
    Math.max(0, (cur ?? 0) - prior);
  return {
    ...cumulative,
    cost_usd: sub(cumulative.cost_usd, prev.total_cost_usd),
    usage: cumulative.usage
      ? {
          input_tokens: sub(cumulative.usage.input_tokens, prev.total_input),
          output_tokens: sub(cumulative.usage.output_tokens, prev.total_output),
          cache_read_input_tokens: sub(
            cumulative.usage.cache_read_input_tokens,
            prev.total_cache_read
          ),
          cache_creation_input_tokens: sub(
            cumulative.usage.cache_creation_input_tokens,
            prev.total_cache_creation
          ),
        }
      : null,
  };
}

export function accumulate(s: CumulativeStats, t: TurnInfo): CumulativeStats {
  return {
    turns: s.turns + 1,
    total_cost_usd: s.total_cost_usd + (t.cost_usd || 0),
    total_input: s.total_input + (t.usage?.input_tokens || 0),
    total_output: s.total_output + (t.usage?.output_tokens || 0),
    total_cache_read: s.total_cache_read + (t.usage?.cache_read_input_tokens || 0),
    total_cache_creation: s.total_cache_creation + (t.usage?.cache_creation_input_tokens || 0),
    total_duration_ms: s.total_duration_ms + (t.duration_ms || 0),
  };
}

export const EMPTY = EMPTY_STATS;
