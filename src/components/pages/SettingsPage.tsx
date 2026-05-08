"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchSettings, saveSettings } from "@/lib/settings-api";
import { TelegramSettings } from "./TelegramSettings";

interface Props {
  agentId: string | null;
  agentName?: string;
}

export function SettingsPage({ agentId, agentName }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!agentId) return;
    setLoading(true); setError(null);
    fetchSettings(agentId)
      .then((c) => { setContent(c); setOriginal(c); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => { load(); }, [load]);

  const dirty = content !== null && original !== null && content !== original;

  const save = async () => {
    if (!agentId || content === null) return;
    try { JSON.parse(content); }
    catch (e) { setError("invalid JSON: " + (e instanceof Error ? e.message : String(e))); return; }
    setSaving(true); setError(null);
    try { await saveSettings(agentId, content); setOriginal(content); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  if (!agentId) {
    return (
      <div className="p-6 max-w-4xl space-y-5">
        <TelegramSettings />
        <div className="text-sm text-zinc-400">Pick an agent in <span className="text-zinc-700">Agents</span> to edit its <span className="mono">.claude/settings.json</span>.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <TelegramSettings agentName={agentName} />
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide">Settings</h2>
          <div className="text-xs text-zinc-400 mono mt-1">.claude/settings.json</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={loading || saving} className="text-[11px] px-2 py-1 rounded border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Reload</button>
          <button type="button" onClick={save} disabled={!dirty || saving} className="text-xs px-3 py-1 rounded-md bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {loading && content === null && <div className="text-sm text-zinc-500">Loading…</div>}
      {error && <div className="mb-2 text-xs text-rose-600 mono">{error}</div>}
      {content !== null && (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          className="w-full h-[60vh] px-3 py-2 text-xs font-mono leading-relaxed border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-500 bg-white"
        />
      )}
      <p className="mt-3 text-[11px] text-zinc-400">
        JSON validates locally before save. Hook execution depends on the harness — restart Claude after editing hooks.
      </p>
    </div>
  );
}
