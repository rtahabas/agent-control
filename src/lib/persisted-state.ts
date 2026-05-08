"use client";

import { useCallback, useEffect, useState } from "react";

type Updater<T> = T | ((prev: T) => T);

export function usePersistedState<T extends string | null>(
  key: string,
  initial: T,
  parse: (raw: string | null) => T
): [T, (v: Updater<T>) => void, boolean] {
  const [value, setValueRaw] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setValueRaw(parse(sessionStorage.getItem(key)));
    setHydrated(true);
  }, [key, parse]);

  const setValue = useCallback(
    (v: Updater<T>) => {
      setValueRaw((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        if (typeof window !== "undefined") {
          if (next === null || next === "") sessionStorage.removeItem(key);
          else sessionStorage.setItem(key, String(next));
        }
        return next;
      });
    },
    [key]
  );

  return [value, setValue, hydrated];
}

export function persistedAge(ts: number | null): string {
  if (ts === null) return "";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
