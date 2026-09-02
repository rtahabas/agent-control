export type Tab =
  | "overview"
  | "tokens"
  | "activity"
  | "skills"
  | "memory"
  | "sub-agents"
  | "hooks"
  | "settings"
  | "agents"
  | "chat";

export interface NavItem {
  tab: Tab;
  label: string;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export const PINNED_TOP: NavItem = { tab: "chat", label: "Chat" };

// Sidebar information architecture:
//   Workspace — where am I working? (overview + agent switch)
//   Context   — what does this agent know? (memory, skills, sub-agents)
//   Runtime   — how does it behave? (hooks, settings)
//   Insights  — what did it do? (activity, tokens)
//
// Each group answers one question. "Agents" moved out of the bottom into
// Workspace so agent switching is a top-level concern, not a footnote.
export const NAV: NavSection[] = [
  {
    heading: "Workspace",
    items: [
      { tab: "overview", label: "Overview" },
      { tab: "agents", label: "Agents" },
    ],
  },
  {
    heading: "Context",
    items: [
      { tab: "memory", label: "Memory" },
      { tab: "skills", label: "Skills" },
      { tab: "sub-agents", label: "Sub-agents" },
    ],
  },
  {
    heading: "Runtime",
    items: [
      { tab: "hooks", label: "Hooks" },
      { tab: "settings", label: "Settings" },
    ],
  },
  {
    heading: "Insights",
    items: [
      { tab: "activity", label: "Activity Log" },
      { tab: "tokens", label: "Tokens & Cost" },
    ],
  },
];

const VALID = new Set<Tab>([
  PINNED_TOP.tab,
  ...NAV.flatMap((s) => s.items.map((i) => i.tab)),
]);

export function isTab(v: string): v is Tab {
  return VALID.has(v as Tab);
}

/**
 * Where the app opens.
 *
 * Two sources disagree on arrival: `?tab=` in the address bar, and this
 * window's own memory of where you were. The URL wins, because it is the only
 * one of the two that somebody chose — a pasted link is an instruction, while
 * the stored tab is just the last thing that happened here. Without this the
 * link is written but never read, and a shared address silently opens on
 * whatever the recipient looked at last.
 *
 * A tab name that no longer exists loses to the stored value rather than
 * stranding the reader on a blank screen, so an old link degrades to something
 * usable instead of failing.
 *
 * `search` is passed in rather than read from `window` so this is testable and
 * safe to call before the document exists.
 */
export function resolveTab(stored: string | null, search: string): Tab {
  const fromUrl = new URLSearchParams(search).get("tab");
  if (fromUrl !== null && isTab(fromUrl)) return fromUrl;
  if (stored !== null && isTab(stored)) return stored;
  return "overview";
}

/** Same precedence as resolveTab, for the selected agent. Any non-empty id is
 *  accepted: agents come from disk, so this cannot know the valid set, and a
 *  stale id resolves to no selection downstream rather than an error here. */
export function resolveAgent(stored: string | null, search: string): string | null {
  const fromUrl = new URLSearchParams(search).get("agent");
  if (fromUrl) return fromUrl;
  return stored;
}

export function tabLabel(tab: Tab): string {
  if (tab === PINNED_TOP.tab) return PINNED_TOP.label;
  for (const s of NAV) {
    for (const i of s.items) if (i.tab === tab) return i.label;
  }
  return tab;
}
