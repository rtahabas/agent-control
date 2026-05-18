"use client";

import { useState } from "react";

interface Props {
  busy: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
}

// Composer owns its own input state so a keystroke does not re-render
// the parent ChatPanel — that re-render would walk every Bubble and
// every Markdown/SyntaxHighlighter underneath, which adds 50-200ms of
// jank per character on a busy conversation.
export function Composer({ busy, onSend, onCancel }: Props) {
  const [input, setInput] = useState("");

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    onSend(text);
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        disabled={busy}
        placeholder="Mesaj yaz, Enter ile gönder (Shift+Enter satır)"
        rows={2}
        className="flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 disabled:bg-zinc-50 disabled:opacity-60"
      />
      {busy ? (
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700"
        >
          Stop
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={!input.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      )}
    </div>
  );
}
