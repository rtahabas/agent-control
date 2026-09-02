"use client";

import { useState } from "react";
import type { Agent } from "@/lib/api";
import { toggleAgent, launchAgent } from "@/lib/api";

interface Props {
  agent: Agent;
  selected: boolean;
  onSelect: () => void;
  onChange: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AgentRow({ agent, selected, onSelect, onChange, onEdit, onDelete }: Props) {
  const [busy, setBusy] = useState<null | "toggle" | "launch">(null);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const handleToggle = async (e: React.MouseEvent) => {
    stop(e);
    setBusy("toggle");
    try {
      await toggleAgent(agent.id);
      onChange();
    } finally {
      setBusy(null);
    }
  };

  const handleLaunch = async (e: React.MouseEvent) => {
    stop(e);
    setBusy("launch");
    try {
      await launchAgent(agent.id);
    } finally {
      setTimeout(() => setBusy(null), 1000);
    }
  };

  const isActive = agent.status === "active";
  const wrapperCls = selected
    ? "bg-zinc-100 border-zinc-300"
    : "border-transparent hover:bg-zinc-50 hover:border-zinc-200";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group w-full text-left rounded-lg px-3 py-2.5 transition border cursor-pointer ${wrapperCls}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-zinc-300"}`} />
          <span className="text-sm font-semibold text-zinc-900 truncate">{agent.name}</span>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium border ${
            isActive
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-zinc-50 text-zinc-500 border-zinc-200"
          }`}
        >
          {agent.status}
        </span>
      </div>
      <div className="text-[11px] text-zinc-500 mono truncate mb-2">{agent.path}</div>
      <div className="flex gap-1.5">
        <PrimaryBtn label={busy === "toggle" ? "..." : isActive ? "Deactivate" : "Activate"} onClick={handleToggle} disabled={busy !== null} variant="outline" />
        <PrimaryBtn label={busy === "launch" ? "..." : "Launch"} onClick={handleLaunch} disabled={busy !== null} variant="solid" />
      </div>
      <div className="mt-1.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <GhostBtn label="Edit" onClick={(e) => { stop(e); onEdit(); }} />
        <GhostBtn label="Delete" onClick={(e) => { stop(e); onDelete(); }} variant="danger" />
      </div>
    </div>
  );
}

function PrimaryBtn({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  variant: "outline" | "solid";
}) {
  const cls =
    variant === "solid"
      ? "bg-zinc-900 text-white hover:bg-zinc-700"
      : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 text-[10px] px-2 py-1 rounded ${cls} disabled:opacity-50 disabled:cursor-not-allowed font-medium uppercase tracking-wider`}
    >
      {label}
    </button>
  );
}

function GhostBtn({
  label,
  onClick,
  variant,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: "danger";
}) {
  const cls =
    variant === "danger"
      ? "border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
      : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 hover:border-zinc-300";
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-[10px] px-2 py-1 rounded border ${cls} font-medium uppercase tracking-wider`}
    >
      {label}
    </button>
  );
}
