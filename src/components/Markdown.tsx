"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

export function Markdown({ text }: { text: string }) {
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
