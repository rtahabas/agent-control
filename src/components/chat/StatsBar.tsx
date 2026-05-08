"use client";

import type { CumulativeStats, TurnInfo } from "@/lib/chat-types";
import { fmtCost, fmtMs, fmtNum } from "@/lib/chat-fmt";

interface Props {
  last: TurnInfo | null;
  stats: CumulativeStats;
  contextWindow: number | null;
}

export function StatsBar({ last, stats, contextWindow }: Props) {
  const lin = last?.usage?.input_tokens ?? 0;
  const lout = last?.usage?.output_tokens ?? 0;
  const lcr = last?.usage?.cache_read_input_tokens ?? 0;
  const lcw = last?.usage?.cache_creation_input_tokens ?? 0;
  const lTotalIn = lin + lcr + lcw;
  const ctxPct = contextWindow && lTotalIn ? (lTotalIn / contextWindow) * 100 : null;

  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <Card title="Last turn" right={last ? <Duration t={last} /> : null}>
        {last ? (
          <Row a={lin} b={lout} cR={lcr} cW={lcw} />
        ) : (
          <div className="text-zinc-400">—</div>
        )}
        {ctxPct != null && contextWindow && (
          <Ctx used={lTotalIn} total={contextWindow} pct={ctxPct} />
        )}
        {last && (
          <div className="mt-2 text-zinc-500">
            cost <span className="mono text-zinc-900 font-medium">{fmtCost(last.cost_usd)}</span>
          </div>
        )}
      </Card>

      <Card
        title={`Session total · ${stats.turns} turn${stats.turns !== 1 ? "s" : ""}`}
        right={<span className="mono text-zinc-400">{fmtMs(stats.total_duration_ms)}</span>}
      >
        <Row
          a={stats.total_input}
          b={stats.total_output}
          cR={stats.total_cache_read}
          cW={stats.total_cache_creation}
        />
        <div className="mt-2 text-zinc-500">
          total cost{" "}
          <span className="mono text-zinc-900 font-semibold">{fmtCost(stats.total_cost_usd)}</span>
        </div>
      </Card>
    </div>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-medium">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function Duration({ t }: { t: TurnInfo }) {
  return (
    <span className="mono text-zinc-400">
      {fmtMs(t.duration_ms)}
      {t.duration_api_ms != null && (
        <span className="text-zinc-300"> · api {fmtMs(t.duration_api_ms)}</span>
      )}
    </span>
  );
}

function Row({ a, b, cR, cW }: { a: number; b: number; cR: number; cW: number }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <Metric label="in" value={fmtNum(a)} />
      <Metric label="out" value={fmtNum(b)} accent="text-emerald-700" />
      <Metric label="cache r" value={fmtNum(cR)} accent="text-blue-700" />
      <Metric label="cache w" value={fmtNum(cW)} accent="text-amber-700" />
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`mono font-semibold text-zinc-900 ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

function Ctx({ used, total, pct }: { used: number; total: number; pct: number }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
        <span>context</span>
        <span className="mono">
          {fmtNum(used)} / {fmtNum(total)} ({pct.toFixed(2)}%)
        </span>
      </div>
      <div className="h-1 bg-zinc-200 rounded-full overflow-hidden">
        <div className="h-1 bg-zinc-700 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}
