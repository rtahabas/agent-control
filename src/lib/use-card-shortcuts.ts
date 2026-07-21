"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/chat-types";
import { keyToPermDecision, keyToOptionIndex, shortcutAllowed } from "@/lib/perm-keys";

type Decide = (toolUseId: string, decision: "allow" | "deny", always?: boolean) => void;
type Answer = (toolUseId: string, answers: Record<string, string>) => void;

/**
 * Answers the card on screen from the number keys, mirroring the CLI prompt:
 * 1 = Allow, 2 = Reject, 3 = Allow always; on a single-question card, 1..N picks
 * that option and submits. Permission wins if both are somehow pending.
 *
 * `visible` matters: the chat panel stays mounted behind the other tabs so runs
 * keep streaming, so being mounted says nothing about being looked at — and a
 * key that decides a card you cannot see is an accident, not a shortcut.
 */
export function useCardShortcuts(
  messages: ChatMessage[],
  visible: boolean,
  decide: Decide,
  answer: Answer
) {
  // Track the pending permission card and the pending single-question card in refs,
  // so the keydown listener stays stable instead of re-binding on every message.
  // The question shortcut is only offered when there is exactly ONE question — with
  // multiple questions a bare digit is ambiguous (which question?), so we fall back
  // to clicking there.
  const pendingPermRef = useRef<string | null>(null);
  const pendingQuestionRef = useRef<{
    toolUseId: string;
    question: string;
    options: string[];
  } | null>(null);
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    const perm = messages.find(
      (m) => m.role === "permission" && m.permission?.status === "pending"
    );
    pendingPermRef.current = perm?.permission?.tool_use_id ?? null;

    const q = messages.find(
      (m) => m.role === "question" && m.question?.status === "pending"
    )?.question;
    pendingQuestionRef.current =
      q && q.questions.length === 1
        ? {
            toolUseId: q.tool_use_id,
            question: q.questions[0].question,
            options: q.questions[0].options.map((o) => o.label),
          }
        : null;
  }, [messages]);

  // Keyboard shortcuts mirroring the CLI's numbered prompt so a card can be answered
  // without the mouse. Permission card: 1 = Allow, 2 = Reject, 3 = Allow always.
  // Single-question card: 1..N picks that option and submits. Permission takes
  // priority if both are somehow pending.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        !shortcutAllowed({
          chatVisible: visibleRef.current,
          documentHidden: document.hidden,
          target: document.activeElement,
          modifiers: { meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey },
        })
      ) {
        return;
      }

      const permId = pendingPermRef.current;
      if (permId) {
        const mapped = keyToPermDecision(e.key);
        if (!mapped) return;
        e.preventDefault();
        decide(permId, mapped.decision, mapped.always);
        return;
      }

      const q = pendingQuestionRef.current;
      if (q) {
        const idx = keyToOptionIndex(e.key, q.options.length);
        if (idx === null) return;
        e.preventDefault();
        answer(q.toolUseId, { [q.question]: q.options[idx] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, answer]);

}
