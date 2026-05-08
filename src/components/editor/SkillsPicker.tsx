"use client";

import { useEffect, useState } from "react";
import { fetchSkillCatalog, type SkillCatalogEntry } from "@/lib/skills-api";

interface Props {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}

export function SkillsPicker({ selected, onChange, disabled }: Props) {
  const [catalog, setCatalog] = useState<SkillCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSkillCatalog()
      .then((c) => setCatalog(c))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(next);
  };

  if (loading) return <div className="text-xs text-zinc-500 px-2 py-3">Loading skills…</div>;
  if (error) return <div className="text-xs text-rose-600 px-2 py-3">Skills load failed: {error}</div>;
  if (catalog.length === 0) return <div className="text-xs text-zinc-500 px-2 py-3">No skills in catalog.</div>;

  return (
    <div className="border border-zinc-200 rounded-lg max-h-56 overflow-y-auto bg-white">
      {catalog.map((s) => (
        <label
          key={s.name}
          className="flex items-start gap-2 px-3 py-2 border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.has(s.name)}
            onChange={() => toggle(s.name)}
            disabled={disabled}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-mono text-zinc-900">{s.name}</div>
            {s.description && (
              <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{s.description}</div>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}
