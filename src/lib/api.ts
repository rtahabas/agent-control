export type AgentStatus = "active" | "inactive";
export type ProjectStatus = "clean" | "dirty" | "untracked" | "n/a";
export type SkillCategory = "active" | "inactive" | "dead" | "external";

export interface Agent {
  id: string;
  name: string;
  path: string;
  status: AgentStatus;
  created_at: string;
  notes: string | null;
}

export interface Project {
  name: string;
  branch: string;
  status: ProjectStatus;
  last_commit: string;
  repo: string | null;
  open_prs: number | null;
  open_issues: number | null;
  is_git: boolean;
}

export interface SkillEntry {
  skill: string;
  invocations: number;
  last_invoked: string | null;
}

export interface Skills {
  installed_count: number;
  total_invocations: number;
  window_days: number;
  active: SkillEntry[];
  inactive: SkillEntry[];
  dead: SkillEntry[];
  external: SkillEntry[];
}

export interface Memory {
  total_files: number;
  total_lines: number;
  modified_last_7d: number;
  modified_last_30d: number;
  categories: { feedback: number; project: number; pending: number; other: number };
  indexes: string[];
}

export interface State {
  generated: string;
  projects: Project[];
  skills: Skills;
  sub_agents: string[];
  memory: Memory;
  pending: string[];
  hooks: { SessionStart: number; PreToolUse: number; PostToolUse: number; Stop: number };
}

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

export async function fetchState(agentId?: string | null): Promise<State> {
  const url = agentId ? `/api/state?agentId=${encodeURIComponent(agentId)}` : "/api/state";
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("state fetch failed: " + r.status);
  return r.json();
}

export interface SkillCatalogEntry {
  name: string;
  description: string;
}

export async function fetchSkillCatalog(): Promise<SkillCatalogEntry[]> {
  const r = await fetch("/api/skills/catalog", { cache: "no-store" });
  if (!r.ok) throw new Error("skill catalog fetch failed: " + r.status);
  const d = await r.json();
  return (d.skills as SkillCatalogEntry[]) ?? [];
}

export interface ScaffoldIdentity {
  role?: string;
  mission?: string;
  language?: string;
  personality?: string;
  human?: string;
}

export interface ScaffoldAgentBody {
  id?: string;
  name: string;
  path: string;
  notes?: string | null;
  identity: ScaffoldIdentity;
  skills: string[];
  template?: string;
}

export async function scaffoldAgent(body: ScaffoldAgentBody): Promise<Agent> {
  const r = await fetch("/api/agents/scaffold", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "scaffold failed");
  return data.agent as Agent;
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
