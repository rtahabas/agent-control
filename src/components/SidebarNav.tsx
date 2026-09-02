"use client";

import { NAV, PINNED_TOP, type Tab } from "@/lib/tabs";

/**
 * The rail navigates content, and there are two pieces of it.
 *
 * The other nine screens used to be here under a disclosure, grouped by four
 * headings — three levels of structure for pages you open a few times a day,
 * kept permanently beside the one you read constantly. They moved behind the
 * gear in the top bar. What is left is what you actually switch between.
 */
const ALWAYS: Tab[] = ["overview"];

export function SidebarNav({
  tab,
  onTabChange,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  return (
    <nav className="shrink-0 py-2 flex flex-col gap-0.5">
      <Item
        label={PINNED_TOP.label}
        active={tab === PINNED_TOP.tab}
        onClick={() => onTabChange(PINNED_TOP.tab)}
      />
      {NAV.flatMap((s) => s.items)
        .filter((i) => ALWAYS.includes(i.tab))
        .map((i) => (
          <Item
            key={i.tab}
            label={i.label}
            active={tab === i.tab}
            onClick={() => onTabChange(i.tab)}
          />
        ))}
    </nav>
  );
}

function Item({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mx-2 rounded-lg text-left px-3 py-1.5 text-[13px] transition ${
        active ? "bg-accent-soft text-accent font-medium" : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      {label}
    </button>
  );
}
