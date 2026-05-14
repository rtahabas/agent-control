import fs from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter, buildSkillEntry } from "@/lib/skill-parse";

export {
  parseFrontmatter,
  buildSkillEntry,
  type SkillEntry,
  type SkillActivation,
  type SkillLifecycle,
} from "@/lib/skill-parse";

export async function readSkillsDir(dir: string) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillFile = path.join(dir, e.name, "SKILL.md");
    let raw: string;
    try {
      raw = await fs.readFile(skillFile, "utf8");
    } catch {
      continue;
    }
    out.push(buildSkillEntry(parseFrontmatter(raw), e.name));
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
