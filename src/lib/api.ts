export type {
  AgentStatus,
  ProjectStatus,
  SkillCategory,
  Agent,
  Project,
  SkillEntry,
  Skills,
  Memory,
  StaleDailyLog,
  Health,
  TimelinePoint,
  SkillTimeline,
  State,
} from "./state-types";

import type { Agent, AgentStatus, State } from "./state-types";

export async function fetchAgents(): Promise<Agent[]> {
  const r = await fetch("/api/agents", { cache: "no-store" });
  if (!r.ok) throw new Error("agents fetch failed: " + r.status);
  const d = await r.json();
  return d.agents as Agent[];
}

export async function toggleAgent(id: string): Promise<{ id: string; status: AgentStatus }> {
  const r = await fetch(`/api/agents/${encodeURIComponent(id)}/toggle`, { method: "POST" });
  if (!r.ok) throw new Error("toggle failed: " + r.status);
  return r.json();
}

export async function launchAgent(id: string): Promise<void> {
  const r = await fetch(`/api/agents/${encodeURIComponent(id)}/launch`, { method: "POST" });
  if (!r.ok) throw new Error("launch failed: " + r.status);
}

export interface CreateAgentBody {
  id?: string;
  name: string;
  path: string;
  notes?: string | null;
}

export async function createAgent(body: CreateAgentBody): Promise<Agent> {
  const r = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "create failed");
  return data.agent as Agent;
}

export interface UpdateAgentBody {
  name?: string;
  path?: string;
  notes?: string | null;
  status?: AgentStatus;
}

export async function updateAgent(id: string, patch: UpdateAgentBody): Promise<Agent> {
  const r = await fetch(`/api/agents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "update failed");
  return data.agent as Agent;
}

export async function deleteAgent(id: string): Promise<void> {
  const r = await fetch(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || "delete failed");
  }
}

export async function fetchState(
  agentId?: string | null,
  opts?: { fresh?: boolean },
): Promise<State> {
  const params = new URLSearchParams();
  if (agentId) params.set("agentId", agentId);
  if (opts?.fresh) params.set("fresh", "1");
  const qs = params.toString();
  const url = qs ? `/api/state?${qs}` : "/api/state";
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("state fetch failed: " + r.status);
  return r.json();
}

export interface PendingItem {
  raw: string;
  title: string;
  ref: string | null;
  desc: string;
}

export function parsePending(raw: string[]): PendingItem[] {
  const re = /^- \[([^\]]+)\]\(([^)]+)\)\s*—?\s*(.*)$/;
  return raw.map((line) => {
    const m = line.match(re);
    if (m) return { raw: line, title: m[1], ref: m[2], desc: m[3] };
    return { raw: line, title: line.replace(/^-\s*/, ""), ref: null, desc: "" };
  });
}
