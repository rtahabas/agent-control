import { agentHooks, type AgentHookMap, type HookHandler } from "@/lib/hooks";
import { emitSkillActivity, type EmitOptions } from "@/lib/skill-activity-emit";

export interface SkillApi {
  on<K extends keyof AgentHookMap>(hook: K, handler: HookHandler<AgentHookMap[K]>): void;
}

export interface SkillApiHandle {
  api: SkillApi;
  hookCount(): number;
  dispose(): void;
}

export interface CreateSkillApiOptions {
  emit?: (skill: string, argLen: number) => void;
  emitOptions?: EmitOptions;
}

function contributionGrew(
  hook: keyof AgentHookMap,
  before: AgentHookMap[keyof AgentHookMap],
  after: AgentHookMap[keyof AgentHookMap] | void,
): { contributed: boolean; argLen: number } {
  if (hook !== "before_agent_reply") return { contributed: false, argLen: 0 };
  const beforeCtx = before as AgentHookMap["before_agent_reply"];
  const afterCtx = (after ?? beforeCtx) as AgentHookMap["before_agent_reply"];
  const beforeLen = Array.isArray(beforeCtx.contextSections)
    ? beforeCtx.contextSections.length
    : 0;
  const afterLen = Array.isArray(afterCtx.contextSections)
    ? afterCtx.contextSections.length
    : beforeLen;
  if (afterLen <= beforeLen) return { contributed: false, argLen: 0 };
  return { contributed: true, argLen: (beforeCtx.userMessage ?? "").length };
}

export function createSkillApi(
  skillName: string,
  options: CreateSkillApiOptions = {},
): SkillApiHandle {
  const unsubscribers: Array<() => void> = [];
  let count = 0;
  const emit = options.emit
    ?? ((skill, argLen) => emitSkillActivity(skill, argLen, options.emitOptions));

  const api: SkillApi = {
    on<K extends keyof AgentHookMap>(hook: K, handler: HookHandler<AgentHookMap[K]>): void {
      const wrapped: HookHandler<AgentHookMap[K]> = async (ctx) => {
        const result = await handler(ctx);
        const verdict = contributionGrew(hook, ctx, result);
        if (verdict.contributed) {
          try {
            emit(skillName, verdict.argLen);
          } catch (err) {
            console.error(`[skill-api] emit failed for ${skillName}:`, err);
          }
        }
        return result;
      };
      const off = agentHooks.on(hook, wrapped);
      unsubscribers.push(off);
      count++;
    },
  };

  return {
    api,
    hookCount: () => count,
    dispose: () => {
      while (unsubscribers.length > 0) {
        const off = unsubscribers.pop();
        try {
          off?.();
        } catch {
          /* ignore — disposal best-effort */
        }
      }
    },
  };
}

export type SkillRegisterFn = (api: SkillApi) => void | Promise<void>;
