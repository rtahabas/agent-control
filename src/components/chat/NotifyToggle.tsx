"use client";

import { useEffect, useState } from "react";

type Perm = "default" | "granted" | "denied" | "unsupported";

function readPermission(): Perm {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as Perm;
}

/**
 * Offers to turn on desktop alerts for a waiting permission/question card —
 * and only while that is still an open choice. Once the browser permission is
 * granted, denied, or unavailable there is nothing left to ask for, so the
 * button disappears instead of sitting there doing nothing. Renders nothing
 * until mounted, since the permission is only readable in the browser.
 */
export function NotifyToggle() {
  const [perm, setPerm] = useState<Perm | null>(null);

  useEffect(() => setPerm(readPermission()), []);

  if (perm !== "default") return null;

  return (
    <button
      onClick={async () => setPerm((await Notification.requestPermission()) as Perm)}
      title="Get a desktop alert when a permission or question is waiting while this tab is in the background"
      className="text-xs px-2 py-1 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 shrink-0"
    >
      Enable alerts
    </button>
  );
}
