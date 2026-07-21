import { describe, it, expect } from "vitest";
import { doneEventPayload } from "@/lib/claude-stream";

/** Shape of SDKResultSuccess, trimmed to the fields the done event reads. */
const success = {
  type: "result",
  subtype: "success",
  stop_reason: "end_turn",
  duration_ms: 1200,
  duration_api_ms: 900,
  num_turns: 3,
  total_cost_usd: 0.042,
  usage: {
    input_tokens: 100,
    output_tokens: 50,
    cache_read_input_tokens: 10,
    cache_creation_input_tokens: 5,
  },
  modelUsage: { "claude-opus-4-8": { contextWindow: 200000 } },
};

/** Shape of SDKResultError — same usage/cost fields, plus `errors`, no `result`. */
const maxTurns = {
  type: "result",
  subtype: "error_max_turns",
  stop_reason: null,
  duration_ms: 5000,
  duration_api_ms: 4200,
  num_turns: 20,
  total_cost_usd: 0.31,
  errors: ["turn limit reached"],
  usage: {
    input_tokens: 900,
    output_tokens: 400,
    cache_read_input_tokens: 80,
    cache_creation_input_tokens: 20,
  },
  modelUsage: { "claude-opus-4-8": { contextWindow: 200000 } },
};

describe("doneEventPayload", () => {
  it("carries usage, cost and context window on a successful run", () => {
    const p = doneEventPayload(success);
    expect(p.subtype).toBe("success");
    expect(p.reason).toBe("end_turn");
    expect(p.cost_usd).toBe(0.042);
    expect(p.usage).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 10,
      cache_creation_input_tokens: 5,
    });
    expect(p.context_window).toBe(200000);
  });

  it("still reports usage and cost when the run hit the turn cap", () => {
    // The regression this guards: gating these on subtype === "success" made a
    // capped turn look free, under-reporting real spend.
    const p = doneEventPayload(maxTurns);
    expect(p.usage).not.toBeNull();
    expect(p.usage?.input_tokens).toBe(900);
    expect(p.cost_usd).toBe(0.31);
    expect(p.num_turns).toBe(20);
    expect(p.context_window).toBe(200000);
  });

  it("forwards the subtype and errors so the UI can explain the stop", () => {
    const p = doneEventPayload(maxTurns);
    expect(p.subtype).toBe("error_max_turns");
    expect(p.errors).toEqual(["turn limit reached"]);
  });

  it("tolerates a result with no usage, model or errors", () => {
    const p = doneEventPayload({ type: "result", subtype: "error_during_execution" });
    expect(p.usage).toBeNull();
    expect(p.model).toBeNull();
    expect(p.context_window).toBeNull();
    expect(p.errors).toBeNull();
    expect(p.reason).toBeNull();
  });
});
