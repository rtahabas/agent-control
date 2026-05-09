export async function fetchMemoryFiles(agentId: string): Promise<string[]> {
  const r = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}/memory/files`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error("memory files fetch failed: " + r.status);
  const d = await r.json();
  return (d.files as string[]) ?? [];
}

export interface MemoStat {
  file: string;
  lines: number;
  bytes: number;
  tokens: number;
  mtime: string;
  hot: boolean;
  indexed: boolean;
  bloated: boolean;
  orphan: boolean;
  stale: boolean;
  urgent: boolean;
  last_seen: string | null;
  ref_count: number;
}

export interface IndexDrift { index: string; entry: string; target: string }

export interface MemoryUtilization {
  files: MemoStat[];
  hot_tokens: number;
  total_tokens: number;
  memory_md_lines: number;
  hot_lines_limit: number;
  counts: { total: number; hot: number; bloated: number; orphan: number; stale: number; urgent: number };
  drift: IndexDrift[];
  stale_threshold_days: number;
  urgent_threshold_days: number;
  bloated_line_threshold: number;
}

export async function fetchMemoryUtilization(agentId: string): Promise<MemoryUtilization> {
  const r = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}/memory/utilization`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error("memory utilization fetch failed: " + r.status);
  return (await r.json()) as MemoryUtilization;
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

export async function createMemoryFile(agentId: string, file: string, content: string): Promise<void> {
  const url = `/api/agents/${encodeURIComponent(agentId)}/memory/file?path=${encodeURIComponent(file)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "memory file create failed");
}

export async function deleteMemoryFile(agentId: string, file: string): Promise<void> {
  const url = `/api/agents/${encodeURIComponent(agentId)}/memory/file?path=${encodeURIComponent(file)}`;
  const r = await fetch(url, { method: "DELETE" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "memory file delete failed");
}
