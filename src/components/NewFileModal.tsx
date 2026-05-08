"use client";

import { useEffect, useRef, useState } from "react";
import { createMemoryFile } from "@/lib/memory-api";
import { Field, ModalShell } from "./editor/Field";

const NAME_RE = /^[A-Za-z0-9._-]+\.md$/;

interface Props {
  agentId: string;
  onClose: () => void;
  onCreated: (file: string) => void;
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-500 disabled:bg-zinc-50";

export function NewFileModal({ agentId, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose, busy]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!NAME_RE.test(trimmed)) {
      setError("Name must match [A-Za-z0-9._-]+.md (e.g. feedback_xyz.md)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createMemoryFile(agentId, trimmed, content);
      onCreated(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} busy={busy} wide>
      <form onSubmit={submit}>
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-base font-semibold text-zinc-900">New memory file</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Creates a new file under this agent&apos;s <code>memory/</code> directory.</p>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <Field label="Filename" required hint="e.g. feedback_xyz.md, project_release_20260508.md">
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={busy}
              placeholder="feedback_xyz.md"
              pattern="[A-Za-z0-9._-]+\.md"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field label="Content">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={busy}
              rows={14}
              spellCheck={false}
              placeholder="# Title&#10;&#10;Body…"
              className={`${inputCls} font-mono text-xs leading-relaxed resize-none min-h-[40vh]`}
            />
          </Field>
          {error && (
            <div className="text-xs px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-rose-700">{error}</div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed">{busy ? "Creating…" : "Create"}</button>
        </div>
      </form>
    </ModalShell>
  );
}
