"use client";

import { useEffect, useState } from "react";
import type { Agent } from "@/lib/api";
import type { Tab } from "@/lib/tabs";
import { tabLabel } from "@/lib/tabs";
import { persistedAge } from "@/lib/persisted-state";

export type ConnState = "loading" | "ok" | "error";

const CONN_STYLE: Record<ConnState, string> = {
  loading: "border-amber-300 bg-amber-50 text-amber-700",
  ok: "border-emerald-300 bg-emerald-50 text-emerald-700",
  error: "border-rose-300 bg-rose-50 text-rose-700",
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
  selectedAgent: Agent | null;
  conn: ConnState;
  lastFetchTs: number | null;
  onRefresh: () => void;
}

export function TopBar({ tab, selectedAgent, conn, lastFetchTs, onRefresh }: Props) {
  return (
    <header className="border-b border-zinc-200 bg-white px-6 py-3 flex items-center gap-3 shrink-0">
      <div>
        <div className="text-[11px] text-zinc-400 mono">
          Dashboard <span className="px-1">›</span>{" "}
          <span className="text-zinc-700">{tabLabel(tab)}</span>
        </div>
        <h1 className="text-base font-semibold text-zinc-900 mt-0.5">
          {tabLabel(tab)}
        </h1>
      </div>
      <div className="flex-1" />
      {selectedAgent && (
        <div className="text-xs text-zinc-500 mr-2">
          agent <span className="mono text-zinc-900">{selectedAgent.name}</span>
        </div>
      )}
      <AgeBadge ts={lastFetchTs} />
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${CONN_STYLE[conn]}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${CONN_DOT[conn]}`} />
        {CONN_TEXT[conn]}
      </span>
      <button
        onClick={onRefresh}
        className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 transition"
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
