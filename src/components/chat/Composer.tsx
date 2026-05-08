"use client";

interface Props {
  input: string;
  setInput: (s: string) => void;
  busy: boolean;
  onSend: () => void;
  onCancel: () => void;
}

export function Composer({ input, setInput, busy, onSend, onCancel }: Props) {
  return (
    <div className="flex items-end gap-2">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
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
          onClick={onSend}
          disabled={!input.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      )}
    </div>
  );
}
