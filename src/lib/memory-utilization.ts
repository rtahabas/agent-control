import path from "node:path";
import { readClaudeMdImports, parseIndexEntries, readSessionLogs, type SessionLog } from "@/lib/memory-scan";
import {
  STALE_DAYS, URGENT_STALE_DAYS, BLOATED_LINES, HOT_LINES_LIMIT,
  tokens, ageMs, statMemo, computeRefs, listMd, gitLastCommitMap,
} from "@/lib/memory-stat-helpers";

export interface MemoStat {
  file: string;
  lines: number;
  bytes: number;
  tokens: number;
  mtime: string;
  hot: boolean;
  indexed: boolean;
  bloated: boolean;
  orphan: boolean;
  stale: boolean;
  urgent: boolean;
  last_seen: string | null;
  ref_count: number;
}

export interface IndexDrift { index: string; entry: string; target: string }

export interface MemoryUtilization {
  files: MemoStat[];
  hot_tokens: number;
  total_tokens: number;
  memory_md_lines: number;
  hot_lines_limit: number;
  counts: { total: number; hot: number; bloated: number; orphan: number; stale: number; urgent: number };
  drift: IndexDrift[];
  stale_threshold_days: number;
  urgent_threshold_days: number;
  bloated_line_threshold: number;
}

async function buildMemoStat(
  memDir: string, name: string, hot: Set<string>, indexed: Set<string>,
  logs: SessionLog[], gitDates: Map<string, string>, now: number
): Promise<MemoStat | null> {
  const s = await statMemo(memDir, name);
  if (!s) return null;
  const refs = computeRefs(name, logs);
  const isHot = hot.has(name);
  // last activity = git last-commit date (reliable). Fallback: daily-log mention.
  const lastSeen = gitDates.get(name) ?? refs.lastSeen;
  const age = ageMs(lastSeen, now);
  return {
    file: name,
    lines: s.lines,
    bytes: s.size,
    tokens: tokens(s.size),
    mtime: new Date(s.mtimeMs).toISOString(),
    hot: isHot,
    indexed: indexed.has(name),
    bloated: s.lines > BLOATED_LINES,
    orphan: !isHot && !indexed.has(name),
    stale: !isHot && age > STALE_DAYS * 86400 * 1000,
    urgent: !isHot && age > URGENT_STALE_DAYS * 86400 * 1000,
    last_seen: lastSeen,
    ref_count: refs.count,
  };
}

export async function computeMemoryUtilization(agentPath: string): Promise<MemoryUtilization> {
  const memDir = path.join(agentPath, "memory");
  const [hot, indexEntries, logs, dirEntries, gitDates] = await Promise.all([
    readClaudeMdImports(agentPath),
    parseIndexEntries(memDir),
    readSessionLogs(agentPath),
    listMd(memDir),
    gitLastCommitMap(memDir),
  ]);

  const indexed = new Set(indexEntries.map((e) => e.target));
  const existing = new Set(dirEntries);
  const drift = indexEntries.filter((e) => !existing.has(e.target));

  const now = Date.now();
  const files: MemoStat[] = [];
  for (const name of dirEntries) {
    const memo = await buildMemoStat(memDir, name, hot, indexed, logs, gitDates, now);
    if (memo) files.push(memo);
  }
  files.sort((a, b) => (a.hot !== b.hot ? (a.hot ? -1 : 1) : b.tokens - a.tokens));

  let hotTokens = 0;
  let totalTokens = 0;
  let memoryMdLines = 0;
  const counts = { total: files.length, hot: 0, bloated: 0, orphan: 0, stale: 0, urgent: 0 };
  for (const f of files) {
    totalTokens += f.tokens;
    if (f.file === "MEMORY.md") memoryMdLines = f.lines;
    if (f.hot) { hotTokens += f.tokens; counts.hot++; }
    if (f.bloated) counts.bloated++;
    if (f.orphan) counts.orphan++;
    if (f.stale) counts.stale++;
    if (f.urgent) counts.urgent++;
  }

  return {
    files,
    hot_tokens: hotTokens,
    total_tokens: totalTokens,
    memory_md_lines: memoryMdLines,
    hot_lines_limit: HOT_LINES_LIMIT,
    counts,
    drift,
    stale_threshold_days: STALE_DAYS,
    urgent_threshold_days: URGENT_STALE_DAYS,
    bloated_line_threshold: BLOATED_LINES,
  };
}
