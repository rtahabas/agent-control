"use client";

import type { Agent } from "@/lib/api";
import { NAV, type Tab } from "@/lib/tabs";

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  selectedAgent: Agent | null;
  agentCount: number;
}

export function Sidebar({ tab, onTabChange, selectedAgent, agentCount }: Props) {
  return (
    <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white flex flex-col">
      <div className="px-5 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-sm">
            ▣
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900 leading-tight">
              Agent Control
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Dashboard
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((s) => (
          <div key={s.heading} className="mb-4">
            <div className="px-5 mb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              {s.heading}
            </div>
            <ul className="space-y-0.5">
              {s.items.map((it) => (
                <li key={it.tab}>
                  <button
                    type="button"
                    onClick={() => onTabChange(it.tab)}
                    className={`w-full text-left px-5 py-1.5 text-sm transition ${
                      it.tab === tab
                        ? "bg-zinc-100 text-zinc-900 font-medium border-l-2 border-zinc-900 -ml-[2px] pl-[22px]"
                        : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {it.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-zinc-200 px-5 py-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
          Active agent
        </div>
        {selectedAgent ? (
          <div>
            <div className="text-sm font-medium text-zinc-900 truncate">
              {selectedAgent.name}
            </div>
            <div className="text-[11px] text-zinc-500 mono truncate">
              {selectedAgent.id}
            </div>
          </div>
        ) : (
          <div className="text-xs text-zinc-400">
            {agentCount === 0 ? "No agents — open Agents to add" : "Pick one in Agents"}
          </div>
        )}
      </div>
    </aside>
  );
}
