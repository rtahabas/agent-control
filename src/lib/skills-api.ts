export interface SkillCatalogEntry {
  name: string;
  description: string;
}

export async function fetchSkillCatalog(): Promise<SkillCatalogEntry[]> {
  const r = await fetch("/api/skills/catalog", { cache: "no-store" });
  if (!r.ok) throw new Error("skill catalog fetch failed: " + r.status);
  const d = await r.json();
  return (d.skills as SkillCatalogEntry[]) ?? [];
}
