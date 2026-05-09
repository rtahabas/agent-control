"use client";

import type { MemoryUtilization } from "@/lib/memory-api";

type Filter = "all" | "hot" | "orphan" | "stale" | "urgent" | "bloated";

interface Props {
  util: MemoryUtilization;
  filter: Filter;
  setFilter: (f: Filter) => void;
}

export function QualityIssues({ util, filter, setFilter }: Props) {
  const tiles: Array<{ key: Filter; label: string; count: number; tone: "neutral" | "amber" | "rose" }> = [
    { key: "all", label: "All", count: util.counts.total, tone: "neutral" },
    { key: "hot", label: "HOT", count: util.counts.hot, tone: "neutral" },
    { key: "orphan", label: "Orphan", count: util.counts.orphan, tone: util.counts.orphan > 0 ? "amber" : "neutral" },
    { key: "stale", label: `Stale (${util.stale_threshold_days}d+)`, count: util.counts.stale, tone: util.counts.stale > 0 ? "amber" : "neutral" },
    { key: "urgent", label: `Urgent (${util.urgent_threshold_days}d+)`, count: util.counts.urgent, tone: util.counts.urgent > 0 ? "rose" : "neutral" },
    { key: "bloated", label: `Bloated (>${util.bloated_line_threshold} ln)`, count: util.counts.bloated, tone: util.counts.bloated > 0 ? "rose" : "neutral" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiles.map((t) => (
          <Tile
            key={t.key}
            active={filter === t.key}
            onClick={() => setFilter(t.key)}
            label={t.label}
            count={t.count}
            tone={t.tone}
          />
        ))}
      </div>
      {util.drift.length > 0 && <DriftList drift={util.drift} />}
      <Hint />
    </div>
  );
}

function Tile({
  active, onClick, label, count, tone,
}: {
  active: boolean; onClick: () => void; label: string; count: number; tone: "neutral" | "amber" | "rose";
}) {
  const palette = active
    ? "bg-zinc-900 text-white border-zinc-900"
    : tone === "rose"
      ? "bg-rose-50 text-rose-900 border-rose-200 hover:border-rose-300"
      : tone === "amber"
        ? "bg-amber-50 text-amber-900 border-amber-200 hover:border-amber-300"
        : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border px-3 py-2 transition ${palette}`}
    >
      <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
      <div className="mono text-lg font-semibold">{count}</div>
    </button>
  );
}

function DriftList({ drift }: { drift: { index: string; entry: string; target: string }[] }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs">
      <div className="font-semibold text-rose-900 mb-1">
        Index drift · {drift.length} broken link{drift.length === 1 ? "" : "s"}
      </div>
      <ul className="space-y-0.5 text-rose-800 mono">
        {drift.slice(0, 8).map((d, i) => (
          <li key={i}>
            {d.index} → <span className="font-medium">{d.target}</span> (missing)
          </li>
        ))}
        {drift.length > 8 && <li className="text-rose-700">+{drift.length - 8} more</li>}
      </ul>
    </div>
  );
}

function Hint() {
  return (
    <div className="text-[11px] text-zinc-500 italic">
      Read-only signals. Trigger consolidation by typing{" "}
      <span className="mono not-italic px-1 py-0.5 rounded bg-zinc-100 text-zinc-700">memory prune</span>{" "}
      in chat — propose-then-apply per MEMORY-PRUNING.md.
    </div>
  );
}
