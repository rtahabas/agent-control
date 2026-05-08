"use client";

import type { State } from "@/lib/api";
import { Skills } from "../overview/Skills";

interface Props {
  state: State | null;
  onSkillClick?: (name: string) => void;
  onNewSkill?: () => void;
  onConsolidate?: (name: string) => void;
}

export function SkillsPage({ state, onSkillClick, onNewSkill, onConsolidate }: Props) {
  if (!state) return <div className="p-8 text-sm text-zinc-400">Loading…</div>;
  return (
    <div className="p-6 max-w-6xl">
      <Skills
        skills={state.skills}
        timeline={state.skill_timeline}
        onSkillClick={onSkillClick}
        onNewClick={onNewSkill}
        onConsolidateClick={onConsolidate}
      />
    </div>
  );
}
