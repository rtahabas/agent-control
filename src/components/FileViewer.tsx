"use client";

import { useEffect, useState } from "react";
import { fetchMemoryFile, saveMemoryFile } from "@/lib/memory-api";
import { Markdown } from "./Markdown";
import { ModalShell } from "./editor/Field";

interface Props {
  agentId: string;
  file: string;
  onClose: () => void;
}

type Mode = "read" | "edit";

export function FileViewer({ agentId, file, onClose }: Props) {
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
    setLoading(true);
    setError(null);
    fetchMemoryFile(agentId, file)
      .then((c) => {
        if (!alive) return;
        setContent(c);
        setOriginal(c);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [agentId, file]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !dirty) onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose, busy, dirty]);

  const closeIfClean = () => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    onClose();
  };

  const save = async () => {
    if (content === null || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveMemoryFile(agentId, file, content);
      setOriginal(content);
      setMode("read");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    if (original !== null) setContent(original);
    setMode("read");
    setError(null);
  };

  return (
    <ModalShell onClose={closeIfClean} busy={busy} wide>
      <div className="flex flex-col max-h-[85vh]">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-zinc-500">memory</div>
            <div className="text-sm font-mono text-zinc-900 truncate">{file}</div>
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
          {!loading && content !== null && mode === "read" && <Markdown text={content} />}
          {!loading && content !== null && mode === "edit" && (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={saving}
              spellCheck={false}
              className="w-full min-h-[60vh] px-3 py-2 text-xs font-mono leading-relaxed border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-500 bg-white disabled:bg-zinc-50"
            />
          )}
        </div>
        {(error || mode === "edit") && (
          <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-end gap-2">
            {error && <div className="mr-auto text-xs text-rose-600">{error}</div>}
            {mode === "edit" && (
              <>
                <button type="button" onClick={revert} disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Cancel</button>
                <button type="button" onClick={save} disabled={!dirty || saving} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Saving…" : "Save"}</button>
              </>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
