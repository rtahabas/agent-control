import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  EMPTY_RUN,
  __resetStore,
  asstRef,
  getRun,
  hydrateRun,
  resetRun,
  subscribeRun,
  updateRun,
} from "@/lib/chat-store";
import { makeDispatch } from "@/lib/chat-run-dispatch";

const A = "agent-a";
const B = "agent-b";

const sse = (event: string, payload: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(payload)}`;

beforeEach(() => {
  __resetStore();
  sessionStorage.clear();
});

describe("per-agent isolation", () => {
  it("keeps each agent's transcript to itself", () => {
    updateRun(A, (s) => ({ ...s, messages: [{ id: "1", role: "user", text: "hi A" }] }));
    expect(getRun(A).messages).toHaveLength(1);
    expect(getRun(B).messages).toHaveLength(0);
  });

  it("tracks busy per agent, so one run does not lock the other's composer", () => {
    updateRun(A, (s) => ({ ...s, busy: true }));
    expect(getRun(A).busy).toBe(true);
    expect(getRun(B).busy).toBe(false);
  });

  it("notifies only the subscribers of the agent that changed", () => {
    const onA = vi.fn();
    const onB = vi.fn();
    subscribeRun(A, onA);
    subscribeRun(B, onB);
    updateRun(A, (s) => ({ ...s, error: "boom" }));
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const cb = vi.fn();
    subscribeRun(A, cb)();
    updateRun(A, (s) => ({ ...s, error: "x" }));
    expect(cb).not.toHaveBeenCalled();
  });

  it("gives each agent its own streaming-message cell", () => {
    asstRef(A).current = "msg-a";
    expect(asstRef(B).current).toBeNull();
    expect(asstRef(A).current).toBe("msg-a");
  });
});

describe("dispatch is bound to the agent that started the run", () => {
  // The defect this replaces: the panel is one component, so a still-streaming
  // run wrote into whichever agent was selected when the event arrived.
  it("routes stream text to its own agent while another is selected", () => {
    const toA = makeDispatch(A, "Agent A");
    toA(sse("delta", { text: "from A" }));
    expect(getRun(A).messages.map((m) => m.text)).toEqual(["from A"]);
    expect(getRun(B).messages).toHaveLength(0);
  });

  it("files a permission card under the agent that asked for it", () => {
    const toA = makeDispatch(A, "Agent A");
    toA(
      sse("permission_request", {
        tool_use_id: "tool-1",
        tool_name: "Bash",
        input: { command: "ls" },
      })
    );
    const cardsA = getRun(A).messages.filter((m) => m.role === "permission");
    expect(cardsA).toHaveLength(1);
    expect(getRun(B).messages.filter((m) => m.role === "permission")).toHaveLength(0);
  });

  it("clears busy on the run's own agent when it finishes", () => {
    updateRun(A, (s) => ({ ...s, busy: true }));
    updateRun(B, (s) => ({ ...s, busy: true }));
    makeDispatch(A, "Agent A")(sse("done", { subtype: "success", num_turns: 2 }));
    expect(getRun(A).busy).toBe(false);
    expect(getRun(B).busy).toBe(true);
  });

  it("records the session id against its own agent", () => {
    makeDispatch(A, "Agent A")(sse("session", { id: "sess-a" }));
    expect(getRun(A).sessionId).toBe("sess-a");
    expect(getRun(B).sessionId).toBeNull();
  });
});

describe("hydrateRun", () => {
  it("restores a persisted transcript on first sight of an agent", () => {
    sessionStorage.setItem(
      "chat:" + A,
      JSON.stringify({ messages: [{ id: "1", role: "user", text: "old" }], sessionId: "s1" })
    );
    hydrateRun(A);
    expect(getRun(A).messages).toHaveLength(1);
    expect(getRun(A).sessionId).toBe("s1");
  });

  it("does not roll a live run back when you switch away and return", () => {
    // Switching back re-runs the mount effect; re-reading storage there would
    // discard whatever the still-streaming run produced since the last write.
    // The stale snapshot below is the real case: persistence swallows a quota
    // error, so what is on disk can lag well behind the live transcript.
    hydrateRun(A);
    updateRun(A, (s) => ({ ...s, messages: [{ id: "2", role: "assistant", text: "live" }] }));
    sessionStorage.setItem(
      "chat:" + A,
      JSON.stringify({ messages: [{ id: "1", role: "user", text: "stale" }], sessionId: null })
    );
    hydrateRun(A);
    expect(getRun(A).messages.map((m) => m.text)).toEqual(["live"]);
  });
});

describe("resetRun", () => {
  it("drops the session so a cleared chat does not resume the old history", () => {
    updateRun(A, (s) => ({
      ...s,
      sessionId: "sess-a",
      messages: [{ id: "1", role: "user", text: "hi" }],
    }));
    resetRun(A);
    expect(getRun(A).sessionId).toBeNull();
    expect(getRun(A).messages).toHaveLength(0);
    expect(getRun(A).stats).toEqual(EMPTY_RUN.stats);
  });

  it("leaves a run in flight alone", () => {
    updateRun(A, (s) => ({ ...s, busy: true, sessionId: "sess-a" }));
    resetRun(A);
    expect(getRun(A).busy).toBe(true);
  });
});
