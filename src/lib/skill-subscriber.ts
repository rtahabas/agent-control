import { agentHooks } from "@/lib/hooks";
import { readSkillsCatalog } from "@/lib/skills-catalog";
import type { SkillEntry } from "@/lib/skill-parse";

type AgentHookName =
  | "before_model_resolve"
  | "before_prompt_build"
  | "before_agent_reply"
  | "before_tool_call"
  | "after_tool_call"
  | "agent_end";

const VALID_HOOK_NAMES: readonly AgentHookName[] = [
  "before_model_resolve",
  "before_prompt_build",
  "before_agent_reply",
  "before_tool_call",
  "after_tool_call",
  "agent_end",
];

function isValidHookName(name: string): name is AgentHookName {
  return (VALID_HOOK_NAMES as readonly string[]).includes(name);
}

let registered = false;

export async function registerSkillSubscriptions(
  loader: () => Promise<SkillEntry[]> = readSkillsCatalog,
): Promise<number> {
  if (registered) return 0;
  registered = true;
  const skills = await loader();
  let count = 0;
  for (const skill of skills) {
    const hooks = skill.lifecycle?.hooks;
    if (!hooks) continue;
    for (const name of hooks) {
      if (!isValidHookName(name)) continue;
      agentHooks.on(name, (ctx) => ctx);
      count++;
    }
  }
  return count;
}

export function _resetSkillSubscriptionsForTests(): void {
  registered = false;
}
