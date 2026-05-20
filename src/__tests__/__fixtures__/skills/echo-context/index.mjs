export function register(api) {
  api.on("before_agent_reply", (ctx) => ({
    ...ctx,
    contextSections: [...ctx.contextSections, "echo:" + ctx.agentId],
  }));
}
