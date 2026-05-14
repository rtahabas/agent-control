export type HookHandler<C> = (ctx: C) => Promise<C | void> | C | void;

export interface HookBus<HookMap> {
  on<K extends keyof HookMap>(hook: K, handler: HookHandler<HookMap[K]>): () => void;
  emit<K extends keyof HookMap>(hook: K, ctx: HookMap[K]): Promise<HookMap[K]>;
  clear(hook?: keyof HookMap): void;
}

export interface AgentHookMap {
  before_model_resolve: {
    readonly provider: string;
    model: string;
  };
  before_prompt_build: {
    systemPrompt: string;
    readonly userMessage: string;
  };
  before_agent_reply: {
    readonly agentId: string;
    readonly cwd: string;
    readonly sessionId: string | null;
    contextSections: string[];
  };
  before_tool_call: {
    readonly toolName: string;
    input: Record<string, unknown>;
    readonly sessionId: string | null;
  };
  after_tool_call: {
    readonly toolName: string;
    readonly input: Record<string, unknown>;
    result: unknown;
    readonly sessionId: string | null;
  };
  agent_end: {
    readonly agentId: string;
    readonly sessionId: string | null;
    readonly status: "ok" | "error" | "aborted";
    readonly error?: string;
  };
}

export function createHookBus<HookMap>(): HookBus<HookMap> {
  const subs = new Map<keyof HookMap, Array<HookHandler<unknown>>>();

  return {
    on<K extends keyof HookMap>(hook: K, handler: HookHandler<HookMap[K]>): () => void {
      let arr = subs.get(hook);
      if (!arr) {
        arr = [];
        subs.set(hook, arr);
      }
      arr.push(handler as HookHandler<unknown>);
      return () => {
        const cur = subs.get(hook);
        if (!cur) return;
        const idx = cur.indexOf(handler as HookHandler<unknown>);
        if (idx >= 0) cur.splice(idx, 1);
      };
    },

    async emit<K extends keyof HookMap>(hook: K, ctx: HookMap[K]): Promise<HookMap[K]> {
      const arr = subs.get(hook);
      if (!arr || arr.length === 0) return ctx;
      let current: HookMap[K] = ctx;
      for (const handler of arr) {
        const result = await (handler as HookHandler<HookMap[K]>)(current);
        if (result !== undefined) {
          current = result;
        }
      }
      return current;
    },

    clear(hook?: keyof HookMap): void {
      if (hook === undefined) {
        subs.clear();
      } else {
        subs.delete(hook);
      }
    },
  };
}

export const agentHooks = createHookBus<AgentHookMap>();
