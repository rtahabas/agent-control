"use client";

import { useEffect, useState } from "react";

interface Status {
  configured: boolean;
  chat_id: string | null;
  bot_token_set: boolean;
}

interface Props {
  agentName?: string;
}

export function TelegramSettings({ agentName }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/telegram/status", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  const sendTest = async () => {
    setSending(true); setResult(null); setError(null);
    try {
      const r = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: agentName }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "send failed");
      setResult("Sent — check your Telegram.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-white rounded-lg border border-zinc-200 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Telegram notifications</h3>
          <div className="text-xs text-zinc-400 mt-0.5">Outbound — agent → your Telegram chat</div>
        </div>
        {status && (
          <span
            className={`text-[11px] px-2 py-0.5 rounded border ${
              status.configured
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {status.configured ? "configured" : "not configured"}
          </span>
        )}
      </div>
      {loading ? (
        <div className="text-xs text-zinc-500">Checking…</div>
      ) : status?.configured ? (
        <div className="text-xs text-zinc-600">
          Bot token set · chat <span className="mono text-zinc-900">{status.chat_id}</span>
        </div>
      ) : (
        <div className="text-xs text-zinc-600 space-y-2">
          <div>Set these in <span className="mono">.env.local</span> and restart the dev server:</div>
          <pre className="text-[11px] bg-zinc-50 border border-zinc-200 rounded px-2 py-1.5 mono whitespace-pre-wrap">{`TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...`}</pre>
          <div>
            Token: from{" "}
            <a className="underline" href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a>{" "}
            (<span className="mono">/newbot</span>). Chat ID: open the bot, send any message, then visit{" "}
            <span className="mono">https://api.telegram.org/bot&lt;token&gt;/getUpdates</span> and copy{" "}
            <span className="mono">message.chat.id</span>.
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={sendTest}
          disabled={sending || !status?.configured}
          className="text-xs px-3 py-1.5 rounded-md bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? "Sending…" : "Send test"}
        </button>
        {result && <span className="text-xs text-emerald-700">{result}</span>}
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
      <details className="text-xs text-zinc-500 mt-1">
        <summary className="cursor-pointer hover:text-zinc-700">Hook snippet (Stop event)</summary>
        <pre className="mt-2 text-[11px] bg-zinc-50 border border-zinc-200 rounded px-2 py-1.5 mono whitespace-pre-wrap">{`# In .claude/settings.json hooks.Stop:
{
  "type": "command",
  "command": "curl -s -X POST http://localhost:3000/api/telegram/notify -H 'Content-Type: application/json' -d '{\\"event\\":\\"stop\\",\\"agent\\":\\"agent-one\\",\\"message\\":\\"session ended\\"}' >/dev/null"
}`}</pre>
      </details>
    </section>
  );
}
