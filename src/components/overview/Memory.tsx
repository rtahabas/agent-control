"use client";

import type { Memory as MemoryState } from "@/lib/api";
import { SectionHead } from "./Section";

const CATS = ["feedback", "project", "pending", "other"] as const;
type Cat = (typeof CATS)[number];

export function Memory({
  memory,
  onFileClick,
  onNewClick,
  onBrowseClick,
}: {
  memory: MemoryState;
  onFileClick?: (file: string) => void;
  onNewClick?: () => void;
  onBrowseClick?: () => void;
}) {
  const total = CATS.reduce((a, k) => a + memory.categories[k], 0) || 1;
  return (
    <section>
      <SectionHead title="Memory" />
      <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-4 space-y-3">
        <div className="flex items-baseline gap-2 pb-3 border-b border-zinc-100">
          <span className="text-3xl font-semibold text-zinc-900 mono">{memory.total_files}</span>
          <span className="text-xs text-zinc-500">
            files · {memory.total_lines.toLocaleString()} lines
          </span>
        </div>
        <div className="text-xs text-zinc-500 flex gap-4">
          <span>
            Δ <span className="text-zinc-900 font-medium mono">{memory.modified_last_7d}</span> in 7d
          </span>
          <span>
            Δ <span className="text-zinc-900 font-medium mono">{memory.modified_last_30d}</span> in 30d
          </span>
        </div>
        <div className="space-y-1.5 pt-1">
          {CATS.map((k) => (
            <Bar key={k} label={k} value={memory.categories[k]} total={total} />
          ))}
        </div>
        <div className="pt-3 border-t border-zinc-100">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs text-zinc-500">Core files ({memory.indexes.length})</div>
            <div className="flex items-center gap-1">
              {onNewClick && (
                <button type="button" onClick={onNewClick} className="text-[11px] px-2 py-0.5 rounded border border-zinc-200 text-zinc-700 hover:bg-zinc-50">+ New</button>
              )}
              {onBrowseClick && (
                <button type="button" onClick={onBrowseClick} className="text-[11px] px-2 py-0.5 rounded border border-zinc-200 text-zinc-700 hover:bg-zinc-50">All files</button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {memory.indexes.map((f) =>
              onFileClick ? (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFileClick(f)}
                  className="text-xs mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 transition"
                >
                  {f}
                </button>
              ) : (
                <span key={f} className="text-xs mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                  {f}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Bar({ label, value, total }: { label: Cat; value: number; total: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-zinc-500 capitalize">{label}</span>
        <span className="mono text-zinc-900 font-medium">{value}</span>
      </div>
      <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="h-1 bg-zinc-700 rounded-full"
          style={{ width: `${(value / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
