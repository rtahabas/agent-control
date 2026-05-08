export async function fetchSettings(agentId: string): Promise<string> {
  const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}/settings`, { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "settings fetch failed");
  return d.content as string;
}

export async function saveSettings(agentId: string, content: string): Promise<void> {
  const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "settings save failed");
}
