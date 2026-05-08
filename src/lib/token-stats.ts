import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { costFor, type UsageBreakdown } from "./claude-pricing";
import { listSessionDirs, listJsonl } from "./token-paths";

export interface DayBucket {
  date: string;
  input: number;
  output: number;
  cache_write: number;
  cache_read: number;
  cost_usd: number;
  events: number;
}

export interface ModelBucket {
  model: string;
  input: number;
  output: number;
  cache_write: number;
  cache_read: number;
  cost_usd: number;
  events: number;
}

export interface TokenStats {
  agent_path: string;
  window_days: number;
  generated: string;
  total: { input: number; output: number; cache_write: number; cache_read: number; cost_usd: number; events: number };
  daily: DayBucket[];
  by_model: ModelBucket[];
  session_dirs: number;
  files_scanned: number;
}

interface LineEvent {
  type?: string;
  timestamp?: string;
  message?: { model?: string; usage?: Record<string, unknown> };
}

function readUsage(u: Record<string, unknown> | undefined): UsageBreakdown {
  if (!u) return { input: 0, output: 0, cache_write_5m: 0, cache_write_1h: 0, cache_read: 0 };
  const cw = u.cache_creation as { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number } | undefined;
  return {
    input: Number(u.input_tokens) || 0,
    output: Number(u.output_tokens) || 0,
    cache_write_5m: Number(cw?.ephemeral_5m_input_tokens) || 0,
    cache_write_1h: Number(cw?.ephemeral_1h_input_tokens) || 0,
    cache_read: Number(u.cache_read_input_tokens) || 0,
  };
}

export async function collectTokenStats(agentPath: string, windowDays = 7): Promise<TokenStats> {
  const cutoff = new Date(Date.now() - windowDays * 86400 * 1000).toISOString().slice(0, 10);
  const dirs = await listSessionDirs(agentPath);

  const daily = new Map<string, DayBucket>();
  const byModel = new Map<string, ModelBucket>();
  const total = { input: 0, output: 0, cache_write: 0, cache_read: 0, cost_usd: 0, events: 0 };
  let filesScanned = 0;

  for (const d of dirs) {
    const files = await listJsonl(d);
    for (const f of files) {
      filesScanned++;
      const stream = createReadStream(f, { encoding: "utf8" });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line) continue;
        let ev: LineEvent;
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type !== "assistant") continue;
        const usage = ev.message?.usage as Record<string, unknown> | undefined;
        if (!usage) continue;
        const ts = (ev.timestamp || "").slice(0, 10);
        if (!ts || ts < cutoff) continue;
        const u = readUsage(usage);
        const cost = costFor(ev.message?.model, u);
        const cw = u.cache_write_5m + u.cache_write_1h;

        total.input += u.input;
        total.output += u.output;
        total.cache_write += cw;
        total.cache_read += u.cache_read;
        total.cost_usd += cost;
        total.events += 1;

        const day = daily.get(ts) ?? { date: ts, input: 0, output: 0, cache_write: 0, cache_read: 0, cost_usd: 0, events: 0 };
        day.input += u.input;
        day.output += u.output;
        day.cache_write += cw;
        day.cache_read += u.cache_read;
        day.cost_usd += cost;
        day.events += 1;
        daily.set(ts, day);

        const model = ev.message?.model || "unknown";
        const m = byModel.get(model) ?? { model, input: 0, output: 0, cache_write: 0, cache_read: 0, cost_usd: 0, events: 0 };
        m.input += u.input;
        m.output += u.output;
        m.cache_write += cw;
        m.cache_read += u.cache_read;
        m.cost_usd += cost;
        m.events += 1;
        byModel.set(model, m);
      }
    }
  }

  return {
    agent_path: agentPath,
    window_days: windowDays,
    generated: new Date().toISOString(),
    total,
    daily: Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date)),
    by_model: Array.from(byModel.values()).sort((a, b) => b.cost_usd - a.cost_usd),
    session_dirs: dirs.length,
    files_scanned: filesScanned,
  };
}
