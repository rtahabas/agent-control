import { describe, it, expect, afterEach, vi } from "vitest";
import { runNotification, showNotice } from "@/lib/run-notify";

describe("runNotification", () => {
  it("summarizes a successful run with what it actually cost", () => {
    const n = runNotification(
      { subtype: "success", numTurns: 12, costUsd: 0.3421, durationMs: 72_000 },
      "Agent-Two"
    );
    expect(n.title).toBe("Agent-Two finished");
    expect(n.body).toBe("12 turns · $0.3421 · 72.00s");
  });

  it("says why a run stopped instead of calling it finished", () => {
    const n = runNotification(
      { subtype: "error_max_turns", numTurns: 20, costUsd: 1.2, durationMs: 5000 },
      "Agent-One"
    );
    expect(n.title).toBe("Agent-One stopped");
    // Same wording as the in-chat message, so the two never disagree.
    expect(n.body).toContain("Stopped at the turn limit after 20 turns");
  });

  it("carries the error detail through for a failed run", () => {
    const n = runNotification(
      { subtype: "error_during_execution", errors: ["rate limit"] },
      "Agent-Three"
    );
    expect(n.title).toBe("Agent-Three stopped");
    expect(n.body).toContain("rate limit");
  });

  it("drops metrics the run did not report rather than showing zeros", () => {
    const n = runNotification({ subtype: "success", numTurns: 1, costUsd: 0, durationMs: 0 });
    expect(n.title).toBe("Agent finished");
    expect(n.body).toBe("1 turn");
  });

  it("still says something when the run reported no metrics at all", () => {
    expect(runNotification({}).body).toBe("The run finished.");
  });
});

describe("showNotice", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Notification");
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, "Notification", original);
    else delete (globalThis as { Notification?: unknown }).Notification;
  });

  function stubNotification(permission: string) {
    const ctor = vi.fn();
    Object.defineProperty(globalThis, "Notification", {
      value: Object.assign(ctor, { permission }),
      configurable: true,
      writable: true,
    });
    return ctor;
  }

  it("shows the notice once permission has been granted", () => {
    const ctor = stubNotification("granted");
    expect(showNotice({ title: "t", body: "b" })).toBe(true);
    expect(ctor).toHaveBeenCalledWith("t", { body: "b" });
  });

  it("stays silent instead of prompting when permission was never asked for", () => {
    const ctor = stubNotification("default");
    expect(showNotice({ title: "t", body: "b" })).toBe(false);
    expect(ctor).not.toHaveBeenCalled();
  });

  it("stays silent when the user denied notifications", () => {
    const ctor = stubNotification("denied");
    expect(showNotice({ title: "t", body: "b" })).toBe(false);
    expect(ctor).not.toHaveBeenCalled();
  });

  it("does not throw where the Notification API does not exist", () => {
    delete (globalThis as { Notification?: unknown }).Notification;
    expect(showNotice({ title: "t", body: "b" })).toBe(false);
  });
});
