"use client";

import { useEffect, useState } from "react";
import { fetchMemoryFiles } from "@/lib/memory-api";
import { ModalShell } from "./editor/Field";

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
  agentId: string;
  onClose: () => void;
  onSelect: (file: string) => void;
}

export function MemoryBrowser({ agentId, onClose, onSelect }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchMemoryFiles(agentId)
      .then((f) => { if (alive) setFiles(f); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [agentId]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const grouped: Record<Category, string[]> = {
    core: [], index: [], feedback: [], project: [], pending: [], daily: [], other: [],
  };
  for (const f of files) grouped[categorize(f)].push(f);

  return (
    <ModalShell onClose={onClose} busy={false} wide>
      <div className="flex flex-col max-h-[85vh]">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">Memory files</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{files.length} files in this agent&apos;s <code>memory/</code></p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 bg-zinc-50 space-y-5">
          {loading && <div className="text-sm text-zinc-500">Loading…</div>}
          {error && <div className="text-sm text-rose-600">{error}</div>}
          {!loading && !error && CATEGORIES.map((c) => grouped[c].length === 0 ? null : (
            <section key={c}>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                {LABELS[c]} <span className="text-zinc-400 font-normal">· {grouped[c].length}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {grouped[c].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onSelect(f)}
                    className="text-xs font-mono px-2 py-1 rounded bg-zinc-50 border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
