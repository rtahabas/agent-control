import { describe, it, expect } from "vitest";
import { attentionTitle, BASE_TITLE } from "@/lib/attention";

describe("attentionTitle", () => {
  it("flags a waiting card so it is visible from another tab", () => {
    expect(attentionTitle({ needsYou: true, busy: false }, "Agent-Two")).toBe(
      "● Needs you — Agent-Two"
    );
  });

  it("ranks a waiting card above an in-flight turn", () => {
    // Both true: the card blocks the agent, so it is the state worth surfacing.
    expect(attentionTitle({ needsYou: true, busy: true }, "Agent-One")).toBe(
      "● Needs you — Agent-One"
    );
  });

  it("shows working while a turn is in flight", () => {
    expect(attentionTitle({ needsYou: false, busy: true }, "Agent-Three")).toBe(
      "⋯ Working — Agent-Three"
    );
  });

  it("falls back to the plain app title when idle", () => {
    expect(attentionTitle({ needsYou: false, busy: false }, "Agent-Three")).toBe(
      `${BASE_TITLE} — Agent-Three`
    );
    expect(attentionTitle({ needsYou: false, busy: false }, null)).toBe(BASE_TITLE);
  });

  it("omits the agent suffix when no agent is selected", () => {
    expect(attentionTitle({ needsYou: true, busy: false }, null)).toBe("● Needs you");
    expect(attentionTitle({ needsYou: false, busy: true })).toBe("⋯ Working");
  });
});
