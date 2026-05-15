import { readSkillsDir, type SkillEntry } from "./skill-fs";
import { getDisabledSkills } from "./skill-state";

export type SkillCatalogEntry = SkillEntry;

export async function readSkillsCatalog(): Promise<SkillCatalogEntry[]> {
  const sourceDir = process.env.SKILLS_SOURCE_DIR;
  if (!sourceDir) return [];
  const entries = await readSkillsDir(sourceDir);
  const disabled = getDisabledSkills();
  return entries.map((e) => ({ ...e, enabled: !disabled.has(e.name) }));
}
