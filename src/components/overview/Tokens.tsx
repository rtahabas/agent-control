"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTokenStats, type TokenStats } from "@/lib/tokens-api";

interface Props {
  agentId: string;
}

function fmtNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

function fmtUsd(n: number): string {
  if (n >= 100) return "$" + n.toFixed(0);
  if (n >= 10) return "$" + n.toFixed(2);
  return "$" + n.toFixed(2);
}

function DayBars({ stats }: { stats: TokenStats }) {
  const days = stats.window_days;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const map = new Map<string, number>();
  for (const d of stats.daily) map.set(d.date, d.cost_usd);
  const buckets: { date: string; cost: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    buckets.push({ date: key, cost: map.get(key) ?? 0 });
  }
  const max = Math.max(0.01, ...buckets.map((b) => b.cost));
  return (
    <div className="flex items-end gap-1 h-10">
      {buckets.map((b, i) => {
        const h = b.cost > 0 ? Math.max(2, (b.cost / max) * 40) : 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${b.date}: ${fmtUsd(b.cost)}`}>
            <div
              className={`w-full rounded-sm ${b.cost > 0 ? "bg-emerald-500" : "bg-zinc-200"}`}
              style={{ height: h }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function Tokens({ agentId }: Props) {
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setStats(await fetchTokenStats(agentId, 7)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">Token usage</h2>
          <span className="text-xs text-zinc-400 mono">last 7 days</span>
        </div>
        <button type="button" onClick={load} disabled={loading} className="text-[11px] px-2 py-0.5 rounded border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      <div className="bg-white rounded-lg border border-zinc-200 p-4">
        {error && <div className="text-sm text-rose-600">{error}</div>}
        {!error && !stats && loading && <div className="text-sm text-zinc-500">Scanning session logs…</div>}
        {!error && stats && stats.total.events === 0 && (
          <div className="text-sm text-zinc-500">No recent assistant turns under <span className="mono">{stats.session_dirs}</span> session dir{stats.session_dirs === 1 ? "" : "s"}.</div>
        )}
        {!error && stats && stats.total.events > 0 && (
          <div className="space-y-3">
            <div className="flex items-baseline gap-4">
              <div className="text-3xl font-semibold mono text-zinc-900">{fmtUsd(stats.total.cost_usd)}</div>
              <div className="text-xs text-zinc-500 mono">
                {fmtNum(stats.total.input + stats.total.output + stats.total.cache_write + stats.total.cache_read)} tokens · {stats.total.events.toLocaleString()} events · {stats.session_dirs} session dir{stats.session_dirs === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
              <span>in <span className="mono text-zinc-900 font-medium">{fmtNum(stats.total.input)}</span></span>
              <span>out <span className="mono text-zinc-900 font-medium">{fmtNum(stats.total.output)}</span></span>
              <span>cache write <span className="mono text-zinc-900 font-medium">{fmtNum(stats.total.cache_write)}</span></span>
              <span>cache read <span className="mono text-zinc-900 font-medium">{fmtNum(stats.total.cache_read)}</span></span>
            </div>
            <DayBars stats={stats} />
            {stats.by_model.length > 0 && (
              <div className="pt-2 border-t border-zinc-100 text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-1">
                {stats.by_model.map((m) => (
                  <span key={m.model}>
                    <span className="mono text-zinc-700">{m.model}</span>{" "}
                    <span className="mono text-zinc-900 font-medium">{fmtUsd(m.cost_usd)}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="text-[11px] text-zinc-400">
              Cost is an estimate from the public Anthropic pricing snapshot — adjust <span className="mono">claude-pricing.ts</span> if you have negotiated rates.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
