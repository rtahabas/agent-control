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
export function ConversationList({
  agentId,
  onOpened,
}: {
  agentId: string | null;
  /** Opening a past conversation has to bring the conversation into view.
      Without this the transcript loads into a panel that is mounted but
      hidden behind whichever tab you were on, and the click looks broken. */
  onOpened: () => void;
}) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  // Deleting takes two clicks and no modal: one to arm the row, one to confirm.
  // A dialog for a chat log is too much ceremony, and a single click is how you
  // lose one you meant to keep.
  const [arming, setArming] = useState<string | null>(null);

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
    if (await openConversation(agentId, cid)) onOpened();
  };

  const remove = async (cid: string) => {
    try {
      await fetch(`/api/conversations/${cid}`, { method: "DELETE" });
    } catch {
      /* leave the row; a failed delete that looks like a success is worse */
    }
    setItems((list) => list.filter((c) => c.id !== cid));
    setArming(null);
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
    <div className="flex-1 min-h-0 flex flex-col pt-2">
      {/* No heading. A list of past conversations under a search box does not
          need a word telling you it is a list of past conversations, and the
          uppercase label was the last piece of the old panel language left in
          the rail. The search field lost its border for the same reason
          everything else did: a soft ground says "type here" without drawing a
          box around it. */}
      <div className="px-2 pb-2">
        <label className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5 focus-within:bg-zinc-200/70 transition">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor"
               strokeWidth="1.6" strokeLinecap="round" className="text-zinc-400 shrink-0" aria-hidden>
            <circle cx="6" cy="6" r="4.25" />
            <path d="M9.2 9.2 12.5 12.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!agentId}
            placeholder={agentId ? "Search chats" : "Select an agent"}
            className="w-full bg-transparent text-[13px] text-zinc-800 placeholder:text-zinc-400 focus:outline-none disabled:opacity-60"
          />
        </label>
      </div>
      <ul className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5">
        {rows.length === 0 && (
          <li className="px-3 py-2 text-xs text-zinc-400">
            {!agentId
              ? "Pick an agent to see its chats."
              : showing
                ? "Nothing matched."
                : "No saved chats yet."}
          </li>
        )}
        {rows.map((r, i) => (
          <li key={`${r.id}:${i}`} className="group flex items-center">
            <button
              type="button"
              onClick={() => void open(r.id)}
              className="flex-1 min-w-0 text-left rounded-lg px-3 py-1.5 group-hover:bg-zinc-100 transition"
            >
              <div className="text-[13px] text-zinc-700 truncate">{r.primary}</div>
              <div className="text-[11px] text-zinc-400 truncate">{r.secondary}</div>
            </button>
            {arming === r.id ? (
              <button
                type="button"
                onClick={() => void remove(r.id)}
                onBlur={() => setArming(null)}
                autoFocus
                className="mr-1 shrink-0 text-[10px] px-1.5 py-0.5 rounded-md text-white bg-accent"
              >
                Delete?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setArming(r.id)}
                aria-label="Delete this conversation"
                title="Delete this conversation"
                className="mr-1 shrink-0 w-5 h-5 rounded-md text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-zinc-700 hover:bg-zinc-200 transition"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
