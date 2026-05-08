import path from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { listSessionDirs, listJsonl } from "./token-paths";

export type ActivityKind = "user" | "assistant" | "tool" | "error";

export interface ActivityEvent {
  ts: string;
  kind: ActivityKind;
  preview: string;
  tool?: string;
  session: string;
}

interface RawLine {
  type?: string;
  timestamp?: string;
  message?: {
    content?: unknown;
    model?: string;
  };
}

function clip(s: string, n = 140): string {
  s = s.replace(/\s+/g, " ").trim();
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function previewContent(c: unknown): string {
  if (typeof c === "string") return clip(c);
  if (Array.isArray(c)) {
    for (const b of c) {
      if (b && typeof b === "object") {
        const block = b as Record<string, unknown>;
        if (block.type === "text" && typeof block.text === "string") return clip(block.text);
      }
    }
    return "";
  }
  return "";
}

function extractEvents(line: string, sessionId: string): ActivityEvent[] {
  let raw: RawLine;
  try { raw = JSON.parse(line); } catch { return []; }
  if (!raw.timestamp || !raw.type) return [];
  const ts = raw.timestamp;

  if (raw.type === "user") {
    const preview = previewContent(raw.message?.content);
    if (!preview) return [];
    return [{ ts, kind: "user", preview, session: sessionId }];
  }

  if (raw.type === "assistant") {
    const out: ActivityEvent[] = [];
    const content = raw.message?.content;
    if (Array.isArray(content)) {
      for (const b of content) {
        if (!b || typeof b !== "object") continue;
        const block = b as Record<string, unknown>;
        if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
          out.push({ ts, kind: "assistant", preview: clip(block.text), session: sessionId });
        } else if (block.type === "tool_use") {
          const name = typeof block.name === "string" ? block.name : "tool";
          const input = block.input as Record<string, unknown> | undefined;
          const summary = describeToolInput(name, input);
          out.push({ ts, kind: "tool", tool: name, preview: summary, session: sessionId });
        }
      }
    }
    return out;
  }

  return [];
}

function describeToolInput(name: string, input?: Record<string, unknown>): string {
  if (!input) return "";
  if (typeof input.file_path === "string") return clip(input.file_path);
  if (typeof input.command === "string") return clip(input.command);
  if (typeof input.path === "string") return clip(input.path);
  if (typeof input.url === "string") return clip(input.url);
  if (typeof input.pattern === "string") return clip(input.pattern);
  if (typeof input.query === "string") return clip(input.query);
  if (typeof input.description === "string") return clip(input.description);
  if (typeof input.subject === "string") return clip(input.subject);
  return name;
}

export interface ActivityResult {
  agent_path: string;
  generated: string;
  events: ActivityEvent[];
  session_dirs: number;
  files_scanned: number;
}

export async function collectActivity(
  agentPath: string,
  limit = 100
): Promise<ActivityResult> {
  const dirs = await listSessionDirs(agentPath);
  const events: ActivityEvent[] = [];
  let filesScanned = 0;
  for (const d of dirs) {
    const files = await listJsonl(d);
    for (const f of files) {
      filesScanned++;
      const sessionId = path.basename(f, ".jsonl").slice(0, 8);
      const stream = createReadStream(f, { encoding: "utf8" });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line) continue;
        for (const e of extractEvents(line, sessionId)) events.push(e);
      }
    }
  }
  events.sort((a, b) => b.ts.localeCompare(a.ts));
  return {
    agent_path: agentPath,
    generated: new Date().toISOString(),
    events: events.slice(0, limit),
    session_dirs: dirs.length,
    files_scanned: filesScanned,
  };
}
