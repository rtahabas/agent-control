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
      { tab: "agents", label: "Edit agents" },
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

export function tabLabel(tab: Tab): string {
  if (tab === PINNED_TOP.tab) return PINNED_TOP.label;
  for (const s of NAV) {
    for (const i of s.items) if (i.tab === tab) return i.label;
  }
  return tab;
}
