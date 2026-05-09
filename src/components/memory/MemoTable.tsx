"use client";

import type { MemoStat } from "@/lib/memory-api";
import { fmtNum } from "@/lib/chat-fmt";

interface Props {
  files: MemoStat[];
  onFileClick?: (file: string) => void;
}

export function MemoTable({ files, onFileClick }: Props) {
  if (files.length === 0) {
    return <div className="text-sm text-zinc-400 px-3 py-6 text-center">Nothing matches this filter.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-xs">
        <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2 text-left font-medium">File</th>
            <th className="px-3 py-2 text-right font-medium">Lines</th>
            <th className="px-3 py-2 text-right font-medium">~Tokens</th>
            <th className="px-3 py-2 text-left font-medium">Last seen</th>
            <th className="px-3 py-2 text-right font-medium">Refs</th>
            <th className="px-3 py-2 text-left font-medium">Flags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {files.map((f) => (
            <Row key={f.file} f={f} onClick={onFileClick} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ f, onClick }: { f: MemoStat; onClick?: (file: string) => void }) {
  return (
    <tr className="hover:bg-zinc-50">
      <td className="px-3 py-1.5 mono">
        <button
          type="button"
          onClick={() => onClick?.(f.file)}
          className="text-zinc-800 hover:text-zinc-900 hover:underline text-left"
        >
          {f.file}
        </button>
      </td>
      <td className={`px-3 py-1.5 text-right mono ${f.bloated ? "text-rose-700 font-medium" : "text-zinc-700"}`}>
        {f.lines}
      </td>
      <td className="px-3 py-1.5 text-right mono text-zinc-700">{fmtNum(f.tokens)}</td>
      <td className="px-3 py-1.5 mono text-zinc-500">{f.last_seen ?? "—"}</td>
      <td className="px-3 py-1.5 text-right mono text-zinc-700">{f.ref_count}</td>
      <td className="px-3 py-1.5">
        <Flags f={f} />
      </td>
    </tr>
  );
}

function Flags({ f }: { f: MemoStat }) {
  return (
    <div className="flex flex-wrap gap-1">
      {f.hot && <Badge tone="blue">HOT</Badge>}
      {f.bloated && <Badge tone="rose">bloated</Badge>}
      {f.orphan && <Badge tone="amber">orphan</Badge>}
      {f.urgent ? <Badge tone="rose">urgent</Badge> : f.stale && <Badge tone="amber">stale</Badge>}
      {!f.hot && f.indexed && <Badge tone="zinc">indexed</Badge>}
    </div>
  );
}

function Badge({ tone, children }: { tone: "blue" | "rose" | "amber" | "zinc"; children: string }) {
  const palette =
    tone === "blue" ? "bg-blue-50 text-blue-700 border-blue-200" :
    tone === "rose" ? "bg-rose-50 text-rose-700 border-rose-200" :
    tone === "amber" ? "bg-amber-50 text-amber-800 border-amber-200" :
    "bg-zinc-100 text-zinc-600 border-zinc-200";
  return (
    <span className={`text-[10px] mono px-1.5 py-0.5 rounded border ${palette}`}>{children}</span>
  );
}
