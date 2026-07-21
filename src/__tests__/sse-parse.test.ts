import { describe, it, expect } from "vitest";
import { parseSseBlock } from "@/lib/sse-parse";

describe("parseSseBlock", () => {
  it("reads a single-line event", () => {
    expect(parseSseBlock('event: delta\ndata: {"text":"hi"}')).toEqual({
      event: "delta",
      payload: { text: "hi" },
    });
  });

  it("reads a value split across several data lines", () => {
    // Honest note: for JSON payloads this passes under the old bare-concatenation
    // too, because JSON ignores whitespace between tokens. No test here can tell
    // the two apart, so the newline join is spec conformance, not a proven fix.
    const block = 'event: delta\ndata: {"text":\ndata: "hello"}';
    expect(parseSseBlock(block)).toEqual({ event: "delta", payload: { text: "hello" } });
  });

  it("keeps newlines that belong to the value", () => {
    const block = 'event: delta\ndata: {"text":"a\\nb"}';
    expect(parseSseBlock(block)?.payload).toEqual({ text: "a\nb" });
  });

  it("defaults the event name when none is given", () => {
    expect(parseSseBlock('data: {"x":1}')?.event).toBe("message");
  });

  it("returns null for a block with no data", () => {
    expect(parseSseBlock("event: ping")).toBeNull();
    expect(parseSseBlock("data:   ")).toBeNull();
  });

  it("returns null rather than throwing on malformed JSON", () => {
    expect(parseSseBlock("data: {not json")).toBeNull();
  });
});
