import { describe, it, expect } from "vitest";
import { settleOpenCards } from "@/lib/chat-dispatch";
import type { ChatMessage } from "@/lib/chat-types";

const permission = (status: "pending" | "allowed"): ChatMessage => ({
  id: "p",
  role: "permission",
  text: "",
  permission: { tool_use_id: "t1", tool_name: "Bash", input: {}, status },
});

const question = (status: "pending" | "answered"): ChatMessage => ({
  id: "q",
  role: "question",
  text: "",
  question: {
    tool_use_id: "t2",
    questions: [{ question: "Which?", header: "H", multiSelect: false, options: [] }],
    status,
  },
});

describe("settleOpenCards", () => {
  it("closes a permission card the ended run can no longer answer", () => {
    // Otherwise the card keeps offering Allow/Reject after the stream is gone.
    const [m] = settleOpenCards([permission("pending")]);
    expect(m.permission?.status).toBe("expired");
  });

  it("closes an unanswered question card", () => {
    const [m] = settleOpenCards([question("pending")]);
    expect(m.question?.status).toBe("expired");
  });

  it("leaves a decision the user already made untouched", () => {
    const [m] = settleOpenCards([permission("allowed")]);
    expect(m.permission?.status).toBe("allowed");
  });

  it("does not relabel an answered question as expired", () => {
    const [m] = settleOpenCards([question("answered")]);
    expect(m.question?.status).toBe("answered");
  });

  it("passes ordinary messages through unchanged", () => {
    const msgs: ChatMessage[] = [{ id: "1", role: "user", text: "hi" }];
    expect(settleOpenCards(msgs)).toEqual(msgs);
  });
});
