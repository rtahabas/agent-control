import { getRun, updateRun } from "@/lib/chat-store";

/**
 * Write-through from the live store to the server.
 *
 * Called at turn boundaries only. `updateRun` fires on every streamed token, so
 * persisting there would put a network round trip — and a synchronous SQLite
 * write at the other end — inside the stream. A finished turn is rare enough to
 * write whole and is the first moment the transcript is worth keeping.
 *
 * Failures are swallowed on purpose. Losing server-side history is worth one
 * warning, not a chat that stops working because a write did not land.
 */

const warned = new Set<string>();

function warnOnce(agentId: string, what: string) {
  if (warned.has(agentId)) return;
  warned.add(agentId);
  updateRun(agentId, (s) => ({ ...s, error: what }));
}

/** Creates the conversation row this agent's transcript belongs to, once. */
export async function ensureConversation(agentId: string): Promise<string | null> {
  const existing = getRun(agentId).conversationId;
  if (existing) return existing;
  try {
    const res = await fetch(`/api/agents/${agentId}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: getRun(agentId).sessionId }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const { conversation } = (await res.json()) as { conversation: { id: string } };
    updateRun(agentId, (s) => ({ ...s, conversationId: conversation.id }));
    return conversation.id;
  } catch {
    warnOnce(agentId, "This chat is not being saved to history.");
    return null;
  }
}

/** Sends the whole transcript up. Safe to call again; the server replaces. */
export async function persistRun(agentId: string): Promise<void> {
  const run = getRun(agentId);
  if (!run.messages.length) return;
  const cid = await ensureConversation(agentId);
  if (!cid) return;
  try {
    const res = await fetch(`/api/conversations/${cid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: run.messages,
        sessionId: run.sessionId,
        costUsd: run.stats?.total_cost_usd,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    warnOnce(agentId, "This chat is not being saved to history.");
  }
}

/** Loads a past conversation into the store, replacing what is on screen. */
export async function openConversation(agentId: string, cid: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/conversations/${cid}`);
    if (!res.ok) return false;
    const data = (await res.json()) as {
      conversation: { id: string; session_id: string | null };
      messages: import("@/lib/chat-types").ChatMessage[];
    };
    updateRun(agentId, (s) => ({
      ...s,
      messages: data.messages,
      conversationId: data.conversation.id,
      sessionId: data.conversation.session_id,
      error: null,
    }));
    return true;
  } catch {
    return false;
  }
}
