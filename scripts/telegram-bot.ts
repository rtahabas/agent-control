// Long-running Telegram polling daemon for the agent-control dashboard.
// Reads TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID from process.env (or .env.local
// when started via `npm run telegram`).
//
// Allowlist: only messages from TELEGRAM_CHAT_ID are accepted. Everything
// else is silently ignored. Only `/cmd` patterns are parsed; free text is
// treated as L3 data and dropped (prompt-injection guard).
//
// Commands fetch the running dashboard at localhost:DASHBOARD_PORT (3000 by
// default) — keep `npm run dev` going in another terminal.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

interface EnvShape {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DASHBOARD_PORT?: string;
  TELEGRAM_POLL_INTERVAL_MS?: string;
  AGENT_DIR?: string;
  CLAUDE_BIN?: string;
}

function loadDotEnv() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

loadDotEnv();
const env = process.env as EnvShape;

const TOKEN = env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT = env.TELEGRAM_CHAT_ID ?? "";
const PORT = env.DASHBOARD_PORT ?? "3000";
const POLL_MS = Number(env.TELEGRAM_POLL_INTERVAL_MS ?? "2000");

if (!TOKEN || !CHAT) {
  console.error("missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — set them in .env.local");
  process.exit(2);
}

const ALLOWED_CHAT_ID = String(CHAT);
const API = `https://api.telegram.org/bot${TOKEN}`;
const DASH = `http://localhost:${PORT}`;
const AGENT_DIR = env.AGENT_DIR ?? "/path/to/agents/Agent-One";
const CLAUDE_BIN = env.CLAUDE_BIN ?? "claude";
const ASK_TIMEOUT_MS = 90_000;
let offset = 0;
const startedAt = Date.now();

interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { username?: string };
    text?: string;
    date: number;
  };
}

async function send(text: string, parseHtml = true) {
  const chunks = chunk(text, 4000);
  for (const c of chunks) {
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ALLOWED_CHAT_ID,
        text: c,
        ...(parseHtml ? { parse_mode: "HTML" } : {}),
        disable_web_page_preview: true,
      }),
    }).catch((e) => console.error("send failed:", e));
  }
}

