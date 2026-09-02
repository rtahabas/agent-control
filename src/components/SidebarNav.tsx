"use client";

import { NAV, PINNED_TOP, type Tab } from "@/lib/tabs";
import { usePersistedState } from "@/lib/persisted-state";

/**
 * Navigation, with the management screens folded away.
 *
 * Nine tabs across four headings were all on screen at once, next to the two
 * you actually use. The two that earn permanent space stay; the rest sit behind
 * one disclosure. Nothing was removed — a console that hides a screen you
 * cannot find again is worse than a crowded one.
 */

const ALWAYS: Tab[] = ["overview"];

export function SidebarNav({
  tab,
  onTabChange,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  const [manual, setManual] = usePersistedState<string>("app:manage", "closed", (raw) =>
    raw === "open" ? "open" : "closed"
  );

  const inside = NAV.flatMap((s) => s.items)
    .map((i) => i.tab)
    .filter((t) => !ALWAYS.includes(t));

  // Derived rather than stored: landing on a hidden tab must open the group, or
  // you would be looking at a screen with nothing in the rail marking it. An
  // effect that opened it would fight the user closing it again.
  const open = manual === "open" || inside.includes(tab);

  return (
    <nav className="flex-1 min-h-0 overflow-y-auto py-3">
      <Item label={PINNED_TOP.label} active={tab === PINNED_TOP.tab} onClick={() => onTabChange(PINNED_TOP.tab)} strong />
      {NAV.flatMap((s) => s.items)
        .filter((i) => ALWAYS.includes(i.tab))
        .map((i) => (
          <Item key={i.tab} label={i.label} active={tab === i.tab} onClick={() => onTabChange(i.tab)} />
        ))}

      <button
        type="button"
        onClick={() => setManual(open ? "closed" : "open")}
        aria-expanded={open}
        className="mt-3 w-full flex items-center gap-1.5 px-5 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider hover:text-zinc-600 transition"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        Manage
      </button>

      {open &&
        NAV.map((s) => {
          const items = s.items.filter((i) => !ALWAYS.includes(i.tab));
          if (items.length === 0) return null;
          return (
            <div key={s.heading} className="mb-3">
              <div className="px-5 mb-1 text-[10px] font-medium text-zinc-300 uppercase tracking-wider">
                {s.heading}
              </div>
              <ul className="space-y-0.5">
                {items.map((i) => (
                  <li key={i.tab}>
                    <Item label={i.label} active={tab === i.tab} onClick={() => onTabChange(i.tab)} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
    </nav>
  );
}

function Item({
  label,
  active,
  onClick,
  strong = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-5 py-1.5 text-sm transition ${
        active
          ? "bg-zinc-100 text-zinc-900 font-medium border-l-2 border-zinc-900 -ml-[2px] pl-[22px]"
          : `hover:bg-zinc-50 ${strong ? "text-zinc-700 font-medium" : "text-zinc-600"}`
      }`}
    >
      {label}
    </button>
  );
}
