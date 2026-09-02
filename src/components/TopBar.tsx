"use client";

import { useEffect, useState } from "react";
import type { Agent } from "@/lib/api";
import type { Tab } from "@/lib/tabs";
import { AgentPicker } from "@/components/AgentPicker";
import { TabMenu } from "@/components/TabMenu";
import { tabLabel } from "@/lib/tabs";
import { persistedAge } from "@/lib/persisted-state";

export type ConnState = "loading" | "ok" | "error";

// Borderless. The dot already carries the state; a ring around it was the
// third thing saying the same word. Only an error keeps a tinted ground —
// "connected" is the expected case and does not need to announce itself.
const CONN_STYLE: Record<ConnState, string> = {
  loading: "text-amber-700",
  ok: "text-zinc-400",
  error: "bg-rose-50 text-rose-700",
};

const CONN_DOT: Record<ConnState, string> = {
  loading: "bg-amber-500 blink",
  ok: "bg-emerald-500",
  error: "bg-rose-500",
};

const CONN_TEXT: Record<ConnState, string> = {
  loading: "fetching",
  ok: "live",
  error: "disconnected",
};

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  selectedAgent: Agent | null;
  agents: Agent[];
  onSelectAgent: (id: string) => void;
  conn: ConnState;
  lastFetchTs: number | null;
  onRefresh: () => void;
}

export function TopBar({ tab, onTabChange, selectedAgent, agents, onSelectAgent, conn, lastFetchTs, onRefresh }: Props) {
  return (
    <header className="material px-6 py-3.5 flex items-center gap-3 shrink-0">
      {/* One title, not two. The breadcrumb read "Dashboard › Chat" directly
          above a heading that read "Chat" — the same word twice, one of them in
          a monospace face that belongs to code, not to navigation. */}
      <h1 className="text-[17px] font-semibold text-zinc-900 tracking-[-0.02em]">
        {tabLabel(tab)}
      </h1>
      <div className="flex-1" />
      <div className="mr-2">
        <AgentPicker agents={agents} selectedId={selectedAgent?.id ?? null} onSelect={onSelectAgent} />
      </div>
      <TabMenu tab={tab} onTabChange={onTabChange} />
      <AgeBadge ts={lastFetchTs} />
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${CONN_STYLE[conn]}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${CONN_DOT[conn]}`} />
        {CONN_TEXT[conn]}
      </span>
      <button
        onClick={onRefresh}
        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition"
      >
        Refresh
      </button>
    </header>
  );
}

function AgeBadge({ ts }: { ts: number | null }) {
  const [label, setLabel] = useState(() => persistedAge(ts));
  useEffect(() => {
    setLabel(persistedAge(ts));
    if (ts === null) return;
    const t = setInterval(() => setLabel(persistedAge(ts)), 1000);
    return () => clearInterval(t);
  }, [ts]);
  return <span className="text-xs text-zinc-400 mono">{label}</span>;
}
