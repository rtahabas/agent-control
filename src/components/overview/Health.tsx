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
  // A filled, bordered, full-width strip is the loudest thing the page can
  // say, and these are advisories — 114 old log files is not an incident. The
  // colour moves to a dot and the text, which is enough to find them in a scan
  // and little enough that the content underneath still leads. The row keeps
  // its full width so its disclosure has somewhere to open.
  const dot = tone === "red" ? "bg-rose-500" : "bg-amber-500";
  const body = tone === "red" ? "text-rose-900" : "text-amber-900";
  return (
    <div className="text-xs">
      <div className="flex items-center gap-2.5 py-1">
        <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <div className={body}>{text}</div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="ml-auto text-[11px] font-medium shrink-0 text-zinc-500 hover:text-zinc-900 underline-offset-2 hover:underline"
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
    // Indented to the text above it rather than boxed: the list belongs to the
    // row that opened it, and the dot's column is what shows that.
    <ul className="ml-4 mb-1 max-h-56 overflow-y-auto rounded-md bg-zinc-100/70 divide-y divide-zinc-200/60">
      {sorted.map((l) => (
        <li
          key={l.file}
          className="flex items-center justify-between px-3 py-1.5 mono text-[11px] text-zinc-600"
        >
          <span>{l.file}</span>
          <span className="text-zinc-400">{l.days_old}d</span>
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
              {staleCount === 1 ? "" : "s"}{" "}
              stale (&gt;30 days) — consider archiving to{" "}
              <span className="mono">warm-archive.md</span>
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
