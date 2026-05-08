"use client";

import { useEffect, useState } from "react";
import { fetchSubAgent, saveSubAgent, deleteSubAgent } from "@/lib/sub-agents-api";
import { Markdown } from "./Markdown";
import { ModalShell } from "./editor/Field";

interface Props {
  agentId: string;
  subName: string;
  onClose: () => void;
}

type Mode = "read" | "edit";

interface Split { meta: Record<string, string>; body: string; }

function splitFrontmatter(text: string): Split {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (k) meta[k] = v;
  }
  return { meta, body: m[2] };
}

export function SubAgentViewer({ agentId, subName, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("read");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = content !== null && original !== null && content !== original;
  const busy = loading || saving;

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetchSubAgent(agentId, subName)
      .then((c) => { if (alive) { setContent(c); setOriginal(c); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [agentId, subName]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy && !dirty) onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose, busy, dirty]);

  const closeIfClean = () => { if (dirty && !confirm("Discard unsaved changes?")) return; onClose(); };
  const save = async () => {
    if (content === null || saving) return;
    setSaving(true); setError(null);
    try { await saveSubAgent(agentId, subName, content); setOriginal(content); setMode("read"); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };
  const revert = () => { if (original !== null) setContent(original); setMode("read"); setError(null); };
  const remove = async () => {
    if (saving) return;
    if (!confirm(`Delete sub-agent "${subName}"? This removes ${subName}.md.`)) return;
    setSaving(true); setError(null);
    try { await deleteSubAgent(agentId, subName); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setSaving(false); }
  };

  const split = content !== null ? splitFrontmatter(content) : null;

  return (
    <ModalShell onClose={closeIfClean} busy={busy} wide>
      <div className="flex flex-col max-h-[85vh]">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-zinc-500">sub-agent</div>
            <div className="text-sm font-mono text-zinc-900 truncate">{subName}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mode === "read" ? (
              <button type="button" onClick={() => setMode("edit")} disabled={busy} className="px-3 py-1 text-xs font-medium rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Edit</button>
            ) : (
              <span className="text-xs text-zinc-500">{dirty ? "modified" : "no changes"}</span>
            )}
            <button type="button" onClick={closeIfClean} disabled={saving} className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50" aria-label="Close">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 bg-zinc-50">
          {loading && <div className="text-sm text-zinc-500">Loading…</div>}
          {!loading && split && mode === "read" && (
            <>
              {Object.keys(split.meta).length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {Object.entries(split.meta).map(([k, v]) => (
                    <div key={k} className="text-xs">
                      <span className="text-zinc-500 mr-2 font-mono">{k}</span>
                      <span className="text-zinc-900">{v || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
              {split.body.trim() && <Markdown text={split.body} />}
            </>
          )}
          {!loading && content !== null && mode === "edit" && (
            <textarea value={content} onChange={(e) => setContent(e.target.value)} disabled={saving} spellCheck={false}
              className="w-full min-h-[60vh] px-3 py-2 text-xs font-mono leading-relaxed border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-500 bg-white disabled:bg-zinc-50" />
          )}
        </div>
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-2">
          {mode === "read" && !loading && (
            <button type="button" onClick={remove} disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50">Delete</button>
          )}
          {error && <div className="text-xs text-rose-600">{error}</div>}
          <div className="flex-1" />
          {mode === "edit" && (
            <>
              <button type="button" onClick={revert} disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={save} disabled={!dirty || saving} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Saving…" : "Save"}</button>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
