"use client";

import { Markdown } from "../Markdown";
import { attachmentDataUrl, type ChatMessage, type ToolCall } from "@/lib/chat-types";
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
  // Only what you said is a bubble. The reply is prose on the page — boxing it
  // turns a conversation into a form, and it was also the widest border on the
  // screen repeated once per turn. The bubble uses the app's one accent rather
  // than a blue of its own: a second accent makes the first mean less.
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-br-md bg-accent-soft px-4 py-2.5 text-zinc-900"
            : "w-full text-zinc-900"
        }
      >
        {message.attachment && message.attachment.kind === "image" && (
          <img
            src={attachmentDataUrl(message.attachment)}
            alt={message.attachment.name}
            className="mb-2 max-h-64 max-w-full rounded-xl"
          />
        )}
        {isUser ? (
          message.text && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</div>
          )
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
      {/* A tool call is a footnote to the answer, not a peer of it. No border,
          no ground — it steps back until you look for it. */}
      <div className="max-w-full flex items-center gap-2 text-xs text-zinc-400 py-0.5">
        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${streaming ? "bg-amber-500 blink" : "bg-emerald-500"}`} />
        <span className="font-medium text-zinc-500 mono">{tool.name}</span>
        {preview && (
          <span className="mono text-zinc-400 truncate" title={preview}>
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
