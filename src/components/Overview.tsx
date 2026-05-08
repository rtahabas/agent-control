"use client";

import type { State } from "@/lib/api";
import { Projects } from "./overview/Projects";
import { Skills } from "./overview/Skills";
import { Memory } from "./overview/Memory";
import { SubAgents, Hooks, Pending } from "./overview/Misc";

export function Overview({
  state,
  onFileClick,
  onNewMemory,
  onBrowseMemory,
}: {
  state: State | null;
  onFileClick?: (file: string) => void;
  onNewMemory?: () => void;
  onBrowseMemory?: () => void;
}) {
  if (!state) return <div className="p-8 text-sm text-zinc-400">Loading state…</div>;
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <Projects projects={state.projects} />
      <Skills skills={state.skills} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Memory
          memory={state.memory}
          onFileClick={onFileClick}
          onNewClick={onNewMemory}
          onBrowseClick={onBrowseMemory}
        />
        <SubAgents agents={state.sub_agents} />
        <Hooks hooks={state.hooks} />
      </div>
      <Pending pending={state.pending} />
    </div>
  );
}
