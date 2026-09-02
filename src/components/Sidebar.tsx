"use client";

import type { Agent } from "@/lib/api";
import type { Tab } from "@/lib/tabs";
import { AgentRoster } from "@/components/AgentRoster";
import { ConversationList } from "@/components/ConversationList";
import { SidebarNav } from "@/components/SidebarNav";

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  selectedAgent: Agent | null;
  agents: Agent[];
  onSelectAgent: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({
  tab,
  onTabChange,
  selectedAgent,
  agents,
  onSelectAgent,
  collapsed,
  onToggle,
}: Props) {
  // Folded still has a job. Giving the conversation the width is worth nothing
  // if it costs the reason this console exists — seeing that some other agent
  // is blocked on a card. The strip keeps every agent and its status; only the
  // names and the navigation go.
  if (collapsed) {
    return (
      <aside className="w-11 shrink-0 border-r border-zinc-200 bg-white flex flex-col items-center py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Show sidebar"
          title="Show sidebar"
          className="w-7 h-7 shrink-0 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
        >
          ▸
        </button>
        <AgentRoster
          agents={agents}
          selectedId={selectedAgent?.id ?? null}
          onSelect={onSelectAgent}
          compact
        />
      </aside>
    );
  }

  return (
    <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-sm">
            ▣
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900 leading-tight">
              Agent Control
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Dashboard
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Hide sidebar"
            title="Hide sidebar"
            className="ml-auto shrink-0 w-7 h-7 rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition"
          >
            ◂
          </button>
        </div>
      </div>
      <SidebarNav tab={tab} onTabChange={onTabChange} />
      <AgentRoster
        agents={agents}
        selectedId={selectedAgent?.id ?? null}
        onSelect={onSelectAgent}
      />
      <ConversationList agentId={selectedAgent?.id ?? null} />
    </aside>
  );
}
