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
  onOpenChat: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({
  tab,
  onTabChange,
  selectedAgent,
  agents,
  onSelectAgent,
  onOpenChat,
  collapsed,
  onToggle,
}: Props) {
  // One rail whose width animates, not two that swap.
  //
  // Rendering a different <aside> per state replaced the element outright, so
  // the fold arrived in a single frame. Here the width transitions and the two
  // layouts cross-fade over it. Both keep a fixed width of their own — the
  // expanded column stays 15rem while the container shrinks past it — because
  // letting the content reflow inside a shrinking box squashes every label on
  // the way down, which reads worse than no animation at all.
  //
  // Folded still has a job: the agent strip stays, so an agent blocked on a
  // card is visible from a rail that is 44px wide.
  return (
    <aside
      className={`relative shrink-0 overflow-hidden
        transition-[width] duration-200 ease-out motion-reduce:transition-none
        ${collapsed ? "w-11" : "w-60"}`}
    >
      <div
        aria-hidden={collapsed}
        className={`absolute inset-y-0 left-0 w-60 flex flex-col
          transition-opacity duration-150 motion-reduce:transition-none
          ${collapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        <div className="px-5 py-4">
          {/* Wordmark, no badge. The glyph in a coloured box was decoration, and
              it spent the accent on something that is never selected — which is
              the only thing the accent is supposed to mean. */}
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 text-[15px] font-semibold text-zinc-900 leading-tight tracking-tight">
              Agent Control
            </div>
            <div className="ml-auto">
              <ToggleButton onClick={onToggle} label="Hide sidebar" />
            </div>
          </div>
        </div>
        {/* No agent list here any more: it is one line of information that was
            taking a block of the column, and it now lives in the top bar as a
            picker, next to the conversation it applies to. The folded rail keeps
            its strip, which is all that rail has room to say. */}
        <SidebarNav tab={tab} onTabChange={onTabChange} />
        <ConversationList agentId={selectedAgent?.id ?? null} onOpened={onOpenChat} />
      </div>

      <div
        aria-hidden={!collapsed}
        className={`absolute inset-y-0 left-0 w-11 flex flex-col items-center py-3
          transition-opacity duration-150 motion-reduce:transition-none
          ${collapsed ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <ToggleButton onClick={onToggle} label="Show sidebar" />
        <AgentRoster
          agents={agents}
          selectedId={selectedAgent?.id ?? null}
          onSelect={onSelectAgent}
          compact
        />
      </div>
    </aside>
  );
}

/**
 * Fold control.
 *
 * Drawn rather than typed: ◂ and ▸ are geometric characters, not icons — their
 * weight and baseline shift with whatever font resolves them, so they never sit
 * right next to text. The same panel mark serves both directions; a mirrored
 * arrow would be one more thing to keep in sync with the state.
 */
function ToggleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
        <path d="M6.25 2.75v10.5" />
      </svg>
    </button>
  );
}
