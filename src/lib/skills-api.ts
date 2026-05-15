export interface SkillCatalogEntry {
  name: string;
  description: string;
  enabled?: boolean;
}

export async function fetchSkillCatalog(): Promise<SkillCatalogEntry[]> {
  const r = await fetch("/api/skills/catalog", { cache: "no-store" });
  if (!r.ok) throw new Error("skill catalog fetch failed: " + r.status);
  const d = await r.json();
  return (d.skills as SkillCatalogEntry[]) ?? [];
}

export async function toggleSkill(name: string): Promise<{ name: string; enabled: boolean }> {
  const r = await fetch(`/api/skills/${encodeURIComponent(name)}/toggle`, {
    method: "POST",
    cache: "no-store",
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || `toggle failed: ${r.status}`);
  }
  return r.json();
}
