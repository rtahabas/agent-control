"use client";

import type { State } from "@/lib/api";
import { Hooks } from "../overview/Misc";

interface Props {
  state: State | null;
  onManage?: () => void;
}

export function HooksPage({ state, onManage }: Props) {
  if (!state) return <div className="p-8 text-sm text-zinc-400">Loading…</div>;
  return (
    <div className="p-6 max-w-3xl">
      <Hooks hooks={state.hooks} onManageClick={onManage} />
      <p className="mt-4 text-xs text-zinc-500">
        Click <span className="text-zinc-700">Manage</span> to open the raw{" "}
        <span className="mono">settings.json</span> hooks editor.
      </p>
    </div>
  );
}
