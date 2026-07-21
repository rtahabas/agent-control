import { describe, it, expect } from "vitest";
import { statusOf, titleAgent, attentionTitleFor } from "@/lib/agent-attention";
import { BASE_TITLE } from "@/lib/attention";
import type { AgentAttention } from "@/lib/chat-store";

const waiting: AgentAttention = { needsYou: true, busy: false };
const working: AgentAttention = { needsYou: false, busy: true };
const idle: AgentAttention = { needsYou: false, busy: false };
const names: Record<string, string> = { a: "Agent-One", b: "Agent-Two", c: "Agent-Three" };
const nameOf = (id: string) => names[id] ?? null;

describe("statusOf", () => {
  it("ranks a blocked agent above a running one", () => {
    // Blocked stays blocked until someone acts; running is making progress.
    expect(statusOf({ needsYou: true, busy: true })).toBe("waiting");
  });
  it("reports working and idle", () => {
    expect(statusOf(working)).toBe("working");
    expect(statusOf(idle)).toBe("idle");
    expect(statusOf(undefined)).toBe("idle");
  });
});

describe("titleAgent", () => {
  it("names an agent that needs you even while you are reading another", () => {
    // The defect this exists for: only the selected agent was ever reported, so
    // a second one could sit blocked indefinitely with nothing saying so.
    expect(titleAgent({ a: working, b: waiting }, "a")).toEqual({ id: "b", status: "waiting" });
  });

  it("prefers a blocked agent over a busy one", () => {
    expect(titleAgent({ a: working, b: waiting, c: working }, null)?.id).toBe("b");
  });

  it("prefers the agent on screen when several are equally blocked", () => {
    // Otherwise the title would flap between them on every update.
    expect(titleAgent({ a: waiting, b: waiting }, "b")?.id).toBe("b");
  });

  it("ignores idle agents", () => {
    expect(titleAgent({ a: idle, b: idle }, "a")).toBeNull();
    expect(titleAgent({}, null)).toBeNull();
  });
});

describe("attentionTitleFor", () => {
  it("names the agent that is waiting, not the one selected", () => {
    expect(attentionTitleFor({ a: idle, b: waiting }, "a", nameOf)).toBe(
      "● Needs you — Agent-Two"
    );
  });

  it("falls back to working when nobody is blocked", () => {
    expect(attentionTitleFor({ a: working }, "a", nameOf)).toBe("⋯ Working — Agent-One");
  });

  it("returns the plain title when every agent is idle", () => {
    expect(attentionTitleFor({ a: idle }, "a", nameOf)).toBe(BASE_TITLE);
  });

  it("omits the name when the agent is unknown", () => {
    expect(attentionTitleFor({ zz: waiting }, null, nameOf)).toBe("● Needs you");
  });
});
