"use client";

interface Props {
  skillName: string;
  enabled: boolean | undefined;
  onToggle: (name: string) => void;
}

export function SkillToggle({ skillName, enabled, onToggle }: Props) {
  if (enabled === undefined) {
    return <span className="text-zinc-300 text-xs">—</span>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(skillName);
      }}
      aria-pressed={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} ${skillName}`}
      className={`inline-flex w-9 h-5 rounded-full transition relative ${enabled ? "bg-emerald-500" : "bg-zinc-300"}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-zinc-50 transition ${enabled ? "left-4" : "left-0.5"}`}
      />
    </button>
  );
}
