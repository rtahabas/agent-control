import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedState, persistedAge } from "@/lib/persisted-state";

const asIs = (raw: string | null) => raw;

beforeEach(() => sessionStorage.clear());

describe("usePersistedState", () => {
  it("restores what was stored, so a refresh keeps your place", () => {
    sessionStorage.setItem("app:tab", "chat");
    const { result } = renderHook(() => usePersistedState<string | null>("app:tab", null, asIs));
    expect(result.current[0]).toBe("chat");
  });

  it("reports when it has read storage, so callers do not act on the default", () => {
    // Everything on the page waits for this: loading agents before hydration
    // would overwrite the stored selection with whichever agent came first.
    const { result } = renderHook(() => usePersistedState<string | null>("k", null, asIs));
    expect(result.current[2]).toBe(true);
  });

  it("writes through on update", () => {
    const { result } = renderHook(() => usePersistedState<string | null>("k", null, asIs));
    act(() => result.current[1]("chat"));
    expect(sessionStorage.getItem("k")).toBe("chat");
    expect(result.current[0]).toBe("chat");
  });

  it("accepts an updater function that sees the previous value", () => {
    sessionStorage.setItem("k", "a");
    const { result } = renderHook(() => usePersistedState<string | null>("k", null, asIs));
    act(() => result.current[1]((prev) => (prev ?? "") + "b"));
    expect(result.current[0]).toBe("ab");
    expect(sessionStorage.getItem("k")).toBe("ab");
  });

  it("removes the key rather than storing an empty value", () => {
    sessionStorage.setItem("k", "x");
    const { result } = renderHook(() => usePersistedState<string | null>("k", null, asIs));
    act(() => result.current[1](null));
    expect(sessionStorage.getItem("k")).toBeNull();
  });

  it("lets the parser reject a stored value it does not recognise", () => {
    // How a stale tab name from an older build is kept from selecting a tab
    // that no longer exists.
    sessionStorage.setItem("app:tab", "tab-that-was-removed");
    const known = (raw: string | null) => (raw === "chat" ? raw : "overview");
    const { result } = renderHook(() => usePersistedState("app:tab", "overview", known));
    expect(result.current[0]).toBe("overview");
  });
});

describe("persistedAge", () => {
  const NOW = 1_700_000_000_000;
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(NOW));
  afterEach(() => vi.restoreAllMocks());

  it("counts seconds, then minutes, then hours", () => {
    expect(persistedAge(NOW - 5_000)).toBe("5s ago");
    expect(persistedAge(NOW - 120_000)).toBe("2m ago");
    expect(persistedAge(NOW - 7_200_000)).toBe("2h ago");
  });

  it("says nothing when there is no timestamp", () => {
    expect(persistedAge(null)).toBe("");
  });
});
