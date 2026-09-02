"use client";

import { useEffect, useRef, useState } from "react";
import { NAV, type Tab } from "@/lib/tabs";

/**
 * Every screen that is not the conversation, behind one control.
 *
 * These nine used to live in the rail under a disclosure, grouped by four
 * headings. That is three levels of structure — rail, group, heading — for a
 * set of pages you open a few times a day, sitting permanently beside the one
 * you are always reading. The rail is for moving around what you are working
 * on; this is for changing how it is set up, and it belongs behind a control
 * you go to rather than a list you look past.
 *
 * The headings survive here, where a menu has room for them and they cost
 * nothing when it is closed.
 */
export function TabMenu({
  tab,
  onTabChange,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const inside = NAV.flatMap((s) => s.items).some((i) => i.tab === tab && i.tab !== "overview");

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Memory, skills, hooks, settings, activity"
        // Labelled, not a bare icon. A quiet control is right for something you
        // can also reach another way; this is the only door to nine screens, and
        // a 16px grey glyph is not a door anyone finds.
        className={`h-8 pl-2 pr-2.5 rounded-lg flex items-center gap-1.5 text-[13px] font-medium transition ${
          inside
            ? "text-accent bg-accent-soft"
            : "text-zinc-600 bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-900"
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
             strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="8" cy="8" r="2.15" />
          <path d="M8 1.6v1.7M8 12.7v1.7M14.4 8h-1.7M3.3 8H1.6M12.5 3.5l-1.2 1.2M4.7 11.3l-1.2 1.2M12.5 12.5l-1.2-1.2M4.7 4.7 3.5 3.5" />
        </svg>
        Manage
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-20 min-w-56 rounded-xl bg-zinc-50 lift py-1.5"
        >
          {NAV.map((section) => (
            <div key={section.heading} className="py-0.5">
              <div className="px-3 py-1 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                {section.heading}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onTabChange(item.tab);
                    setOpen(false);
                  }}
                  className={`w-full text-left mx-1 px-2.5 py-1.5 rounded-lg text-[13px] transition ${
                    item.tab === tab
                      ? "bg-accent-soft text-accent font-medium"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                  style={{ width: "calc(100% - 0.5rem)" }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
