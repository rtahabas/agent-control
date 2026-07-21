import { describe, it, expect } from "vitest";
import { trimForStorage, SNAPSHOT_BUDGET_BYTES } from "@/lib/chat-helpers";
import { EMPTY_STATS, type ChatMessage, type ChatSnapshot } from "@/lib/chat-types";

const snap = (messages: ChatMessage[]): ChatSnapshot => ({
  messages, sessionId: "s", lastTurn: null, stats: EMPTY_STATS,
});

const withImage = (id: string, bytes: number): ChatMessage => ({
  id, role: "user", text: "look at this",
  attachment: { kind: "image", mime: "image/png", name: `${id}.png`, size: bytes, dataBase64: "A".repeat(bytes) },
});

const text = (id: string, bytes = 100): ChatMessage => ({
  id, role: "user", text: "x".repeat(bytes),
});

const size = (s: ChatSnapshot) => JSON.stringify(s).length;

describe("trimForStorage", () => {
  it("leaves a transcript that already fits completely alone", () => {
    const s = snap([text("1"), text("2")]);
    expect(trimForStorage(s)).toEqual(s);
  });

  it("drops image payloads before it drops anything the user wrote", () => {
    // One screenshot outweighs thousands of turns, so words survive it.
    const s = snap([withImage("img", SNAPSHOT_BUDGET_BYTES), text("a"), text("b")]);
    const out = trimForStorage(s);
    expect(out.messages).toHaveLength(3);
    expect(out.messages[0].attachment?.dataBase64).toBe("");
    // Metadata stays so the bubble can still say what was sent.
    expect(out.messages[0].attachment?.name).toBe("img.png");
  });

  it("drops the oldest turns when text alone still will not fit", () => {
    const many = Array.from({ length: 400 }, (_, i) => text(String(i), 5000));
    const out = trimForStorage(snap(many));
    expect(size(out)).toBeLessThanOrEqual(SNAPSHOT_BUDGET_BYTES);
    expect(out.messages.length).toBeLessThan(many.length);
    // Newest kept: the tail is what you want back after a reload.
    expect(out.messages[out.messages.length - 1].id).toBe("399");
  });

  it("keeps the newest turn even when it alone blows the budget", () => {
    const out = trimForStorage(snap([text("old"), text("huge", SNAPSHOT_BUDGET_BYTES * 2)]));
    expect(out.messages).toHaveLength(1);
    expect(out.messages[0].id).toBe("huge");
  });

  it("respects a caller-supplied budget", () => {
    // Sized so trimming can actually reach the target — a budget smaller than a
    // single turn is the "keep the newest" case covered above, not this one.
    const out = trimForStorage(snap([text("1"), text("2"), text("3"), text("4")]), 400);
    expect(size(out)).toBeLessThanOrEqual(400);
    expect(out.messages.length).toBeLessThan(4);
    expect(out.messages[out.messages.length - 1].id).toBe("4");
  });
});
