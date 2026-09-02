"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Agent } from "@/lib/api";
import type { Attachment } from "@/lib/chat-types";
import { Bubble } from "@/components/chat/Bubble";
import { StatsBar } from "@/components/chat/StatsBar";
import { Composer } from "@/components/chat/Composer";
import { NotifyToggle } from "@/components/chat/NotifyToggle";
import { AllowlistChip } from "@/components/chat/AllowlistChip";
import { useChatSession } from "@/lib/use-chat-session";

export function ChatPanel({ agent, visible = true }: { agent: Agent | null; visible?: boolean }) {
  const session = useChatSession(agent, visible);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [details, setDetails] = useState(false);

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
      {/* Nothing above the conversation. The path, the model, the session id and
          the two chips are reference — checked occasionally, read never — so
          they sit with the other numbers at the bottom, behind a toggle. What
          used to be a second full-width bar here was also the third place the
          agent's name appeared on one screen. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-5">
        {session.messages.length === 0 && (
          <div className="mt-24 text-center">
            <div className="text-[22px] font-semibold text-zinc-900 tracking-[-0.02em]">
              {agent.name}
            </div>
            <div className="mt-1.5 text-sm text-zinc-400">
              Ask it something to start.
            </div>
          </div>
        )}
        {session.messages.map((m) => (
          <Bubble key={m.id} message={m} onDecide={session.decide} onAnswer={session.answer} />
        ))}
        {session.error && (
          <div className="text-xs px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700">
            {session.error}
          </div>
        )}
        </div>
      </div>
      <div className="px-6 pb-5 pt-2">
        <div className="mx-auto w-full max-w-3xl rounded-2xl material lift px-4 py-3.5 space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setDetails((v) => !v)}
            aria-expanded={details}
            className="text-zinc-400 hover:text-zinc-700 transition"
          >
            {details ? "hide details" : "details"}
          </button>
          <div className="flex-1" />
          <button
            onClick={session.clear}
            disabled={session.busy}
            title="Start a new conversation — the current one stays in History"
            className="px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            New chat
          </button>
        </div>
        {details && (
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="mono truncate flex-1" title={agent.path}>{agent.path}</span>
            {session.lastTurn?.model && (
              <span className="mono shrink-0 px-1.5 py-0.5 rounded bg-zinc-100">
                {session.lastTurn.model}
              </span>
            )}
            {session.sessionId && (
              <span className="mono text-zinc-400 shrink-0">#{session.sessionId.slice(0, 8)}</span>
            )}
            <AllowlistChip
              sessionId={session.sessionId}
              refreshKey={
                session.messages.filter((m) => m.role === "permission" && m.permission?.always).length
              }
            />
            <NotifyToggle />
          </div>
        )}
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
    </div>
  );
}
