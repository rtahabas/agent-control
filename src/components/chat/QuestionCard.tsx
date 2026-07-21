"use client";

import { useState } from "react";
import type { QuestionRequest, QuestionItem } from "@/lib/chat-types";

type AnswerFn = (toolUseId: string, answers: Record<string, string>) => void;

export function QuestionCard({
  req,
  onAnswer,
}: {
  req: QuestionRequest;
  onAnswer?: AnswerFn;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const pending = req.status === "pending";
  const finalAnswers = req.answers ?? draft;
  const allAnswered = req.questions.every((q) => (pending ? draft[q.question] : finalAnswers[q.question]));

  const submit = () => {
    if (!pending || !allAnswered || !onAnswer) return;
    onAnswer(req.tool_use_id, draft);
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] w-full border rounded-lg bg-white border-blue-200 overflow-hidden">
        <Header count={req.questions.length} pending={pending} />
        <div className="divide-y divide-zinc-100">
          {req.questions.map((q, i) => (
            <Question
              key={i}
              q={q}
              selected={pending ? draft[q.question] : finalAnswers[q.question]}
              onSelect={(label) =>
                pending && setDraft((d) => ({ ...d, [q.question]: label }))
              }
              pending={pending}
              numbered={pending && req.questions.length === 1}
            />
          ))}
        </div>
        {pending && (
          <div className="px-3 py-2 border-t border-zinc-200 bg-zinc-50">
            <button
              type="button"
              onClick={submit}
              disabled={!allAnswered}
              className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ count, pending }: { count: number; pending: boolean }) {
  return (
    <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-xs">
      <span className="font-medium text-blue-900">
        {pending ? "Question for you" : "Answered"}
      </span>
      <span className="mono text-zinc-500 ml-auto">
        {count} item{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function Question({
  q, selected, onSelect, pending, numbered,
}: {
  q: QuestionItem;
  selected: string | undefined;
  onSelect: (label: string) => void;
  pending: boolean;
  numbered: boolean;
}) {
  return (
    <div className="px-3 py-3 space-y-2">
      <div className="text-xs font-medium text-zinc-900">{q.question}</div>
      <div className="flex flex-wrap gap-1.5">
        {q.options.map((opt, i) => {
          const isSelected = selected === opt.label;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onSelect(opt.label)}
              disabled={!pending}
              title={opt.description}
              className={`text-xs px-2.5 py-1 rounded-md border transition ${
                isSelected
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400 disabled:opacity-60"
              }`}
            >
              {numbered && i < 9 && (
                <kbd className="mr-1.5 px-1 rounded bg-black/15 mono text-[10px] leading-none py-0.5">
                  {i + 1}
                </kbd>
              )}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
