import { agentHooks, type AgentHookMap, type HookHandler } from "@/lib/hooks";

export interface SkillApi {
  on<K extends keyof AgentHookMap>(hook: K, handler: HookHandler<AgentHookMap[K]>): void;
}

export interface SkillApiHandle {
  api: SkillApi;
  hookCount(): number;
  dispose(): void;
}

export function createSkillApi(): SkillApiHandle {
  const unsubscribers: Array<() => void> = [];
  let count = 0;

  const api: SkillApi = {
    on<K extends keyof AgentHookMap>(hook: K, handler: HookHandler<AgentHookMap[K]>): void {
      const off = agentHooks.on(hook, handler);
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
