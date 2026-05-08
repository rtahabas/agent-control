import type { Agent } from "./api";
import { createAgent } from "./api";
import { scaffoldAgent } from "./scaffold-api";
import type { IdentityState } from "@/components/editor/PersonalityFields";

export type CreateMode = "register" | "scaffold";

export interface CreateInput {
  mode: CreateMode;
  id: string;
  name: string;
  path: string;
  notes: string;
  identity: IdentityState;
  skills: string[];
}

export async function applyAgentCreate(input: CreateInput): Promise<Agent> {
  const common = {
    id: input.id || undefined,
    name: input.name,
    path: input.path,
    notes: input.notes || null,
  };
  if (input.mode === "register") {
    return createAgent(common);
  }
  return scaffoldAgent({
    ...common,
    identity: input.identity,
    skills: input.skills,
    template: "blank",
  });
}
