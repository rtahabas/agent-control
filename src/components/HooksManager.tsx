"use client";

import { useEffect, useState } from "react";
import { fetchSettings, saveSettings } from "@/lib/settings-api";
import { ModalShell } from "./editor/Field";

interface Props {
  agentId: string;
  onClose: () => void;
}

type Mode = "read" | "edit";

interface HookEntry {
  type?: string;
  command?: string;
  if?: string;
  statusMessage?: string;
  timeout?: number;
}

interface MatcherGroup {
  matcher?: string;
  hooks?: HookEntry[];
}

interface SettingsShape {
  hooks?: Record<string, MatcherGroup[]>;
}

const EVENT_ORDER = ["SessionStart", "PreToolUse", "PostToolUse", "Stop"];

function parseSafe(text: string): { ok: true; data: SettingsShape } | { ok: false; error: string } {
  try { return { ok: true, data: JSON.parse(text) as SettingsShape }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export function HooksManager({ agentId, onClose }: Props) {
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
    fetchSettings(agentId)
      .then((c) => { if (alive) { setContent(c); setOriginal(c); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [agentId]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy && !dirty) onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose, busy, dirty]);

  const closeIfClean = () => { if (dirty && !confirm("Discard unsaved changes?")) return; onClose(); };
  const save = async () => {
    if (content === null || saving) return;
    const parse = parseSafe(content);
    if (!parse.ok) { setError("invalid JSON: " + parse.error); return; }
    setSaving(true); setError(null);
    try { await saveSettings(agentId, content); setOriginal(content); setMode("read"); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };
  const revert = () => { if (original !== null) setContent(original); setMode("read"); setError(null); };

  const parsed = content !== null ? parseSafe(content) : null;
  const settings = parsed && parsed.ok ? parsed.data : null;

  return (
    <ModalShell onClose={closeIfClean} busy={busy} wide>
      <div className="flex flex-col max-h-[85vh]">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-zinc-500">hooks</div>
            <div className="text-sm font-mono text-zinc-900 truncate">.claude/settings.json</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mode === "read" ? (
              <button type="button" onClick={() => setMode("edit")} disabled={busy} className="px-3 py-1 text-xs font-medium rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Edit raw</button>
            ) : (
              <span className="text-xs text-zinc-500">{dirty ? "modified" : "no changes"}</span>
            )}
            <button type="button" onClick={closeIfClean} disabled={saving} className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50" aria-label="Close">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 bg-zinc-50">
          {loading && <div className="text-sm text-zinc-500">Loading…</div>}
          {!loading && mode === "read" && settings && (
            <div className="space-y-4">
              {EVENT_ORDER.map((evt) => {
                const groups = settings.hooks?.[evt] ?? [];
                if (groups.length === 0) return null;
                return (
                  <section key={evt}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">{evt}</div>
                    <div className="space-y-2">
                      {groups.map((g, i) => (
                        <div key={i} className="bg-white border border-zinc-200 rounded-lg p-3 space-y-2">
                          {g.matcher && <div className="text-[11px] font-mono text-zinc-500">matcher: <span className="text-zinc-900">{g.matcher}</span></div>}
                          {(g.hooks ?? []).map((h, j) => (
                            <div key={j} className="text-xs space-y-0.5">
                              {h.if && <div className="font-mono text-amber-700">if: {h.if}</div>}
                              <div className="font-mono text-zinc-900 break-all">{h.command || "(no command)"}</div>
                              {h.statusMessage && <div className="text-zinc-500 italic">{h.statusMessage}</div>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
              {!settings.hooks && <div className="text-sm text-zinc-500">No hooks configured.</div>}
            </div>
          )}
          {!loading && mode === "read" && parsed && !parsed.ok && (
            <div className="text-sm text-rose-600">Settings file has invalid JSON: {parsed.error}. Use Edit raw to fix.</div>
          )}
          {!loading && content !== null && mode === "edit" && (
            <textarea value={content} onChange={(e) => setContent(e.target.value)} disabled={saving} spellCheck={false}
              className="w-full min-h-[60vh] px-3 py-2 text-xs font-mono leading-relaxed border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-500 bg-white disabled:bg-zinc-50" />
          )}
        </div>
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center gap-2">
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
