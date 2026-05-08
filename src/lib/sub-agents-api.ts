export interface SubAgentSummary {
  name: string;
  description: string;
  model: string;
  isolation: string;
}

function url(agentId: string, name?: string): string {
  const base = `/api/agents/${encodeURIComponent(agentId)}/sub-agents`;
  return name ? `${base}/${encodeURIComponent(name)}` : base;
}

export async function fetchSubAgents(agentId: string): Promise<SubAgentSummary[]> {
  const r = await fetch(url(agentId), { cache: "no-store" });
  if (!r.ok) throw new Error("sub-agents fetch failed: " + r.status);
  const d = await r.json();
  return (d.subAgents as SubAgentSummary[]) ?? [];
}

export async function fetchSubAgent(agentId: string, name: string): Promise<string> {
  const r = await fetch(url(agentId, name), { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "sub-agent fetch failed");
  return d.content as string;
}

export async function saveSubAgent(agentId: string, name: string, content: string): Promise<void> {
  const r = await fetch(url(agentId, name), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "sub-agent save failed");
}

export async function createSubAgent(agentId: string, name: string, content: string): Promise<void> {
  const r = await fetch(url(agentId, name), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "sub-agent create failed");
}

export async function deleteSubAgent(agentId: string, name: string): Promise<void> {
  const r = await fetch(url(agentId, name), { method: "DELETE" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "sub-agent delete failed");
}
