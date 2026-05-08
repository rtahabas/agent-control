"use client";

import type { State } from "@/lib/api";
import { HealthBar } from "../overview/Health";
import { Tokens } from "../overview/Tokens";
import { Projects } from "../overview/Projects";
import { Pending } from "../overview/Misc";

interface Props {
  state: State | null;
  agentId: string | null;
}

export function OverviewPage({ state, agentId }: Props) {
  if (!state) return <div className="p-8 text-sm text-zinc-400">Loading state…</div>;
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <HealthBar
        memory={state.memory}
        health={state.health}
        skills={state.skills}
      />
      {agentId && <Tokens agentId={agentId} />}
      <Projects projects={state.projects} />
      <Pending pending={state.pending} />
    </div>
  );
}
