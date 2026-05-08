import fs from "node:fs/promises";
import path from "node:path";

export interface SkillEntry {
  name: string;
  description: string;
}

export function parseFrontmatter(raw: string): Record<string, string> {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (k) out[k] = v;
  }
  return out;
}

export async function readSkillsDir(dir: string): Promise<SkillEntry[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: SkillEntry[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillFile = path.join(dir, e.name, "SKILL.md");
    let raw: string;
    try {
      raw = await fs.readFile(skillFile, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(raw);
    out.push({
      name: fm.name || e.name,
      description: fm.description || "",
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
