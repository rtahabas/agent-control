"use client";

import { Markdown } from "../Markdown";
import type { ChatMessage, ToolCall } from "@/lib/chat-types";
import { PermissionCard } from "./PermissionCard";
import { QuestionCard } from "./QuestionCard";
import { toolPreview } from "@/lib/tool-preview";

type DecideFn = (toolUseId: string, decision: "allow" | "deny", always?: boolean) => void;
type AnswerFn = (toolUseId: string, answers: Record<string, string>) => void;

export function Bubble({
  message, onDecide, onAnswer,
}: { message: ChatMessage; onDecide?: DecideFn; onAnswer?: AnswerFn }) {
  if (message.role === "tool" && message.tool) {
    return <ToolEntry tool={message.tool} streaming={!!message.streaming} />;
  }
  if (message.role === "permission" && message.permission) {
    return <PermissionCard req={message.permission} onDecide={onDecide} />;
  }
  if (message.role === "question" && message.question) {
    return <QuestionCard req={message.question} onAnswer={onAnswer} />;
  }
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser ? "bg-blue-600 text-white" : "bg-white border border-zinc-200 text-zinc-900"
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

function ToolEntry({ tool, streaming }: { tool: ToolCall; streaming: boolean }) {
  const preview = toolPreview(tool.input);
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] flex items-center gap-2 text-xs text-zinc-600 border border-zinc-200 bg-zinc-50 rounded-md px-2.5 py-1.5">
        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${streaming ? "bg-amber-500 blink" : "bg-emerald-500"}`} />
        <span className="font-medium text-zinc-800 mono">{tool.name}</span>
        {preview && (
          <span className="mono text-zinc-500 truncate" title={preview}>
            {preview}
          </span>
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
