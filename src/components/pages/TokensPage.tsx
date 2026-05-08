"use client";

import { Tokens } from "../overview/Tokens";

interface Props {
  agentId: string | null;
}

export function TokensPage({ agentId }: Props) {
  if (!agentId) {
    return (
      <div className="p-8 text-sm text-zinc-400">
        Pick an agent in <span className="text-zinc-700">Agents</span> first.
      </div>
    );
  }
  return (
    <div className="p-6 max-w-6xl">
      <Tokens agentId={agentId} />
    </div>
  );
}
