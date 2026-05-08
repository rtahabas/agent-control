"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
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

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-zinc prose-pre:bg-zinc-100 prose-pre:text-zinc-800 prose-code:text-zinc-800 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...rest }) {
            const match = /language-(\w+)/.exec(className || "");
            const value = String(children).replace(/\n$/, "");
            if (match) {
              return (
                <SyntaxHighlighter
                  language={match[1]}
                  style={oneLight}
                  PreTag="div"
                  customStyle={{ margin: 0, borderRadius: 8, fontSize: 12 }}
                >
                  {value}
                </SyntaxHighlighter>
              );
            }
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
