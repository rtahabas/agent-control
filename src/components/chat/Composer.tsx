"use client";

import { useRef, useState } from "react";
import {
  ALLOWED_IMAGE_MIMES,
  MAX_ATTACHMENT_BYTES,
  attachmentDataUrl,
  isAllowedImageMime,
  type Attachment,
  type ImageAttachment,
} from "@/lib/chat-types";

interface Props {
  busy: boolean;
  onSend: (text: string, attachment: Attachment | null) => void;
  onCancel: () => void;
}

const ACCEPT = ALLOWED_IMAGE_MIMES.join(",");

function fileToImageAttachment(file: File): Promise<ImageAttachment | string> {
  return new Promise((resolve) => {
    if (!isAllowedImageMime(file.type)) {
      resolve(`Unsupported type: ${file.type || "unknown"}. PNG / JPEG / WEBP / GIF only.`);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      resolve(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Limit is 5MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        resolve("Failed to read file");
        return;
      }
      const comma = result.indexOf(",");
      const dataBase64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({
        kind: "image",
        mime: file.type as ImageAttachment["mime"],
        name: file.name || "pasted-image",
        size: file.size,
        dataBase64,
      });
    };
    reader.onerror = () => resolve("Failed to read file");
    reader.readAsDataURL(file);
  });
}

// Composer owns its own input state so a keystroke does not re-render
// the parent ChatPanel — that re-render would walk every Bubble and
// every Markdown/SyntaxHighlighter underneath, which adds 50-200ms of
// jank per character on a busy conversation.
export function Composer({ busy, onSend, onCancel }: Props) {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const text = input.trim();
    if (!text && !attachment) return;
    setInput("");
    setAttachment(null);
    setError(null);
    onSend(text, attachment);
  };

  const handleFile = async (file: File) => {
    setError(null);
    const result = await fileToImageAttachment(file);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    setAttachment(result);
  };

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
    // Reset so re-selecting the same file fires onChange again.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file && file.type.startsWith("image/")) {
          e.preventDefault();
          await handleFile(file);
          return;
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {attachment && (
        <div className="flex items-start gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-2">
          <img
            src={attachmentDataUrl(attachment)}
            alt={attachment.name}
            className="h-16 w-16 rounded object-cover border border-zinc-200"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-zinc-900 truncate">{attachment.name}</div>
            <div className="text-[11px] text-zinc-500">
              {attachment.mime.split("/")[1].toUpperCase()} · {(attachment.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1"
            aria-label="Remove attachment"
          >
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1">
          {error}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileInputChange}
          className="hidden"
          aria-label="Attach image"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Attach image"
          title="Attach image (or paste with Cmd+V)"
        >
          📎
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={onPaste}
          disabled={busy}
          placeholder="Mesaj yaz, Enter ile gönder (Shift+Enter satır, Cmd+V resim yapıştır)"
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
            disabled={!input.trim() && !attachment}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
