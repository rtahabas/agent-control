"use client";

import type { Agent } from "@/lib/api";

export type View = "overview" | "chat";
export type ConnState = "loading" | "ok" | "error";

const CONN_STYLE: Record<ConnState, string> = {
  loading: "border-amber-300 bg-amber-50 text-amber-700",
  ok: "border-emerald-300 bg-emerald-50 text-emerald-700",
  error: "border-rose-300 bg-rose-50 text-rose-700",
};

const CONN_DOT: Record<ConnState, string> = {
  loading: "bg-amber-500 blink",
  ok: "bg-emerald-500",
  error: "bg-rose-500",
};

const CONN_TEXT: Record<ConnState, string> = {
  loading: "fetching",
  ok: "live",
  error: "disconnected",
};

interface Props {
  selectedAgent: Agent | null;
  view: View;
  onViewChange: (v: View) => void;
  conn: ConnState;
  age: string;
  onRefresh: () => void;
}

export function TopBar({ selectedAgent, view, onViewChange, conn, age, onRefresh }: Props) {
  return (
    <header className="border-b border-zinc-200 bg-white px-5 py-3 flex items-center gap-3 shrink-0">
      <nav className="flex gap-1 bg-zinc-100 p-1 rounded-lg">
        <Tab active={view === "overview"} onClick={() => onViewChange("overview")}>
          Overview
        </Tab>
        <Tab
          active={view === "chat"}
          disabled={!selectedAgent}
          onClick={() => onViewChange("chat")}
        >
          Chat{selectedAgent ? ` · ${selectedAgent.name}` : ""}
        </Tab>
      </nav>
      <div className="flex-1" />
      <span className="text-xs text-zinc-400 mono">{age}</span>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${CONN_STYLE[conn]}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${CONN_DOT[conn]}`} />
        {CONN_TEXT[conn]}
      </span>
      <button
        onClick={onRefresh}
        className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-700 transition"
      >
        Refresh
      </button>
    </header>
  );
}

function Tab({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1 text-xs font-medium rounded-md transition disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}
