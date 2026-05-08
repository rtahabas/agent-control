"use client";

import type { State } from "@/lib/api";
import { SubAgents } from "../overview/Misc";

interface Props {
  state: State | null;
  onSubAgentClick?: (name: string) => void;
  onNewSubAgent?: () => void;
}

export function SubAgentsPage({ state, onSubAgentClick, onNewSubAgent }: Props) {
  if (!state) return <div className="p-8 text-sm text-zinc-400">Loading…</div>;
  return (
    <div className="p-6 max-w-6xl">
      <SubAgents
        agents={state.sub_agents}
        onSubAgentClick={onSubAgentClick}
        onNewClick={onNewSubAgent}
      />
    </div>
  );
}
