"use client";

import { useEffect, useState } from "react";
import { fetchAgentSkill, saveAgentSkill, deleteAgentSkill } from "@/lib/agent-skills-api";
import { parseFrontmatter, buildSkillEntry, type SkillEntry } from "@/lib/skill-parse";
import { Markdown } from "./Markdown";
import { ModalShell } from "./editor/Field";

interface Props {
  agentId: string;
  skillName: string;
  consolidate?: boolean;
  onClose: () => void;
}

type Mode = "read" | "edit";

interface Split {
  meta: Record<string, unknown>;
  entry: SkillEntry;
  body: string;
}

const STRUCTURED_KEYS = new Set(["name", "description", "activation", "lifecycle", "configSchema"]);

function splitFrontmatter(text: string, fallbackName: string): Split {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, entry: { name: fallbackName, description: "" }, body: text };
  const meta = parseFrontmatter(text);
  return { meta, entry: buildSkillEntry(meta, fallbackName), body: m[2] };
}

export function SkillViewer({ agentId, skillName, consolidate, onClose }: Props) {
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
    fetchAgentSkill(agentId, skillName)
      .then((c) => { if (alive) { setContent(c); setOriginal(c); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [agentId, skillName]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy && !dirty) onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose, busy, dirty]);

  const closeIfClean = () => { if (dirty && !confirm("Discard unsaved changes?")) return; onClose(); };
  const save = async () => {
    if (content === null || saving) return;
    setSaving(true); setError(null);
    try { await saveAgentSkill(agentId, skillName, content); setOriginal(content); setMode("read"); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };
  const revert = () => { if (original !== null) setContent(original); setMode("read"); setError(null); };
  const remove = async () => {
    if (saving) return;
    if (!confirm(`Delete skill "${skillName}"? This removes the entire skill directory.`)) return;
    setSaving(true); setError(null);
    try { await deleteAgentSkill(agentId, skillName); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setSaving(false); }
  };

  const split = content !== null ? splitFrontmatter(content, skillName) : null;

  return (
    <ModalShell onClose={closeIfClean} busy={busy} wide>
      <div className="flex flex-col max-h-[85vh]">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-zinc-500">skill</div>
            <div className="text-sm font-mono text-zinc-900 truncate">{skillName}</div>
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
          {consolidate && (
            <div className="mb-4 text-xs px-3 py-2 rounded border bg-amber-50 border-amber-200 text-amber-900">
              No activity in 30 days. Consider merging into another skill or
              deleting if redundant. Edit the body below or use{" "}
              <span className="mono">Delete</span> to remove.
            </div>
          )}
          {loading && <div className="text-sm text-zinc-500">Loading…</div>}
          {!loading && split && mode === "read" && (
            <>
              {(Object.keys(split.meta).length > 0 || split.entry.activation || split.entry.lifecycle || split.entry.configSchema) && (
                <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-4 space-y-2">
                  {Object.entries(split.meta)
                    .filter(([k, v]) => !STRUCTURED_KEYS.has(k) && typeof v === "string")
                    .map(([k, v]) => (
                      <div key={k} className="text-xs">
                        <span className="text-zinc-500 mr-2 font-mono">{k}</span>
                        <span className="text-zinc-900">{String(v)}</span>
                      </div>
                    ))}
                  {(typeof split.meta.name === "string" || split.entry.name !== skillName) && (
                    <div className="text-xs">
                      <span className="text-zinc-500 mr-2 font-mono">name</span>
                      <span className="text-zinc-900">{split.entry.name}</span>
                    </div>
                  )}
                  {split.entry.description && (
                    <div className="text-xs">
                      <span className="text-zinc-500 mr-2 font-mono">description</span>
                      <span className="text-zinc-900">{split.entry.description}</span>
                    </div>
                  )}
                  {split.entry.activation?.onStartup && (
                    <div className="text-xs pt-1">
                      <span className="inline-block px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px]">
                        Auto-load on startup
                      </span>
                    </div>
                  )}
                  {split.entry.lifecycle?.hooks && split.entry.lifecycle.hooks.length > 0 && (
                    <div className="text-xs pt-1">
                      <span className="text-zinc-500 mr-2 font-mono">hooks</span>
                      <span className="inline-flex flex-wrap gap-1">
                        {split.entry.lifecycle.hooks.map((h) => (
                          <span key={h} className="inline-block px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[11px] font-mono">
                            {h}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                  {split.entry.configSchema && (
                    <details className="text-xs pt-1">
                      <summary className="cursor-pointer text-zinc-500 font-mono">configSchema</summary>
                      <pre className="mt-1 p-2 bg-zinc-50 rounded text-[11px] overflow-x-auto">
                        {JSON.stringify(split.entry.configSchema, null, 2)}
                      </pre>
                    </details>
                  )}
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
