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

export const NAV: NavSection[] = [
  {
    heading: "Monitoring",
    items: [
      { tab: "overview", label: "Overview" },
      { tab: "tokens", label: "Tokens & Cost" },
      { tab: "activity", label: "Activity Log" },
      { tab: "skills", label: "Skills" },
      { tab: "memory", label: "Memory" },
    ],
  },
  {
    heading: "Configure",
    items: [
      { tab: "sub-agents", label: "Sub-agents" },
      { tab: "hooks", label: "Hooks" },
      { tab: "settings", label: "Settings" },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { tab: "agents", label: "Agents" },
      { tab: "chat", label: "Chat" },
    ],
  },
];

const VALID = new Set<Tab>(NAV.flatMap((s) => s.items.map((i) => i.tab)));

export function isTab(v: string): v is Tab {
  return VALID.has(v as Tab);
}

export function tabLabel(tab: Tab): string {
  for (const s of NAV) {
    for (const i of s.items) if (i.tab === tab) return i.label;
  }
  return tab;
}
