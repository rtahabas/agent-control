"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent } from "@/lib/api";
import { useAgentAttention } from "@/lib/use-agent-attention";
import { STATUS_LABEL, statusOf, type AgentStatus } from "@/lib/agent-attention";

/**
 * Which agent you are reading, and the switch between them.
 *
 * This used to be a permanent list in the rail. It is one line of information
 * that was taking a block of the column, so it sits where the answer is
 * actually needed — above the conversation — and opens only when asked.
 *
 * The trigger keeps one signal from the old list: a mark when some *other*
 * agent is blocked. Folding that away would mean an agent waiting on a
 * permission card is invisible until you happen to look for it, which is the
 * one thing this console is for.
 */
export function AgentPicker({
  agents,
  selectedId,
  onSelect,
}: {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const attention = useAgentAttention();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (agents.length === 0) return null;

  const current = agents.find((a) => a.id === selectedId) ?? null;
  const elsewhere = agents.some(
    (a) => a.id !== selectedId && statusOf(attention[a.id]) === "waiting"
  );

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-zinc-500 hover:bg-zinc-100 transition"
      >
        <Dot status={current ? statusOf(attention[current.id]) : "idle"} />
        <span className="mono text-zinc-900">{current?.name ?? "Select agent"}</span>
        {elsewhere && (
          <span
            title="Another agent is waiting on you"
            className="w-1.5 h-1.5 rounded-full bg-amber-500"
          />
        )}
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 3.5 L5 6.5 L8 3.5" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1 z-20 min-w-52 rounded-lg border border-zinc-200 bg-zinc-50 shadow-lg py-1"
        >
          {agents.map((a) => {
            const status = statusOf(attention[a.id]);
            const selected = a.id === selectedId;
            return (
              <li key={a.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(a.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition ${
                    selected ? "bg-accent-soft" : "hover:bg-zinc-50"
                  }`}
                >
                  <Dot status={status} />
                  <span
                    className={`text-sm truncate flex-1 ${
                      selected ? "text-accent font-medium" : "text-zinc-700"
                    }`}
                  >
                    {a.name}
                  </span>
                  {status !== "idle" && (
                    <span
                      className={`text-[10px] shrink-0 ${
                        status === "waiting" ? "text-amber-700" : "text-zinc-400"
                      }`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Dot({ status }: { status: AgentStatus }) {
  const tone =
    status === "waiting"
      ? "bg-amber-500"
      : status === "working"
        ? "bg-emerald-500 animate-pulse"
        : "bg-zinc-300";
  return <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone}`} />;
}
