"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Agent } from "@/lib/api";
import type { Attachment } from "@/lib/chat-types";
import { Bubble } from "@/components/chat/Bubble";
import { StatsBar } from "@/components/chat/StatsBar";
import { Composer } from "@/components/chat/Composer";
import { useChatSession } from "@/lib/use-chat-session";

export function ChatPanel({ agent }: { agent: Agent | null }) {
  const session = useChatSession(agent);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session.messages]);

  // Stable handler so Composer's memoization (once we add React.memo there
  // too) and our own re-render churn isn't driven by referential changes.
  const handleSend = useCallback(
    (text: string, attachment: Attachment | null) => {
      void session.send(text, attachment);
    },
    [session],
  );

  if (!agent) {
    return <div className="p-8 text-sm text-zinc-400">Select an agent to chat.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        agent={agent}
        sessionId={session.sessionId}
        model={session.lastTurn?.model}
        busy={session.busy}
        onClear={session.clear}
      />
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {session.messages.length === 0 && (
          <div className="text-center text-sm text-zinc-400 mt-12">
            Start a conversation with{" "}
            <span className="font-medium text-zinc-600">{agent.name}</span>.
          </div>
        )}
        {session.messages.map((m) => (
          <Bubble key={m.id} message={m} onDecide={session.decide} onAnswer={session.answer} />
        ))}
        {session.error && (
          <div className="text-xs px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-rose-700">
            {session.error}
          </div>
        )}
      </div>
      <div className="px-6 py-4 border-t border-zinc-200 bg-white space-y-3">
        {(session.lastTurn || session.stats.turns > 0) && (
          <StatsBar
            last={session.lastTurn}
            stats={session.stats}
            contextWindow={session.lastTurn?.context_window ?? null}
          />
        )}
        <Composer
          busy={session.busy}
          onSend={handleSend}
          onCancel={session.cancel}
        />
      </div>
    </div>
  );
}

function Header({
  agent,
  sessionId,
  model,
  busy,
  onClear,
}: {
  agent: Agent;
  sessionId: string | null;
  model?: string | null;
  busy: boolean;
  onClear: () => void;
}) {
  return (
    <div className="px-6 py-3 border-b border-zinc-200 bg-white flex items-center gap-3 text-xs">
      <div className="font-semibold text-zinc-900">{agent.name}</div>
      <div className="mono text-zinc-400 truncate flex-1">{agent.path}</div>
      {model && (
        <div className="mono text-zinc-500 shrink-0 px-1.5 py-0.5 rounded bg-zinc-100">{model}</div>
      )}
      {sessionId && <div className="mono text-zinc-400 shrink-0">#{sessionId.slice(0, 8)}</div>}
      <button
        onClick={onClear}
        disabled={busy}
        className="text-xs px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}
