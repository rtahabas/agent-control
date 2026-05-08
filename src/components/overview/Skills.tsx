"use client";

import type { SkillCategory, SkillEntry, Skills as SkillsState } from "@/lib/api";

const BAR: Record<SkillCategory, string> = {
  active: "bg-emerald-500",
  inactive: "bg-amber-500",
  dead: "bg-zinc-300",
  external: "bg-blue-500",
};

const BADGE: Record<SkillCategory, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-amber-50 text-amber-700 border-amber-200",
  dead: "bg-zinc-50 text-zinc-500 border-zinc-200",
  external: "bg-blue-50 text-blue-700 border-blue-200",
};

const ORDER: SkillCategory[] = ["active", "inactive", "external", "dead"];

const INSTALLED: Record<SkillCategory, boolean> = {
  active: true,
  inactive: true,
  dead: true,
  external: false,
};

interface Props {
  skills: SkillsState;
  onSkillClick?: (name: string) => void;
  onNewClick?: () => void;
}

export function Skills({ skills, onSkillClick, onNewClick }: Props) {
  const counts = {
    active: skills.active.length,
    inactive: skills.inactive.length,
    dead: skills.dead.length,
    external: skills.external.length,
  };
  const total = counts.active + counts.inactive + counts.dead + counts.external || 1;
  const all: Array<SkillEntry & { _c: SkillCategory }> = [
    ...skills.active.map((x) => ({ ...x, _c: "active" as const })),
    ...skills.external.map((x) => ({ ...x, _c: "external" as const })),
    ...skills.inactive.map((x) => ({ ...x, _c: "inactive" as const })),
    ...skills.dead.map((x) => ({ ...x, _c: "dead" as const })),
  ];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">Skills</h2>
          <span className="text-xs text-zinc-400 mono">{`${skills.installed_count} · ${skills.total_invocations} invocations · ${skills.window_days}d`}</span>
        </div>
        {onNewClick && (
          <button type="button" onClick={onNewClick} className="text-[11px] px-2 py-0.5 rounded border border-zinc-200 text-zinc-700 hover:bg-zinc-50">+ New skill</button>
        )}
      </div>
      <div className="bg-white rounded-lg border border-zinc-200 p-4 mb-3">
        <div className="flex h-2 rounded-full overflow-hidden bg-zinc-100 mb-3">
          {(Object.keys(counts) as SkillCategory[]).map((c) =>
            counts[c] > 0 ? (
              <div key={c} className={BAR[c]} style={{ width: `${(counts[c] / total) * 100}%` }} title={`${c}: ${counts[c]}`} />
            ) : null
          )}
        </div>
        <div className="flex flex-wrap gap-5 text-xs">
          {ORDER.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${BAR[c]}`} />
              <span className="font-semibold text-zinc-900 mono">{counts[c]}</span>
              <span className="text-zinc-500">{c}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Skill</th>
              <th className="text-right font-medium px-4 py-2.5">Inv</th>
              <th className="text-left font-medium px-4 py-2.5">Last invoked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {all.map((r, i) => {
              const installed = INSTALLED[r._c];
              const clickable = installed && onSkillClick;
              return (
                <tr key={`${r.skill}-${i}`}
                  onClick={clickable ? () => onSkillClick(r.skill) : undefined}
                  className={`${clickable ? "cursor-pointer hover:bg-zinc-50" : ""}`}>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${BADGE[r._c]}`}>{r._c}</span>
                  </td>
                  <td className="px-4 py-2.5 mono text-zinc-900">{r.skill}</td>
                  <td className={`px-4 py-2.5 text-right mono ${r.invocations ? "text-zinc-900 font-medium" : "text-zinc-400"}`}>{r.invocations}</td>
                  <td className="px-4 py-2.5 mono text-xs text-zinc-500">{r.last_invoked || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
