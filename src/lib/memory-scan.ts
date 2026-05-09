import fs from "node:fs/promises";
import path from "node:path";

export interface SessionLog { name: string; date: string; content: string }
export interface IndexEntry { index: string; entry: string; target: string }

export async function readClaudeMdImports(agentPath: string): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const txt = await fs.readFile(path.join(agentPath, "CLAUDE.md"), "utf-8");
    const re = /@memory\/([A-Za-z0-9_./-]+\.md)/g;
    let m;
    while ((m = re.exec(txt)) !== null) {
      const target = m[1];
      if (!target.includes("/")) out.add(target);
    }
  } catch { /* ignore */ }
  return out;
}

export async function parseIndexEntries(memDir: string): Promise<IndexEntry[]> {
  const out: IndexEntry[] = [];
  let entries: string[] = [];
  try {
    const list = await fs.readdir(memDir, { withFileTypes: true });
    entries = list
      .filter((e) => e.isFile() && /^INDEX[-_].*\.md$/.test(e.name))
      .map((e) => e.name);
  } catch {
    return out;
  }
  const linkRe = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
  for (const idx of entries) {
    let txt = "";
    try { txt = await fs.readFile(path.join(memDir, idx), "utf-8"); } catch { continue; }
    let m;
    while ((m = linkRe.exec(txt)) !== null) {
      const target = m[2];
      if (target.includes("/") || target.startsWith("http")) continue;
      out.push({ index: idx, entry: m[1], target });
    }
  }
  return out;
}

export async function readSessionLogs(agentPath: string): Promise<SessionLog[]> {
  const dir = path.join(agentPath, "memory", "memory");
  const out: SessionLog[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".md")) continue;
      const m = e.name.match(/^(\d{4}-\d{2}-\d{2})/);
      if (!m) continue;
      try {
        const content = await fs.readFile(path.join(dir, e.name), "utf-8");
        out.push({ name: e.name, date: m[1], content });
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }
  return out;
}
