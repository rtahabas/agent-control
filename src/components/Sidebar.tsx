"use client";

import type { Agent } from "@/lib/api";
import { AgentRow } from "./AgentRow";

interface Props {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: () => void;
  onAddClick: () => void;
  onEditClick: (agent: Agent) => void;
  onDeleteClick: (agent: Agent) => void;
}

export function Sidebar({
  agents,
  selectedId,
  onSelect,
  onChange,
  onAddClick,
  onEditClick,
  onDeleteClick,
}: Props) {
  return (
    <aside className="w-72 shrink-0 border-r border-zinc-200 bg-white flex flex-col">
      <Header />
      <ListHead count={agents.length} onAddClick={onAddClick} />
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {agents.length === 0 ? (
          <div className="text-xs text-zinc-400 px-3 py-2">(no agents — click + New)</div>
        ) : (
          agents.map((a) => (
            <AgentRow
              key={a.id}
              agent={a}
              selected={a.id === selectedId}
              onSelect={() => onSelect(a.id)}
              onChange={onChange}
              onEdit={() => onEditClick(a)}
              onDelete={() => onDeleteClick(a)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function Header() {
  return (
    <div className="px-5 py-4 border-b border-zinc-200">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-sm">
          ▣
        </div>
        <div>
          <div className="text-sm font-semibold text-zinc-900 leading-tight">Agent Control</div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Operator</div>
        </div>
      </div>
    </div>
  );
}

function ListHead({ count, onAddClick }: { count: number; onAddClick: () => void }) {
  return (
    <div className="px-3 py-3 flex items-center justify-between">
      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
        Agents · {count}
      </span>
      <button
        onClick={onAddClick}
        className="text-[10px] px-2 py-1 rounded-md font-medium uppercase tracking-wider bg-zinc-900 text-white hover:bg-zinc-700"
        title="Add new agent"
      >
        + New
      </button>
    </div>
  );
}
