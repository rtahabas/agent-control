"use client";

import type { Agent, State } from "@/lib/api";
import { AgentDetail } from "./AgentDetail";

interface Props {
  agents: Agent[];
  selectedId: string | null;
  state: State | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
  onEditClick: (agent: Agent) => void;
  onDeleteClick: (agent: Agent) => void;
  onOpenFile: (agent: Agent, file: string) => void;
}

export function AgentsPage({
  agents,
  selectedId,
  state,
  onSelect,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onOpenFile,
}: Props) {
  const selected = agents.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r border-zinc-200 bg-zinc-50 flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-zinc-100">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Workspace</div>
            <div className="text-sm font-semibold text-zinc-900">Agents · {agents.length}</div>
          </div>
          <button type="button" onClick={onAddClick} className="text-[11px] px-2 py-1 rounded-md font-medium bg-zinc-900 text-white hover:bg-zinc-700">+ New</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {agents.length === 0 ? (
            <div className="text-xs text-zinc-400 px-3 py-2">(none yet)</div>
          ) : (
            agents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelect(a.id)}
                className={`w-full text-left rounded-lg p-3 transition border ${
                  a.id === selectedId
                    ? "bg-zinc-100 border-zinc-300"
                    : "border-transparent hover:bg-zinc-50 hover:border-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-sm font-medium text-zinc-900 truncate">{a.name}</div>
                  <span
                    className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                      a.status === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <div className="text-[11px] mono text-zinc-500 truncate">{a.id}</div>
              </button>
            ))
          )}
        </div>
      </aside>
      <section className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <AgentDetail
            agent={selected}
            state={selected.id === selectedId ? state : null}
            onEdit={() => onEditClick(selected)}
            onDelete={() => onDeleteClick(selected)}
            onOpenFile={(file) => onOpenFile(selected, file)}
          />
        ) : (
          <div className="text-sm text-zinc-400">Pick an agent on the left, or click + New.</div>
        )}
      </section>
    </div>
  );
}
