"use client";

import { Field } from "./Field";

export interface IdentityState {
  role: string;
  mission: string;
  language: string;
  personality: string;
  human: string;
}

export const EMPTY_IDENTITY: IdentityState = {
  role: "",
  mission: "",
  language: "",
  personality: "",
  human: "",
};

interface Props {
  value: IdentityState;
  onChange: (next: IdentityState) => void;
  disabled?: boolean;
}

const cls =
  "w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-500 disabled:bg-zinc-50";

export function PersonalityFields({ value, onChange, disabled }: Props) {
  const set = <K extends keyof IdentityState>(k: K, v: string) => onChange({ ...value, [k]: v });
  return (
    <>
      <Field label="Role" hint="e.g. Senior frontend engineer">
        <input type="text" value={value.role} onChange={(e) => set("role", e.target.value)} disabled={disabled} placeholder="(falls back to default)" className={cls} />
      </Field>
      <Field label="Mission" hint="one sentence — what this agent ships">
        <input type="text" value={value.mission} onChange={(e) => set("mission", e.target.value)} disabled={disabled} placeholder="(falls back to default)" className={cls} />
      </Field>
      <Field label="Language" hint="e.g. Turkish chat / English code">
        <input type="text" value={value.language} onChange={(e) => set("language", e.target.value)} disabled={disabled} placeholder="(falls back to default)" className={cls} />
      </Field>
      <Field label="Personality" hint="one line of traits">
        <input type="text" value={value.personality} onChange={(e) => set("personality", e.target.value)} disabled={disabled} placeholder="(falls back to default)" className={cls} />
      </Field>
      <Field label="Human handle" hint="optional · the user this agent works for">
        <input type="text" value={value.human} onChange={(e) => set("human", e.target.value)} disabled={disabled} placeholder="(unset)" className={cls} />
      </Field>
    </>
  );
}
