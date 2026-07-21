export type PermDecision = { decision: "allow" | "deny"; always: boolean };

/**
 * Map a bare number key to a permission decision, mirroring the PermissionCard
 * buttons and the CLI's numbered prompt: 1 = Allow, 2 = Reject, 3 = Allow always.
 * Returns null for any other key.
 */
export function keyToPermDecision(key: string): PermDecision | null {
  switch (key) {
    case "1":
      return { decision: "allow", always: false };
    case "2":
      return { decision: "deny", always: false };
    case "3":
      return { decision: "allow", always: true };
    default:
      return null;
  }
}

/**
 * Map a digit key to a zero-based option index for a numbered choice card
 * (1 → 0, 2 → 1, …). Only 1-9 are accepted, and only when the index is within
 * `count`. Returns null for any other key or an out-of-range digit.
 */
export function keyToOptionIndex(key: string, count: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const idx = Number(key) - 1;
  return idx < count ? idx : null;
}

/** True when the element is a text-entry field (input, textarea, or contentEditable). */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable === true
  );
}

/**
 * True when the user is actively composing text — focused in a typing field that
 * already holds a non-empty draft. A global 1/2/3 shortcut must yield in that case,
 * so typing "1" into the chat box never silently allows a tool. An EMPTY input does
 * not block the shortcut, so a request can be answered while the chat box keeps focus.
 */
export function isComposing(el: Element | null): boolean {
  if (!isTypingTarget(el)) return false;
  const value = (el as HTMLInputElement | HTMLTextAreaElement).value;
  return typeof value === "string" && value.trim().length > 0;
}

export type ShortcutContext = {
  /** The chat surface is the tab currently on screen. */
  chatVisible: boolean;
  /** The browser tab itself is backgrounded. */
  documentHidden: boolean;
  /** Element with keyboard focus when the key was pressed. */
  target: Element | null;
  modifiers: { meta: boolean; ctrl: boolean; alt: boolean };
};

/**
 * Whether a bare number key may act on a pending card.
 *
 * The card is the whole justification for the shortcut: answering something you
 * cannot see is not a shortcut, it is an accident. The chat panel stays mounted
 * behind other tabs, so being mounted proves nothing about being visible — a "1"
 * typed on the Overview tab must not grant a tool, and "3" must not write a
 * lasting allowlist entry. Composing still yields, so typing "1" into a draft
 * never decides anything, while an empty composer keeps the shortcut usable.
 */
export function shortcutAllowed(ctx: ShortcutContext): boolean {
  const { meta, ctrl, alt } = ctx.modifiers;
  if (meta || ctrl || alt) return false;
  if (!ctx.chatVisible || ctx.documentHidden) return false;
  return !isComposing(ctx.target);
}
