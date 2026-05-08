import { readSkillsDir, type SkillEntry } from "./skill-fs";

export type SkillCatalogEntry = SkillEntry;

export async function readSkillsCatalog(): Promise<SkillCatalogEntry[]> {
  const sourceDir = process.env.SKILLS_SOURCE_DIR;
  if (!sourceDir) return [];
  return readSkillsDir(sourceDir);
}
