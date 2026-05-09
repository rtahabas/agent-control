import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SessionLog } from "@/lib/memory-scan";

const execFileP = promisify(execFile);

export const STALE_DAYS = 30;
export const URGENT_STALE_DAYS = 60;
export const BLOATED_LINES = 100;
export const HOT_LINES_LIMIT = 100;

export function tokens(bytes: number) { return Math.round(bytes / 4); }

export function ageMs(lastSeen: string | null, now: number) {
  if (!lastSeen) return Infinity;
  return now - new Date(lastSeen + "T00:00:00Z").getTime();
}

export async function statMemo(memDir: string, name: string) {
  const fp = path.join(memDir, name);
  try {
    const s = await fs.stat(fp);
    const txt = await fs.readFile(fp, "utf-8");
    return { size: s.size, mtimeMs: s.mtimeMs, lines: txt ? txt.split("\n").length : 0 };
  } catch {
    return null;
  }
}

export function computeRefs(name: string, logs: SessionLog[]) {
  let lastSeen: string | null = null;
  let count = 0;
  for (const log of logs) {
    if (log.content.includes(name)) {
      count++;
      if (!lastSeen || log.date > lastSeen) lastSeen = log.date;
    }
  }
  return { lastSeen, count };
}

export async function listMd(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

// Returns filename → latest commit ISO date (YYYY-MM-DD) using one git invocation.
// Filenames without commits are absent from the map.
export async function gitLastCommitMap(repoDir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const { stdout } = await execFileP(
      "git",
      ["log", "--pretty=format:@@@%ai", "--name-only", "--", "*.md"],
      { cwd: repoDir, maxBuffer: 16 * 1024 * 1024 }
    );
    let date: string | null = null;
    for (const line of stdout.split("\n")) {
      if (line.startsWith("@@@")) {
        date = line.slice(3, 13);
      } else if (line && date && !out.has(line)) {
        out.set(line, date);
      }
    }
  } catch { /* ignore — fallback to no commit data */ }
  return out;
}
