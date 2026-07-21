import { describe, it, expect } from "vitest";
import {
  keyToPermDecision,
  keyToOptionIndex,
  isTypingTarget,
  isComposing,
  shortcutAllowed,
} from "@/lib/perm-keys";

describe("keyToPermDecision", () => {
  it("maps 1 to Allow", () => {
    expect(keyToPermDecision("1")).toEqual({ decision: "allow", always: false });
  });
  it("maps 2 to Reject (deny)", () => {
    expect(keyToPermDecision("2")).toEqual({ decision: "deny", always: false });
  });
  it("maps 3 to Allow always", () => {
    expect(keyToPermDecision("3")).toEqual({ decision: "allow", always: true });
  });
  it("returns null for any other key", () => {
    for (const k of ["0", "4", "9", "a", "Enter", " ", "Escape", "ArrowUp"]) {
      expect(keyToPermDecision(k)).toBeNull();
    }
  });
});

describe("keyToOptionIndex", () => {
  it("maps digits to zero-based indices within range", () => {
    expect(keyToOptionIndex("1", 4)).toBe(0);
    expect(keyToOptionIndex("2", 4)).toBe(1);
    expect(keyToOptionIndex("4", 4)).toBe(3);
  });
  it("returns null when the digit exceeds the option count", () => {
    expect(keyToOptionIndex("3", 2)).toBeNull();
    expect(keyToOptionIndex("5", 4)).toBeNull();
  });
  it("returns null for 0 and non-digit keys", () => {
    for (const k of ["0", "a", "Enter", " ", "-"]) {
      expect(keyToOptionIndex(k, 4)).toBeNull();
    }
  });
});

describe("isTypingTarget", () => {
  it("is true for input and textarea", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
  });
  it("is true for a contentEditable element", () => {
    const div = document.createElement("div");
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isTypingTarget(div)).toBe(true);
  });
  it("is false for a button and for null", () => {
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("isComposing", () => {
  it("is false for an empty input (shortcut still fires while chat box has focus)", () => {
    const input = document.createElement("textarea");
    input.value = "";
    expect(isComposing(input)).toBe(false);
    input.value = "   ";
    expect(isComposing(input)).toBe(false);
  });
  it("is true for an input holding a draft (shortcut must yield)", () => {
    const input = document.createElement("textarea");
    input.value = "1 more thing";
    expect(isComposing(input)).toBe(true);
  });
  it("is false for a non-typing element", () => {
    expect(isComposing(document.createElement("button"))).toBe(false);
    expect(isComposing(null)).toBe(false);
  });
});

describe("shortcutAllowed", () => {
  const NO_MODS = { meta: false, ctrl: false, alt: false };
  const base = {
    chatVisible: true,
    documentHidden: false,
    target: null as Element | null,
    modifiers: NO_MODS,
  };
  // Minimal stand-in for a focused field; isComposing only reads tagName/value.
  const field = (value: string) => ({ tagName: "TEXTAREA", value }) as unknown as Element;

  it("allows a bare digit while the chat tab is on screen", () => {
    expect(shortcutAllowed(base)).toBe(true);
  });

  it("refuses to decide a card the user is not looking at", () => {
    // The whole point of the shortcut is answering a visible card. On another
    // app tab the panel is still mounted, so this is the guard that matters.
    expect(shortcutAllowed({ ...base, chatVisible: false })).toBe(false);
  });

  it("refuses while the browser tab is backgrounded", () => {
    expect(shortcutAllowed({ ...base, documentHidden: true })).toBe(false);
  });

  it("yields to a draft so typing a digit never decides anything", () => {
    expect(shortcutAllowed({ ...base, target: field("1") })).toBe(false);
    expect(shortcutAllowed({ ...base, target: field("hello") })).toBe(false);
  });

  it("still works with the composer focused but empty", () => {
    expect(shortcutAllowed({ ...base, target: field("") })).toBe(true);
    expect(shortcutAllowed({ ...base, target: field("   ") })).toBe(true);
  });

  it("ignores modified keystrokes so browser shortcuts keep working", () => {
    for (const m of [{ meta: true }, { ctrl: true }, { alt: true }]) {
      expect(shortcutAllowed({ ...base, modifiers: { ...NO_MODS, ...m } })).toBe(false);
    }
  });
});
