"use client";

import { useCallback, useEffect, useState } from "react";
import type { State } from "@/lib/api";
import { fetchSkillCatalog, toggleSkill } from "@/lib/skills-api";
import { Skills } from "../overview/Skills";

interface Props {
  state: State | null;
  onSkillClick?: (name: string) => void;
  onNewSkill?: () => void;
  onConsolidate?: (name: string) => void;
}

export function SkillsPage({ state, onSkillClick, onNewSkill, onConsolidate }: Props) {
  const [enabledMap, setEnabledMap] = useState<Map<string, boolean>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSkillCatalog()
      .then((catalog) => {
        if (!alive) return;
        const next = new Map<string, boolean>();
        for (const s of catalog) next.set(s.name, s.enabled !== false);
        setEnabledMap(next);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  const handleToggle = useCallback(async (name: string) => {
    const prev = enabledMap.get(name);
    if (prev === undefined) return;
    setEnabledMap((m) => new Map(m).set(name, !prev));
    try {
      const { enabled } = await toggleSkill(name);
      setEnabledMap((m) => new Map(m).set(name, enabled));
    } catch (e) {
      setEnabledMap((m) => new Map(m).set(name, prev));
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [enabledMap]);

  if (!state) return <div className="p-8 text-sm text-zinc-400">Loading…</div>;
  return (
    <div className="p-6 max-w-6xl">
      {error && (
        <div className="mb-3 text-xs px-3 py-2 rounded border bg-rose-50 border-rose-200 text-rose-700">
          {error}
        </div>
      )}
      <Skills
        skills={state.skills}
        timeline={state.skill_timeline}
        onSkillClick={onSkillClick}
        onNewClick={onNewSkill}
        onConsolidateClick={onConsolidate}
        enabledMap={enabledMap}
        onToggleEnabled={handleToggle}
      />
    </div>
  );
}
