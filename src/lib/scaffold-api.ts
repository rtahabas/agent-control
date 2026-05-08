import type { Agent } from "./api";

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
