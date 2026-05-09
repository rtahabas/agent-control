"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMemoryUtilization, type MemoryUtilization, type MemoStat } from "@/lib/memory-api";
import { MemoryHeader } from "../memory/MemoryHeader";
import { QualityIssues } from "../memory/QualityIssues";
import { MemoTable } from "../memory/MemoTable";

interface Props {
  agentId: string | null;
  onFileClick?: (file: string) => void;
  onNewFile?: () => void;
}

type Filter = "all" | "hot" | "orphan" | "stale" | "urgent" | "bloated";

export function MemoryPage({ agentId, onFileClick, onNewFile }: Props) {
  const [data, setData] = useState<MemoryUtilization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(() => {
    if (!agentId) return;
    setLoading(true); setError(null);
    fetchMemoryUtilization(agentId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  if (!agentId) {
    return <div className="p-8 text-sm text-zinc-400">Pick an agent in <span className="text-zinc-700">Agents</span> first.</div>;
  }

  const visible = filterFiles(data?.files ?? [], filter);

  return (
    <div className="p-6 max-w-6xl space-y-5">
      {data && <MemoryHeader util={data} onNewFile={onNewFile} />}
      {loading && !data && <div className="text-sm text-zinc-500">Loading…</div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {data && (
        <>
          <QualityIssues util={data} filter={filter} setFilter={setFilter} />
          <MemoTable files={visible} onFileClick={onFileClick} />
        </>
      )}
    </div>
  );
}

function filterFiles(files: MemoStat[], filter: Filter): MemoStat[] {
  if (filter === "all") return files;
  if (filter === "hot") return files.filter((f) => f.hot);
  if (filter === "orphan") return files.filter((f) => f.orphan);
  if (filter === "stale") return files.filter((f) => f.stale);
  if (filter === "urgent") return files.filter((f) => f.urgent);
  if (filter === "bloated") return files.filter((f) => f.bloated);
  return files;
}
