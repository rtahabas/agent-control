"use client";

import type { MemoryUtilization } from "@/lib/memory-api";
import { fmtNum } from "@/lib/chat-fmt";

export function MemoryHeader({
  util,
  onNewFile,
}: {
  util: MemoryUtilization;
  onNewFile?: () => void;
}) {
  const ln = util.memory_md_lines;
  const cap = util.hot_lines_limit;
  const pct = cap > 0 ? Math.round((ln / cap) * 100) : 0;
  const tone =
    ln > cap ? "rose" : ln >= cap * 0.8 ? "amber" : "emerald";
  const palette =
    tone === "rose"
      ? "text-rose-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-emerald-700";
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">Memory</h2>
        <div className="text-xs text-zinc-500 mono">
          {util.counts.total} files · ~{fmtNum(util.total_tokens)} tokens · HOT ~{fmtNum(util.hot_tokens)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className={`text-xs ${palette}`}>
          MEMORY.md{" "}
          <span className="mono font-medium">
            {ln}/{cap} ln ({pct}%)
          </span>
        </div>
        {onNewFile && (
          <button
            type="button"
            onClick={onNewFile}
            className="text-[11px] px-2 py-0.5 rounded border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
          >
            + New file
          </button>
        )}
      </div>
    </div>
  );
}
