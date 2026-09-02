import type Database from "better-sqlite3";
import { getDb } from "./db";
import type { ChatMessage } from "./chat-types";

/**
 * Conversations as rows, so a transcript survives the browser that made it.
 *
 * The store in the client is still the live one during a turn; this is what it
 * writes through to when a message finishes. Nothing here runs per streamed
 * token — every call is a completed message or a whole transcript.
 */

export interface Conversation {
  id: string;
  agent_id: string;
  title: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  cost_usd: number;
}

export interface SearchHit {
  conversation_id: string;
  agent_id: string;
  title: string | null;
  role: string;
  text: string;
  created_at: string;
}

const now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

/** First line of the first thing a person said, which is what they will look for. */
export function titleFrom(messages: ChatMessage[]): string | null {
  const first = messages.find((m) => m.role === "user" && m.text.trim());
  if (!first) return null;
  const line = first.text.trim().split("\n", 1)[0].trim();
  return line.length > 80 ? line.slice(0, 79) + "…" : line;
}

export function createConversation(
  agentId: string,
  id: string,
  sessionId: string | null = null,
  db: Database.Database = getDb()
): Conversation {
  const ts = now();
  db.prepare(
    `INSERT INTO conversations (id, agent_id, title, session_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`
  ).run(id, agentId, null, sessionId, ts, ts);
  return {
    id,
    agent_id: agentId,
    title: null,
    session_id: sessionId,
    created_at: ts,
    updated_at: ts,
    message_count: 0,
    cost_usd: 0,
  };
}

export function listConversations(
  agentId: string,
  limit = 50,
  db: Database.Database = getDb()
): Conversation[] {
  return db
    .prepare(
      `SELECT * FROM conversations WHERE agent_id = ?
       ORDER BY updated_at DESC LIMIT ?`
    )
    .all(agentId, limit) as Conversation[];
}

export function getConversation(
  id: string,
  db: Database.Database = getDb()
): Conversation | null {
  return (db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
    | Conversation
    | undefined) ?? null;
}

export function deleteConversation(id: string, db: Database.Database = getDb()): boolean {
  const drop = db.transaction((cid: string) => {
    db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(cid);
    return db.prepare("DELETE FROM conversations WHERE id = ?").run(cid).changes > 0;
  });
  return drop(id);
}

/**
 * Replaces a conversation's messages with the transcript given.
 *
 * Replace rather than append because the client holds the authoritative
 * ordering during a turn and a message can change after it first appears — a
 * permission card goes from pending to allowed, a tool call gains its result.
 * Appending would leave both versions and the transcript would grow a second
 * copy of every card the user answered.
 */
export function saveTranscript(
  conversationId: string,
  messages: ChatMessage[],
  meta: { sessionId?: string | null; costUsd?: number } = {},
  db: Database.Database = getDb()
): number {
  const ts = now();
  const write = db.transaction((list: ChatMessage[]) => {
    db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(conversationId);
    const insert = db.prepare(
      `INSERT INTO messages (id, conversation_id, seq, role, text, payload, created_at)
       VALUES (?,?,?,?,?,?,?)`
    );
    list.forEach((m, seq) => {
      const { id, role, text, ...rest } = m;
      const extra = Object.keys(rest).length ? JSON.stringify(rest) : null;
      insert.run(`${conversationId}:${seq}`, conversationId, seq, role, text ?? "", extra, ts);
      void id;
    });
    db.prepare(
      `UPDATE conversations
          SET title = COALESCE(title, ?), updated_at = ?, message_count = ?,
              session_id = COALESCE(?, session_id), cost_usd = COALESCE(?, cost_usd)
        WHERE id = ?`
    ).run(
      titleFrom(list),
      ts,
      list.length,
      meta.sessionId ?? null,
      meta.costUsd ?? null,
      conversationId
    );
    return list.length;
  });
  return write(messages);
}

export function loadTranscript(
  conversationId: string,
  db: Database.Database = getDb()
): ChatMessage[] {
  const rows = db
    .prepare(
      `SELECT seq, role, text, payload FROM messages
        WHERE conversation_id = ? ORDER BY seq`
    )
    .all(conversationId) as {
    seq: number;
    role: string;
    text: string;
    payload: string | null;
  }[];
  return rows.map((r) => ({
    id: `${conversationId}:${r.seq}`,
    role: r.role as ChatMessage["role"],
    text: r.text,
    ...(r.payload ? (JSON.parse(r.payload) as object) : {}),
  })) as ChatMessage[];
}

/**
 * Substring search over message text.
 *
 * An empty query returns nothing rather than everything: the caller is a search
 * box, and a box you have not typed in yet should not dump the archive.
 */
export function searchMessages(
  query: string,
  agentId: string | null = null,
  limit = 50,
  db: Database.Database = getDb()
): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  const sql = `
    SELECT m.conversation_id, c.agent_id, c.title, m.role, m.text, m.created_at
      FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE m.text LIKE ? ESCAPE '\\' ${agentId ? "AND c.agent_id = ?" : ""}
     ORDER BY c.updated_at DESC, m.seq LIMIT ?`;
  const args = agentId ? [like, agentId, limit] : [like, limit];
  return db.prepare(sql).all(...args) as SearchHit[];
}
