import { agentHooks } from "@/lib/hooks";

let registered = false;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function registerRuntimeContext(now: () => Date = () => new Date()): void {
  if (registered) return;
  registered = true;

  agentHooks.on("before_agent_reply", (ctx) => {
    const section = `Runtime context: agent=${ctx.agentId}, date=${formatDate(now())}`;
    return {
      ...ctx,
      contextSections: [...ctx.contextSections, section],
    };
  });
}

export function _resetRuntimeContextForTests(): void {
  registered = false;
}
