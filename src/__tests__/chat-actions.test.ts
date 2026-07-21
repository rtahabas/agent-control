import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { postAnswer, postDecide } from "@/lib/chat-actions";
import type { ChatMessage } from "@/lib/chat-types";

function harness(initial: ChatMessage[]) {
  let messages = initial;
  return {
    setMessages: (u: (a: ChatMessage[]) => ChatMessage[]) => { messages = u(messages); },
    setError: vi.fn(),
    get messages() { return messages; },
  };
}

const questionMsg = (): ChatMessage => ({
  id: "q", role: "question", text: "",
  question: {
    tool_use_id: "t1",
    questions: [{ question: "Which?", header: "H", multiSelect: false, options: [] }],
    status: "pending",
  },
});

const permMsg = (): ChatMessage => ({
  id: "p", role: "permission", text: "",
  permission: { tool_use_id: "t1", tool_name: "Bash", input: {}, status: "pending" },
});

const respond = (status: number) =>
  vi.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300 });

beforeEach(() => { vi.stubGlobal("fetch", respond(200)); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("postAnswer", () => {
  it("marks the card answered when the server took it", async () => {
    const h = harness([questionMsg()]);
    await postAnswer("t1", { Which: "A" }, h.setMessages, h.setError);
    expect(h.messages[0].question?.status).toBe("answered");
    expect(h.setError).not.toHaveBeenCalled();
  });

  it("does not claim answered when the request is already gone", async () => {
    // 404 = the run ended or the question was resolved elsewhere. Reporting
    // success here is how an unheard answer looked exactly like a heard one.
    vi.stubGlobal("fetch", respond(404));
    const h = harness([questionMsg()]);
    await postAnswer("t1", { Which: "A" }, h.setMessages, h.setError);
    expect(h.messages[0].question?.status).toBe("expired");
  });

  it("surfaces a server failure instead of swallowing it", async () => {
    vi.stubGlobal("fetch", respond(500));
    const h = harness([questionMsg()]);
    await postAnswer("t1", { Which: "A" }, h.setMessages, h.setError);
    expect(h.setError).toHaveBeenCalledWith(expect.stringContaining("500"));
  });
});

describe("postDecide", () => {
  it("records an accepted decision", async () => {
    const h = harness([permMsg()]);
    await postDecide("t1", "allow", false, h.setMessages, h.setError);
    expect(h.messages[0].permission?.status).toBe("allowed");
  });

  it("expires the card when the server forgot the request", async () => {
    vi.stubGlobal("fetch", respond(410));
    const h = harness([permMsg()]);
    await postDecide("t1", "allow", false, h.setMessages, h.setError);
    expect(h.messages[0].permission?.status).toBe("expired");
  });

  it("surfaces a server failure instead of swallowing it", async () => {
    vi.stubGlobal("fetch", respond(500));
    const h = harness([permMsg()]);
    await postDecide("t1", "deny", false, h.setMessages, h.setError);
    expect(h.setError).toHaveBeenCalledWith(expect.stringContaining("500"));
  });
});
