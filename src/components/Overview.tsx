"use client";

import type { State } from "@/lib/api";
import { Projects } from "./overview/Projects";
import { Skills } from "./overview/Skills";
import { Memory } from "./overview/Memory";
import { SubAgents, Hooks, Pending } from "./overview/Misc";
import { HealthBar } from "./overview/Health";

export function Overview({
  state,
  onFileClick,
  onNewMemory,
  onBrowseMemory,
  onSkillClick,
  onNewSkill,
  onSubAgentClick,
  onNewSubAgent,
  onManageHooks,
  onSkillConsolidate,
}: {
  state: State | null;
  onFileClick?: (file: string) => void;
  onNewMemory?: () => void;
  onBrowseMemory?: () => void;
  onSkillClick?: (name: string) => void;
  onNewSkill?: () => void;
  onSubAgentClick?: (name: string) => void;
  onNewSubAgent?: () => void;
  onManageHooks?: () => void;
  onSkillConsolidate?: (name: string) => void;
}) {
  if (!state) return <div className="p-8 text-sm text-zinc-400">Loading state…</div>;
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <HealthBar
        memory={state.memory}
        health={state.health}
        skills={state.skills}
      />
      <Projects projects={state.projects} />
      <div id="overview-skills">
        <Skills
          skills={state.skills}
          timeline={state.skill_timeline}
          onSkillClick={onSkillClick}
          onNewClick={onNewSkill}
          onConsolidateClick={onSkillConsolidate}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Memory
          memory={state.memory}
          onFileClick={onFileClick}
          onNewClick={onNewMemory}
          onBrowseClick={onBrowseMemory}
        />
        <SubAgents
          agents={state.sub_agents}
          onSubAgentClick={onSubAgentClick}
          onNewClick={onNewSubAgent}
        />
        <Hooks hooks={state.hooks} onManageClick={onManageHooks} />
      </div>
      <Pending pending={state.pending} />
    </div>
  );
}
