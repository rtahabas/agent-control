"use client";

import { Markdown } from "../Markdown";
import type { ChatMessage } from "@/lib/chat-types";

export function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white border border-zinc-200 text-zinc-900"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</div>
        ) : message.text === "" && message.streaming ? (
          <Dots />
        ) : (
          <Markdown text={message.text} />
        )}
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-1 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 blink" />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 blink" style={{ animationDelay: "0.2s" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 blink" style={{ animationDelay: "0.4s" }} />
    </span>
  );
}
