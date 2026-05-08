export async function fetchMemoryFiles(agentId: string): Promise<string[]> {
  const r = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}/memory/files`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error("memory files fetch failed: " + r.status);
  const d = await r.json();
  return (d.files as string[]) ?? [];
}

export async function fetchMemoryFile(agentId: string, file: string): Promise<string> {
  const url = `/api/agents/${encodeURIComponent(agentId)}/memory/file?path=${encodeURIComponent(file)}`;
  const r = await fetch(url, { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "memory file fetch failed");
  return d.content as string;
}

export async function saveMemoryFile(agentId: string, file: string, content: string): Promise<void> {
  const url = `/api/agents/${encodeURIComponent(agentId)}/memory/file?path=${encodeURIComponent(file)}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "memory file save failed");
}
