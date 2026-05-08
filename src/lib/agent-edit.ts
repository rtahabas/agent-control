import type { Agent } from "@/lib/api";
import { updateAgent } from "@/lib/api";

export interface EditFields {
  name: string;
  path: string;
  notes: string;
}

export async function applyAgentEdit(agent: Agent, next: EditFields): Promise<Agent> {
  const patch: Record<string, string | null> = {};
  if (next.name !== agent.name) patch.name = next.name;
  if (next.path !== agent.path) patch.path = next.path;
  if (next.notes !== (agent.notes ?? "")) patch.notes = next.notes || null;
  return updateAgent(agent.id, patch);
}
