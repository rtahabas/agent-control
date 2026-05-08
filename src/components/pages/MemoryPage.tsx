"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMemoryFiles } from "@/lib/memory-api";

const CATEGORIES = ["core", "index", "feedback", "project", "pending", "daily", "other"] as const;
type Category = (typeof CATEGORIES)[number];

const LABELS: Record<Category, string> = {
  core: "Core",
  index: "Indexes",
  feedback: "Feedback",
  project: "Projects",
  pending: "Pending",
  daily: "Daily logs",
  other: "Other",
};

function categorize(file: string): Category {
  if (/^(GUARDRAILS|MEMORY|HEARTBEAT|today|commitments)\.md$/.test(file)) return "core";
  if (/^INDEX/.test(file)) return "index";
  if (/^feedback_/.test(file)) return "feedback";
  if (/^project_/.test(file)) return "project";
  if (/^pending_/.test(file)) return "pending";
  if (/^\d{4}-\d{2}-\d{2}/.test(file)) return "daily";
  return "other";
}

interface Props {
  agentId: string | null;
  onFileClick?: (file: string) => void;
  onNewFile?: () => void;
}

export function MemoryPage({ agentId, onFileClick, onNewFile }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!agentId) return;
    setLoading(true); setError(null);
    fetchMemoryFiles(agentId)
      .then(setFiles)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  if (!agentId) {
    return <div className="p-8 text-sm text-zinc-400">Pick an agent in <span className="text-zinc-700">Agents</span> first.</div>;
  }

  const grouped: Record<Category, string[]> = {
    core: [], index: [], feedback: [], project: [], pending: [], daily: [], other: [],
  };
  for (const f of files) grouped[categorize(f)].push(f);

  return (
    <div className="p-6 max-w-6xl space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">Memory</h2>
          <div className="text-xs text-zinc-400 mono mt-1">{files.length} files</div>
        </div>
        {onNewFile && (
          <button type="button" onClick={onNewFile} className="text-[11px] px-2 py-0.5 rounded border border-zinc-200 text-zinc-700 hover:bg-zinc-50">+ New file</button>
        )}
      </div>
      {loading && files.length === 0 && <div className="text-sm text-zinc-500">Loading…</div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {CATEGORIES.map((c) => grouped[c].length === 0 ? null : (
        <section key={c}>
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
            {LABELS[c]} <span className="text-zinc-400 font-normal">· {grouped[c].length}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {grouped[c].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFileClick?.(f)}
                className="text-xs font-mono px-2 py-1 rounded bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300"
              >
                {f}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
