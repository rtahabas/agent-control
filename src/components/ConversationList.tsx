"use client";

import { useEffect, useState } from "react";
import { openConversation } from "@/lib/conversation-sync";

interface Conversation {
  id: string;
  title: string | null;
  updated_at: string;
  message_count: number;
}

interface Hit {
  conversation_id: string;
  title: string | null;
  text: string;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
};

/**
 * Past conversations for one agent, and a box to find them by what was said.
 *
 * Both fetches abort on the way out. Without that, switching agents twice
 * quickly lets the first response land after the second and paint the wrong
 * agent's history under the right agent's name.
 */
export function ConversationList({ agentId }: { agentId: string | null }) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);

  useEffect(() => {
    if (!agentId) return;
    const ac = new AbortController();
    fetch(`/api/agents/${agentId}/conversations`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((d: { conversations: Conversation[] }) => setItems(d.conversations ?? []))
      .catch(() => {
        /* aborted or offline — the list simply stays as it was */
      });
    return () => ac.abort();
  }, [agentId]);

  useEffect(() => {
    const q = query.trim();
    // No setState on the empty path: an emptied box is handled at render by
    // ignoring whatever `hits` still holds, which keeps this effect free of
    // the synchronous-setState cascade the lint rule is there to prevent.
    if (!q) return;
    const ac = new AbortController();
    // Typing is faster than the round trip; wait for a pause rather than
    // firing a query per keystroke.
    const t = setTimeout(() => {
      const url = `/api/search?q=${encodeURIComponent(q)}${agentId ? `&agent=${agentId}` : ""}`;
      fetch(url, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d: { hits: Hit[] }) => setHits(d.hits ?? []))
        .catch(() => {
          /* aborted */
        });
    }, 200);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query, agentId]);

  const open = async (cid: string) => {
    if (!agentId) return;
    await openConversation(agentId, cid);
  };

  // An emptied search box falls back to the list without the effect having to
  // clear anything, so stale hits are ignored rather than unset.
  const showing = query.trim() ? hits : null;

  const rows = showing
    ? showing.map((h) => ({
        id: h.conversation_id,
        primary: h.title ?? "Untitled",
        secondary: h.text.slice(0, 60),
      }))
    : items.map((c) => ({
        id: c.id,
        primary: c.title ?? "Untitled",
        secondary: `${when(c.updated_at)} · ${c.message_count}`,
      }));

  return (
    <div className="border-t border-zinc-200 flex-1 min-h-0 flex flex-col">
      <div className="px-4 pt-3 pb-2">
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
          History
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!agentId}
          placeholder={agentId ? "Search this agent's chats…" : "Select an agent first"}
          className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400"
        />
      </div>
      <ul className="flex-1 overflow-y-auto pb-2">
        {rows.length === 0 && (
          <li className="px-4 py-2 text-xs text-zinc-400">
            {!agentId
              ? "Pick an agent to see its chats."
              : showing
                ? "Nothing matched."
                : "No saved chats yet."}
          </li>
        )}
        {rows.map((r, i) => (
          <li key={`${r.id}:${i}`}>
            <button
              type="button"
              onClick={() => void open(r.id)}
              className="w-full text-left px-4 py-1.5 hover:bg-zinc-50 transition"
            >
              <div className="text-xs text-zinc-800 truncate">{r.primary}</div>
              <div className="text-[10px] text-zinc-400 truncate">{r.secondary}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
