"use client";

import { useCallback, useEffect, useState } from "react";

async function readJsonTools(res: Response): Promise<string[]> {
  if (!res.ok) return [];
  const body = (await res.json()) as { tools?: string[] };
  return body.tools ?? [];
}

/**
 * Surfaces the tools this session auto-allows (granted by an earlier "Allow
 * always") and lets them be taken back. Those tools skip the permission card
 * entirely, so without this a stray "Allow always" — one keystroke away —
 * silently waives approval for the rest of the session with nothing to show
 * for it. Renders nothing while the list is empty.
 */
export function AllowlistChip({
  sessionId,
  refreshKey,
}: {
  sessionId: string | null;
  refreshKey: number;
}) {
  const [tools, setTools] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setTools([]);
      return;
    }
    const res = await fetch(`/api/chat/allowlist?session_id=${encodeURIComponent(sessionId)}`);
    setTools(await readJsonTools(res));
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const revoke = useCallback(
    async (tool?: string) => {
      if (!sessionId) return;
      const qs = new URLSearchParams({ session_id: sessionId });
      if (tool) qs.set("tool", tool);
      const res = await fetch(`/api/chat/allowlist?${qs.toString()}`, { method: "DELETE" });
      setTools(await readJsonTools(res));
    },
    [sessionId]
  );

  if (tools.length === 0) return null;

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Tools this session allows without asking. Click to review or revoke."
        className="text-xs px-2 py-1 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
      >
        {tools.length} auto-allowed
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 w-60 rounded-md border border-zinc-200 bg-white shadow-lg p-2 space-y-1">
          {tools.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="mono text-zinc-700 truncate flex-1">{t}</span>
              <button
                onClick={() => void revoke(t)}
                className="text-xs px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              >
                Revoke
              </button>
            </div>
          ))}
          <button
            onClick={() => void revoke()}
            className="w-full text-xs px-2 py-1 rounded bg-rose-600 text-white font-medium hover:bg-rose-700"
          >
            Revoke all
          </button>
        </div>
      )}
    </div>
  );
}
