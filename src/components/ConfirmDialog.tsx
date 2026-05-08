"use client";

import { useState } from "react";
import { ModalShell } from "./editor/Field";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} busy={busy}>
      <div className="px-5 py-4">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <p className="text-sm text-zinc-600 mt-1.5">{message}</p>
        {error && (
          <div className="mt-3 text-xs px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-rose-700">
            {error}
          </div>
        )}
      </div>
      <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-40 ${
            destructive ? "bg-rose-600 hover:bg-rose-700" : "bg-zinc-900 hover:bg-zinc-700"
          }`}
        >
          {busy ? "..." : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
