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

async function isDirOrSymlinkToDir(
  parent: string,
  entry: { name: string; isDirectory: () => boolean; isSymbolicLink: () => boolean },
): Promise<boolean> {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;
  // Dirent#isDirectory() is false for symlinks even when the target is a dir;
  // resolve the link to keep "skill dir" lookups working through symlinks
  // (used when skill repos live outside the project tree).
  try {
    const stat = await fs.stat(path.join(parent, entry.name));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function readSkillsDir(dir: string) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!(await isDirOrSymlinkToDir(dir, e))) continue;
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