function chunk(s: string, n: number): string[] {
  if (s.length <= n) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

async function sendTyping() {
  await fetch(`${API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: ALLOWED_CHAT_ID, action: "typing" }),
  }).catch(() => { /* ignore */ });
}

async function askClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, ["-p", "--add-dir", AGENT_DIR, prompt], {
      timeout: ASK_TIMEOUT_MS,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `claude exited ${code}`));
    });
  });
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<T>;
}

interface Agent { id: string; name: string; status: string }

async function activeAgent(): Promise<Agent | null> {
  const d = await getJson<{ agents: Agent[] }>(`${DASH}/api/agents`);
  return d.agents.find((a) => a.status === "active") ?? d.agents[0] ?? null;
}

function fmtNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

const HELP = [
  "<b>Agent Control bot</b>",
  "",
  "Free text → forwarded to Claude with Agent-One context.",
  "Slash commands → quick read-only actions:",
  "",
  "/help — this list",
  "/agents — registered agents",
  "/status — active agent summary",
  "/activity [N] — last N events (default 5, max 20)",
  "/skills — active skills count + dead",
  "/who — bot identity + uptime",
].join("\n");

async function cmdAgents() {
  const d = await getJson<{ agents: Agent[] }>(`${DASH}/api/agents`);
  if (d.agents.length === 0) return "no agents registered";
  return d.agents.map((a) => `• <code>${a.id}</code> — ${a.name} (${a.status})`).join("\n");
}

async function cmdStatus() {
  const a = await activeAgent();
  if (!a) return "no active agent";
  const s = await getJson<{ skills: { installed_count: number; dead: unknown[] }; memory: { total_files: number; hot_lines: number; hot_cap: number }; sub_agents: string[]; pending: string[] }>(
    `${DASH}/api/state?agentId=${encodeURIComponent(a.id)}`
  );
  return [
    `<b>${a.name}</b> · <code>${a.id}</code>`,
    `skills <b>${s.skills.installed_count}</b> · dead ${s.skills.dead.length}`,
    `memory <b>${s.memory.total_files}</b> files · HOT ${s.memory.hot_lines}/${s.memory.hot_cap}`,
    `sub-agents ${s.sub_agents.length} · pending ${s.pending.length}`,
  ].join("\n");
}

interface ActivityEv { ts: string; kind: string; tool?: string; preview: string }

async function cmdActivity(arg: string) {
  const a = await activeAgent();
  if (!a) return "no active agent";
  const n = Math.max(1, Math.min(20, parseInt(arg, 10) || 5));
  const d = await getJson<{ events: ActivityEv[] }>(
    `${DASH}/api/agents/${encodeURIComponent(a.id)}/activity?limit=${n}`
  );
  if (d.events.length === 0) return "no recent events";
  return d.events
    .map((e) => {
      const tag = e.tool ? `[${e.tool}]` : `[${e.kind}]`;
      return `<code>${tag}</code> ${escape(e.preview).slice(0, 120)}`;
    })
    .join("\n");
}

async function cmdSkills() {
  const a = await activeAgent();
  if (!a) return "no active agent";
  const s = await getJson<{ skills: { installed_count: number; total_invocations: number; active: { skill: string }[]; dead: { skill: string }[] } }>(
    `${DASH}/api/state?agentId=${encodeURIComponent(a.id)}`
  );
  const active = s.skills.active.slice(0, 8).map((x) => x.skill).join(", ");
  return [
    `installed <b>${s.skills.installed_count}</b> · ${fmtNum(s.skills.total_invocations)} inv · dead ${s.skills.dead.length}`,
    active ? `active: <code>${active}</code>` : "no active skills",
  ].join("\n");
}

function cmdWho() {
  const up = Math.round((Date.now() - startedAt) / 1000);
  return `agent-control bot · uptime <b>${up}s</b> · port ${PORT}`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function handleCommand(cmd: string, arg: string): Promise<string> {
  try {
    switch (cmd) {
      case "help": case "start": return HELP;
      case "agents": return await cmdAgents();
      case "status": return await cmdStatus();
      case "activity": return await cmdActivity(arg);
      case "skills": return await cmdSkills();
      case "who": return cmdWho();
      default: return `unknown command: <code>/${escape(cmd)}</code>\n${HELP}`;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `error: <code>${escape(msg)}</code>\n(is the dashboard at ${DASH} running?)`;
  }
}

async function processUpdate(u: TgUpdate) {
  const m = u.message;
  if (!m || !m.text) return;
  const got = String(m.chat.id);
  if (got !== ALLOWED_CHAT_ID) {
    console.warn(`rejected chat <${got}> (allowed=<${ALLOWED_CHAT_ID}>)`);
    return;
  }
  const text = m.text.trim();
  const match = text.match(/^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/);
  if (match) {
    const reply = await handleCommand(match[1].toLowerCase(), (match[2] ?? "").trim());
    await send(reply);
    return;
  }
  // Free text → forward to Claude (allowlist already enforced above)
  void sendTyping();
  const heartbeat = setInterval(() => void sendTyping(), 4000);
  try {
    const reply = await askClaude(text);
    await send(reply || "(empty reply)", false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await send(`error from claude:\n<code>${escape(msg).slice(0, 1500)}</code>`);
  } finally {
    clearInterval(heartbeat);
  }
}

async function pollLoop() {
  console.log(`telegram-bot polling every ${POLL_MS}ms · dashboard ${DASH} · allowed chat <${ALLOWED_CHAT_ID}> (len=${ALLOWED_CHAT_ID.length})`);
  await send("<b>[bot online]</b> Try /help.");
  while (true) {
    try {
      const r = await fetch(`${API}/getUpdates?offset=${offset}&timeout=25`);
      const d = (await r.json()) as { ok: boolean; result?: TgUpdate[]; description?: string };
      if (!d.ok) {
        console.error("getUpdates error:", d.description);
        await new Promise((res) => setTimeout(res, 5000));
        continue;
      }
      for (const u of d.result ?? []) {
        offset = u.update_id + 1;
        await processUpdate(u);
      }
    } catch (e) {
      console.error("poll error:", e instanceof Error ? e.message : e);
      await new Promise((res) => setTimeout(res, 5000));
    }
    await new Promise((res) => setTimeout(res, POLL_MS));
  }
}

pollLoop().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
