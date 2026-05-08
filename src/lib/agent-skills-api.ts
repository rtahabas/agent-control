export interface AgentSkill {
  name: string;
  description: string;
}

function url(agentId: string, name?: string): string {
  const base = `/api/agents/${encodeURIComponent(agentId)}/skills`;
  return name ? `${base}/${encodeURIComponent(name)}` : base;
}

export async function fetchAgentSkills(agentId: string): Promise<AgentSkill[]> {
  const r = await fetch(url(agentId), { cache: "no-store" });
  if (!r.ok) throw new Error("agent skills fetch failed: " + r.status);
  const d = await r.json();
  return (d.skills as AgentSkill[]) ?? [];
}

export async function fetchAgentSkill(agentId: string, name: string): Promise<string> {
  const r = await fetch(url(agentId, name), { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "skill fetch failed");
  return d.content as string;
}

export async function saveAgentSkill(agentId: string, name: string, content: string): Promise<void> {
  const r = await fetch(url(agentId, name), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "skill save failed");
}

export async function createAgentSkill(agentId: string, name: string, content: string): Promise<void> {
  const r = await fetch(url(agentId, name), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "skill create failed");
}

export async function deleteAgentSkill(agentId: string, name: string): Promise<void> {
  const r = await fetch(url(agentId, name), { method: "DELETE" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "skill delete failed");
}
