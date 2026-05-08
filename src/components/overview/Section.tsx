"use client";

export function SectionHead({
  title,
  count,
}: {
  title: string;
  count?: string | number;
}) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">{title}</h2>
      {count !== undefined && <span className="text-xs text-zinc-400 mono">{count}</span>}
    </div>
  );
}
