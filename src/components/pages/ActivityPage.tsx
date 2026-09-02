"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchActivity, type ActivityEvent, type ActivityKind, type ActivityResult } from "@/lib/activity-api";

const BADGE: Record<ActivityKind, string> = {
  user: "bg-blue-50 text-blue-700 border-blue-200",
  assistant: "bg-emerald-50 text-emerald-700 border-emerald-200",
  tool: "bg-zinc-100 text-zinc-700 border-zinc-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
};

const LABEL: Record<ActivityKind, string> = {
  user: "user",
  assistant: "assistant",
  tool: "tool",
  error: "error",
};

function relTime(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60_000) return Math.round(ms / 1000) + "s";
  if (ms < 3_600_000) return Math.round(ms / 60_000) + "m";
  if (ms < 86_400_000) return Math.round(ms / 3_600_000) + "h";
  return Math.round(ms / 86_400_000) + "d";
}

interface Props {
  agentId: string | null;
}

export function ActivityPage({ agentId }: Props) {
  const [data, setData] = useState<ActivityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityKind | "all">("all");

  const load = useCallback(() => {
    if (!agentId) return;
    setLoading(true); setError(null);
    fetchActivity(agentId, 200)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  if (!agentId) {
    return <div className="p-8 text-sm text-zinc-400">Pick an agent in <span className="text-zinc-700">Agents</span> first.</div>;
  }

  const events: ActivityEvent[] = data
    ? filter === "all"
      ? data.events
      : data.events.filter((e) => e.kind === filter)
    : [];
  const counts = data
    ? data.events.reduce<Record<ActivityKind, number>>(
        (acc, e) => ({ ...acc, [e.kind]: (acc[e.kind] || 0) + 1 }),
        { user: 0, assistant: 0, tool: 0, error: 0 }
      )
    : { user: 0, assistant: 0, tool: 0, error: 0 };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">Activity log</h2>
          {data && (
            <div className="text-xs text-zinc-400 mono mt-1">
              {data.events.length} events · {data.files_scanned} session files · {data.session_dirs} dirs
            </div>
          )}
        </div>
        <button type="button" onClick={load} disabled={loading} className="text-[11px] px-2 py-1 rounded border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      <div className="flex gap-1 mb-3 text-xs">
        {(["all", "user", "assistant", "tool"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`px-2.5 py-1 rounded-md border ${
              filter === k
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {k}
            {k !== "all" && <span className="ml-1.5 mono opacity-70">{counts[k]}</span>}
          </button>
        ))}
      </div>
      {error && <div className="text-sm text-rose-600 mb-3">{error}</div>}
      {!error && events.length === 0 && data && (
        <div className="text-sm text-zinc-400">No events match this filter.</div>
      )}
      <ul className="bg-zinc-50 rounded-lg border border-zinc-200 divide-y divide-zinc-100">
        {events.map((e, i) => (
          <li key={`${e.session}-${e.ts}-${i}`} className="flex items-start gap-3 px-4 py-3">
            <span className={`shrink-0 inline-block px-1.5 py-0.5 mt-0.5 rounded border text-[10px] font-medium uppercase tracking-wide ${BADGE[e.kind]}`}>
              {e.tool ?? LABEL[e.kind]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-700 break-words mono">{e.preview || <span className="text-zinc-400">(empty)</span>}</div>
              <div className="text-[10px] text-zinc-400 mono mt-0.5">
                {relTime(e.ts)} ago · {e.session}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
