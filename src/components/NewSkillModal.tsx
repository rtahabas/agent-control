"use client";

import { useEffect, useRef, useState } from "react";
import { createAgentSkill } from "@/lib/agent-skills-api";
import { Field, ModalShell } from "./editor/Field";

const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

interface Props {
  agentId: string;
  onClose: () => void;
  onCreated: (name: string) => void;
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-500 disabled:bg-zinc-50";

function defaultContent(name: string): string {
  const safe = name || "<skill-name>";
  return `---\nname: ${safe}\ndescription: \n---\n\n# ${safe}\n\n_(skill body)_\n`;
}

export function NewSkillModal({ agentId, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [content, setContent] = useState(defaultContent(""));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose, busy]);

  const onNameChange = (next: string) => {
    setName(next);
    if (!touched) setContent(defaultContent(next));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!NAME_RE.test(trimmed)) {
      setError("Name must match [a-z0-9][a-z0-9_-]* (kebab-case, e.g. my-skill)");
      return;
    }
    setBusy(true); setError(null);
    try {
      await createAgentSkill(agentId, trimmed, content);
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
          <h3 className="text-base font-semibold text-zinc-900">New skill</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Creates <code>.claude/skills/&lt;name&gt;/SKILL.md</code> under this agent.</p>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <Field label="Skill name" required hint="kebab-case · e.g. my-skill">
            <input ref={nameRef} type="text" value={name} onChange={(e) => onNameChange(e.target.value)} required disabled={busy} placeholder="my-skill" pattern="[a-z0-9][a-z0-9_-]*" className={`${inputCls} font-mono`} />
          </Field>
          <Field label="SKILL.md content" hint="frontmatter (name + description) above, body below">
            <textarea value={content} onChange={(e) => { setContent(e.target.value); setTouched(true); }} disabled={busy} rows={16} spellCheck={false}
              className={`${inputCls} font-mono text-xs leading-relaxed resize-none min-h-[40vh]`} />
          </Field>
          {error && <div className="text-xs px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-rose-700">{error}</div>}
        </div>
        <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed">{busy ? "Creating…" : "Create"}</button>
        </div>
      </form>
    </ModalShell>
  );
}
