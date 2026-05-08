"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { Health, Memory, Skills, StaleDailyLog } from "@/lib/api";

interface Props {
  memory: Memory;
  health: Health;
  skills: Skills;
}

type Tone = "red" | "amber";

function Row({
  tone,
  text,
  action,
  expanded,
}: {
  tone: Tone;
  text: ReactNode;
  action?: { label: string; onClick: () => void };
  expanded?: ReactNode;
}) {
  const palette =
    tone === "red"
      ? "bg-rose-50 border-rose-200 text-rose-900"
      : "bg-amber-50 border-amber-200 text-amber-900";
  return (
    <div className={`text-xs rounded border ${palette}`}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div>{text}</div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-[11px] font-medium shrink-0 underline-offset-2 hover:underline"
          >
            {action.label}
          </button>
        )}
      </div>
      {expanded}
    </div>
  );
}

function StaleList({ logs }: { logs: StaleDailyLog[] }) {
  const sorted = [...logs].sort((a, b) => b.days_old - a.days_old);
  return (
    <ul className="border-t border-amber-200/60 max-h-56 overflow-y-auto divide-y divide-amber-200/40">
      {sorted.map((l) => (
        <li
          key={l.file}
          className="flex items-center justify-between px-3 py-1.5 mono text-[11px]"
        >
          <span>{l.file}</span>
          <span className="text-amber-800/70">{l.days_old}d</span>
        </li>
      ))}
    </ul>
  );
}

export function HealthBar({ memory, health, skills }: Props) {
  const [staleOpen, setStaleOpen] = useState(false);
  const hotPct = memory.hot_cap > 0 ? memory.hot_lines / memory.hot_cap : 0;
  const hotOver = memory.hot_lines > memory.hot_cap;
  const hotWarn = !hotOver && hotPct >= 0.8;
  const staleCount = health.stale_daily_logs.length;
  const deadCount = skills.dead.length;

  if (!hotOver && !hotWarn && staleCount === 0 && deadCount === 0) return null;

  return (
    <section className="space-y-1.5" aria-label="Agent health">
      {hotOver && (
        <Row
          tone="red"
          text={
            <>
              HOT cap exceeded:{" "}
              <span className="mono font-medium">
                {memory.hot_lines}/{memory.hot_cap}
              </span>{" "}
              lines in MEMORY.md — prune to keep auto-load context clean
            </>
          }
        />
      )}
      {!hotOver && hotWarn && (
        <Row
          tone="amber"
          text={
            <>
              HOT near cap:{" "}
              <span className="mono font-medium">
                {memory.hot_lines}/{memory.hot_cap}
              </span>{" "}
              lines in MEMORY.md
            </>
          }
        />
      )}
      {staleCount > 0 && (
        <Row
          tone="amber"
          text={
            <>
              <span className="mono font-medium">{staleCount}</span> daily log
              {staleCount === 1 ? "" : "s"} stale (&gt;30 days) — consider
              archiving to <span className="mono">warm-archive.md</span>
            </>
          }
          action={{
            label: staleOpen ? "Hide" : "View →",
            onClick: () => setStaleOpen((v) => !v),
          }}
          expanded={
            staleOpen ? <StaleList logs={health.stale_daily_logs} /> : undefined
          }
        />
      )}
      {deadCount > 0 && (
        <Row
          tone="amber"
          text={
            <>
              <span className="mono font-medium">{deadCount}</span> dead skill
              {deadCount === 1 ? "" : "s"} — review for consolidation
            </>
          }
          action={{
            label: "View →",
            onClick: () => {
              const el = document.getElementById("overview-skills");
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
          }}
        />
      )}
    </section>
  );
}
