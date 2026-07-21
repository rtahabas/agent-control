"use client";

import type { Agent } from "@/lib/api";
import { useAgentAttention } from "@/lib/use-agent-attention";
import { STATUS_LABEL, statusOf, type AgentStatus } from "@/lib/agent-attention";

/**
 * Every agent and what it is doing, so one blocked on a permission card is
 * visible from whichever agent you are currently reading.
 */
export function AgentRoster({
  agents,
  selectedId,
  onSelect,
}: {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const attention = useAgentAttention();

  return (
    <div className="border-t border-zinc-200 px-3 py-3">
      <div className="px-2 text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5">
        Agents
      </div>
      {agents.length === 0 ? (
        <div className="px-2 text-xs text-zinc-400">No agents — open Agents to add</div>
      ) : (
        <ul className="space-y-0.5">
          {agents.map((a) => {
            const status = statusOf(attention[a.id]);
            const selected = a.id === selectedId;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onSelect(a.id)}
                  title={`${a.name} — ${STATUS_LABEL[status]}`}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition ${
                    selected ? "bg-zinc-100" : "hover:bg-zinc-50"
                  }`}
                >
                  <StatusDot status={status} />
                  <span
                    className={`text-sm truncate flex-1 ${
                      selected ? "text-zinc-900 font-medium" : "text-zinc-700"
                    }`}
                  >
                    {a.name}
                  </span>
                  {status !== "idle" && (
                    <span
                      className={`text-[10px] shrink-0 ${
                        status === "waiting" ? "text-amber-700" : "text-zinc-400"
                      }`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: AgentStatus }) {
  // Amber for blocked, because that one is not going anywhere until you act.
  const tone =
    status === "waiting"
      ? "bg-amber-500"
      : status === "working"
        ? "bg-emerald-500 animate-pulse"
        : "bg-zinc-300";
  return <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone}`} />;
}
