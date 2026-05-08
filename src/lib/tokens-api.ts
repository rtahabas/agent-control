import type { TokenStats } from "./token-stats";

export type { TokenStats } from "./token-stats";
export type { DayBucket, ModelBucket } from "./token-stats";

export async function fetchTokenStats(
  agentId: string,
  days = 7
): Promise<TokenStats> {
  const url = `/api/agents/${encodeURIComponent(agentId)}/tokens?days=${days}`;
  const r = await fetch(url, { cache: "no-store" });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "token stats fetch failed");
  return d as TokenStats;
}
