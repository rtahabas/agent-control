// Dashboard-level slash commands for the chat.
//
// The chat runs on the Claude Agent SDK (`query`), NOT the interactive CLI REPL,
// so CLI-internal commands (/btw, /model, /config, /clear-as-REPL) do not exist on
// this path. We implement dashboard-native commands here and expand custom project
// commands (.claude/commands/<name>.md) into a normal prompt.

export interface ParsedSlash {
  name: string;
  args: string;
}

/** Parse "/name rest of args". Returns null if not a well-formed slash command. */
export function parseSlash(text: string): ParsedSlash | null {
  if (!text.startsWith("/")) return null;
  const m = text.slice(1).match(/^([a-zA-Z0-9_-]+)\s*([\s\S]*)$/);
  if (!m) return null;
  return { name: m[1].toLowerCase(), args: m[2].trim() };
}

/** Built-in dashboard commands handled fully client-side. */
export const BUILTIN_COMMANDS = ["clear", "help", "model"] as const;

export function helpText(customNames: string[]): string {
  const lines = [
    "Dashboard slash commands:",
    "  /clear          — clear this chat",
    "  /help           — show this list",
    "  /model          — show the agent's current model",
    "  /model <name>   — set the model (e.g. opus[1m], sonnet, haiku)",
  ];
  if (customNames.length) {
    lines.push("", "Custom project commands (.claude/commands):");
    for (const n of customNames) lines.push(`  /${n}`);
  }
  lines.push(
    "",
    "Note: CLI-only commands (/btw, /config) are not available here — the dashboard",
    "chat runs on the Agent SDK, not the interactive CLI. For those, run `claude`",
    "directly in the agent's directory.",
  );
  return lines.join("\n");
}

/** List custom command names for an agent (.claude/commands/*.md). Safe: [] on error. */
export async function fetchCustomCommandNames(agentId: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/agents/${agentId}/commands`);
    if (!res.ok) return [];
    const d = (await res.json()) as { commands?: unknown };
    return Array.isArray(d.commands) ? (d.commands as string[]) : [];
  } catch {
    return [];
  }
}

/** Read a custom command's body. Returns null if it does not exist. */
export async function fetchCustomCommand(agentId: string, name: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/agents/${agentId}/commands?name=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const d = (await res.json()) as { content?: unknown };
    return typeof d.content === "string" ? d.content : null;
  } catch {
    return null;
  }
}

/** Read the agent's configured model (settings.json). null if unset/default. */
export async function fetchAgentModel(agentId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/agents/${agentId}/model`);
    if (!res.ok) return null;
    const d = (await res.json()) as { model?: unknown };
    return typeof d.model === "string" ? d.model : null;
  } catch {
    return null;
  }
}

/** Set the agent's model (writes settings.json). Returns ok + optional error. */
export async function setAgentModel(
  agentId: string,
  model: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/agents/${agentId}/model`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    if (res.ok) return { ok: true };
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: d.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
