import { describe, it, expect } from "vitest";
import { runEndedMessage } from "@/lib/run-outcome";

describe("runEndedMessage", () => {
  it("says nothing for a normal finish", () => {
    expect(runEndedMessage("success", 3)).toBeNull();
    expect(runEndedMessage(null)).toBeNull();
    expect(runEndedMessage(undefined)).toBeNull();
  });

  it("explains the turn cap and how to lift it", () => {
    const msg = runEndedMessage("error_max_turns", 20);
    expect(msg).toContain("turn limit");
    expect(msg).toContain("20 turns");
    expect(msg).toContain("CHAT_MAX_TURNS");
  });

  it("omits the turn count when it is unknown", () => {
    expect(runEndedMessage("error_max_turns", null)).not.toContain("after");
  });

  it("covers the other documented error subtypes", () => {
    expect(runEndedMessage("error_max_budget_usd")).toContain("cost limit");
    expect(runEndedMessage("error_during_execution")).toContain("error");
    expect(runEndedMessage("error_max_structured_output_retries")).toContain("retries");
  });

  it("still reports an unrecognised subtype rather than staying silent", () => {
    // A new SDK subtype must not fall through to "no message" — that is the
    // silent-stop this exists to prevent.
    expect(runEndedMessage("error_brand_new")).toContain("error_brand_new");
  });

  it("appends SDK error detail when present", () => {
    const msg = runEndedMessage("error_during_execution", 2, ["tool exploded", "then gave up"]);
    expect(msg).toContain("tool exploded; then gave up");
  });
});
