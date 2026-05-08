"use client";

import { parsePending, type State } from "@/lib/api";
import { SectionHead } from "./Section";

export function SubAgents({ agents }: { agents: string[] }) {
  return (
    <section>
      <SectionHead title="Sub-Agents" count={agents.length} />
      <div className="bg-white rounded-lg border border-zinc-200 p-4">
        <div className="flex flex-wrap gap-1.5">
          {agents.map((a) => (
            <span key={a} className="text-xs mono px-2 py-1 rounded bg-zinc-100 text-zinc-700">
              {a}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Hooks({ hooks }: { hooks: State["hooks"] }) {
  return (
    <section>
      <SectionHead title="Hooks" />
      <div className="bg-white rounded-lg border border-zinc-200 grid grid-cols-2 divide-x divide-y divide-zinc-100">
        {Object.entries(hooks).map(([k, v]) => (
          <div key={k} className="p-3 text-center">
            <div className="text-2xl font-semibold text-zinc-900 mono">{v}</div>
            <div className="text-xs text-zinc-500 mt-1">{k}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Pending({ pending }: { pending: string[] }) {
  const items = parsePending(pending);
  return (
    <section>
      <SectionHead title="Pending" count={items.length} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.length === 0 ? (
          <div className="text-sm text-zinc-400">(none)</div>
        ) : (
          items.map((it, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 transition"
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs mono text-zinc-400 font-medium">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="text-sm font-semibold text-zinc-900">{it.title}</div>
              </div>
              {it.desc && <div className="text-xs text-zinc-600 leading-relaxed mt-1">{it.desc}</div>}
              {it.ref && <div className="text-xs mono text-zinc-400 mt-2">{it.ref}</div>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
