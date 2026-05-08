import type { ActivityResult } from "./activity-log";

export type { ActivityEvent, ActivityKind, ActivityResult } from "./activity-log";

export async function fetchActivity(
  agentId: string,
  limit = 100
): Promise<ActivityResult> {
  const url = `/api/agents/${encodeURIComponent(agentId)}/activity?limit=${limit}`;
  const r = await fetch(url, { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "activity fetch failed");
  return d as ActivityResult;
}
