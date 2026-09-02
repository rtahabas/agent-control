"use client";

import { useEffect, useState } from "react";
import type { Agent, State } from "@/lib/api";
import { fetchMemoryFile } from "@/lib/memory-api";

interface Props {
  agent: Agent;
  state: State | null;
  onEdit: () => void;
  onDelete: () => void;
  onOpenFile: (file: string) => void;
}

const PREVIEW_FILES = [
  "MEMORY.md",
  "GUARDRAILS.md",
  "HEARTBEAT.md",
  "today.md",
  "INDEX-rules.md",
  "INDEX-pending.md",
];

const PREVIEW_LINES = 12;

export function AgentDetail({ agent, state, onEdit, onDelete, onOpenFile }: Props) {
  const stats = state
    ? [
        { label: "Skills", value: state.skills.installed_count },
        { label: "Sub-agents", value: state.sub_agents.length },
        { label: "Memory files", value: state.memory.total_files },
        { label: "Projects", value: state.projects.length },
        { label: "Pending", value: state.pending.length },
        {
          label: "Hooks",
          value: Object.values(state.hooks).reduce((a, b) => a + b, 0),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">Active agent</div>
          <h1 className="text-xl font-semibold text-zinc-900 truncate">{agent.name}</h1>
          <div className="mt-1 text-xs text-zinc-500 mono break-all">{agent.path}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onEdit} className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50">Edit</button>
          <button type="button" onClick={onDelete} className="text-xs px-3 py-1.5 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50">Remove</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-zinc-50 rounded-lg border border-zinc-200 p-3">
            <div className="text-2xl font-semibold text-zinc-900 mono">{s.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2">Core files</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PREVIEW_FILES.map((f) => (
            <FilePreview key={f} agentId={agent.id} file={f} onOpen={() => onOpenFile(f)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilePreview({
  agentId,
  file,
  onOpen,
}: {
  agentId: string;
  file: string;
  onOpen: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetchMemoryFile(agentId, file)
      .then((c) => { if (alive) setText(c); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [agentId, file]);

  const preview = text
    ? text.split("\n").slice(0, PREVIEW_LINES).join("\n")
    : "";
  const truncated = text ? text.split("\n").length > PREVIEW_LINES : false;
  const missing = error?.includes("ENOENT") || error?.includes("not found");

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!!error}
      className="block w-full text-left bg-zinc-50 rounded-lg border border-zinc-200 p-3 hover:border-zinc-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-mono text-zinc-700">{file}</div>
        <div className="text-[10px] text-zinc-400">{loading ? "…" : missing ? "missing" : "open →"}</div>
      </div>
      {error && !missing && <div className="text-xs text-rose-600">{error}</div>}
      {!error && preview && (
        <pre className="text-[11px] leading-snug text-zinc-600 mono whitespace-pre-wrap line-clamp-[12] overflow-hidden">
{preview}
{truncated ? "\n…" : ""}
        </pre>
      )}
      {!error && !loading && !preview && <div className="text-xs text-zinc-400">(empty)</div>}
    </button>
  );
}
