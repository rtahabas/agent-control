"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent } from "@/lib/api";
import { applyAgentEdit } from "@/lib/agent-edit";
import { applyAgentCreate, type CreateMode } from "@/lib/agent-create";
import { Field, ModalShell } from "./editor/Field";
import { PersonalityFields, EMPTY_IDENTITY, type IdentityState } from "./editor/PersonalityFields";
import { SkillsPicker } from "./editor/SkillsPicker";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  agent?: Agent | null;
  onClose: () => void;
  onSaved: (agent: Agent) => void;
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-500 disabled:bg-zinc-50";

export function AgentEditor({ mode, agent, onClose, onSaved }: Props) {
  const [name, setName] = useState(agent?.name ?? "");
  const [path, setPath] = useState(agent?.path ?? "");
  const [id, setId] = useState(agent?.id ?? "");
  const [notes, setNotes] = useState(agent?.notes ?? "");
  const [createMode, setCreateMode] = useState<CreateMode>("scaffold");
  const [identity, setIdentity] = useState<IdentityState>(EMPTY_IDENTITY);
  const [skills, setSkills] = useState<Set<string>>(new Set());
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

  const isCreate = mode === "create";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const saved = isCreate
        ? await applyAgentCreate({
            mode: createMode,
            id: id.trim(),
            name: name.trim(),
            path: path.trim(),
            notes: notes.trim(),
            identity,
            skills: Array.from(skills),
          })
        : await applyAgentEdit(agent!, { name: name.trim(), path: path.trim(), notes: notes.trim() });
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const subtitle = isCreate
    ? createMode === "scaffold"
      ? "Scaffold a fresh agent into an empty path."
      : "Register an existing directory as a managed agent."
    : `Editing ${agent?.name}`;

  return (
    <ModalShell onClose={onClose} busy={busy} wide={isCreate && createMode === "scaffold"}>
      <form onSubmit={submit}>
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-base font-semibold text-zinc-900">
            {isCreate ? "Add new agent" : "Edit agent"}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {isCreate && (
            <ModeToggle value={createMode} onChange={setCreateMode} disabled={busy} />
          )}
          <Field label="Name" required>
            <input ref={nameRef} type="text" value={name} onChange={(e) => setName(e.target.value)} required disabled={busy} placeholder="My Agent" className={inputCls} />
          </Field>
          <Field label="Path" required hint={createMode === "scaffold" && isCreate ? "absolute path · must be empty or non-existent" : "absolute path to a directory"}>
            <input type="text" value={path} onChange={(e) => setPath(e.target.value)} required disabled={busy} placeholder="/Users/you/agents/my-agent" className={`${inputCls} font-mono`} />
          </Field>
          {isCreate && (
            <Field label="ID" hint="optional · auto-derived from name (a-z, 0-9, _, -)">
              <input type="text" value={id} onChange={(e) => setId(e.target.value)} disabled={busy} placeholder="(auto)" pattern="[a-z0-9_-]*" className={`${inputCls} font-mono`} />
            </Field>
          )}
          <Field label="Notes">
            <textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} disabled={busy} rows={2} placeholder="(optional)" className={`${inputCls} resize-none`} />
          </Field>
          {isCreate && createMode === "scaffold" && (
            <>
              <div className="pt-2 border-t border-zinc-100">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Identity</div>
                <PersonalityFields value={identity} onChange={setIdentity} disabled={busy} />
              </div>
              <div className="pt-2 border-t border-zinc-100">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                  Skills <span className="text-zinc-400 font-normal normal-case">· enable from catalog</span>
                </div>
                <SkillsPicker selected={skills} onChange={setSkills} disabled={busy} />
              </div>
            </>
          )}
          {error && (
            <div className="text-xs px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-rose-700">{error}</div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || !name.trim() || !path.trim()} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {busy ? "Saving..." : isCreate ? (createMode === "scaffold" ? "Scaffold" : "Register") : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModeToggle({ value, onChange, disabled }: { value: CreateMode; onChange: (m: CreateMode) => void; disabled?: boolean }) {
  const pill = (m: CreateMode, label: string, hint: string) => (
    <button type="button" onClick={() => onChange(m)} disabled={disabled} className={`flex-1 text-left px-3 py-2 rounded-lg border text-sm transition ${value === m ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"} disabled:opacity-50`}>
      <div className="font-medium text-zinc-900">{label}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{hint}</div>
    </button>
  );
  return (
    <div className="flex gap-2">
      {pill("scaffold", "Scaffold new", "fresh tree from blank template")}
      {pill("register", "Register existing", "point at a directory you already manage")}
    </div>
  );
}
