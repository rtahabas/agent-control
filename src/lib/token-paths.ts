import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

function encodePath(p: string): string {
  return p.replace(/\//g, "-");
}

export async function listSessionDirs(agentPath: string): Promise<string[]> {
  const root = path.join(os.homedir(), ".claude", "projects");
  const prefix = encodePath(agentPath);
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(
      (e) =>
        e.isDirectory() &&
        (e.name === prefix || e.name.startsWith(`${prefix}-`))
    )
    .map((e) => path.join(root, e.name));
}

export async function listJsonl(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}
