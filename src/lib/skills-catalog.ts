import fs from "node:fs/promises";
import path from "node:path";

export interface SkillCatalogEntry {
  name: string;
  description: string;
}

function parseFrontmatter(raw: string): Record<string, string> {
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

export async function readSkillsCatalog(): Promise<SkillCatalogEntry[]> {
  const sourceDir = process.env.SKILLS_SOURCE_DIR;
  if (!sourceDir) return [];
  let entries;
  try {
    entries = await fs.readdir(sourceDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: SkillCatalogEntry[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const skillFile = path.join(sourceDir, e.name, "SKILL.md");
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
