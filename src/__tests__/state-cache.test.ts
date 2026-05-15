import { describe, it, expect, beforeEach } from "vitest";
import {
  readCachedState,
  writeCachedState,
  withSingleFlight,
  getCacheTtlMs,
  _resetStateCacheForTests,
} from "@/lib/state-cache";

beforeEach(() => {
  _resetStateCacheForTests();
});

describe("state-cache", () => {
  it("returns null when no entry exists", () => {
    expect(readCachedState("nope")).toBeNull();
  });

  it("returns the body when within TTL", () => {
    writeCachedState("a", '{"projects":[]}', 1_000);
    expect(readCachedState("a", 1_000 + getCacheTtlMs() - 1)).toBe('{"projects":[]}');
  });

  it("returns null once TTL has elapsed", () => {
    writeCachedState("a", "body", 1_000);
    expect(readCachedState("a", 1_000 + getCacheTtlMs())).toBeNull();
    expect(readCachedState("a", 1_000 + getCacheTtlMs() + 50_000)).toBeNull();
  });

  it("withSingleFlight coalesces concurrent fetchers for the same key", async () => {
    let calls = 0;
    const fetcher = () =>
      new Promise<string>((resolve) => {
        calls++;
        setTimeout(() => resolve("payload"), 10);
      });
    const [a, b, c] = await Promise.all([
      withSingleFlight("k", fetcher),
      withSingleFlight("k", fetcher),
      withSingleFlight("k", fetcher),
    ]);
    expect([a, b, c]).toEqual(["payload", "payload", "payload"]);
    expect(calls).toBe(1);
  });

  it("withSingleFlight does not coalesce across different keys", async () => {
    let calls = 0;
    const fetcher = () =>
      new Promise<string>((resolve) => {
        calls++;
        setTimeout(() => resolve("payload"), 5);
      });
    await Promise.all([
      withSingleFlight("k1", fetcher),
      withSingleFlight("k2", fetcher),
    ]);
    expect(calls).toBe(2);
  });

  it("withSingleFlight releases the slot after rejection", async () => {
    let calls = 0;
    const failing = () =>
      new Promise<string>((_, reject) => {
        calls++;
        setTimeout(() => reject(new Error("boom")), 5);
      });
    await expect(withSingleFlight("k", failing)).rejects.toThrow("boom");
    // second call must re-run the fetcher (not return the rejected promise)
    await expect(withSingleFlight("k", failing)).rejects.toThrow("boom");
    expect(calls).toBe(2);
  });

  it("_resetStateCacheForTests clears both cache and inflight", () => {
    writeCachedState("a", "body");
    expect(readCachedState("a")).toBe("body");
    _resetStateCacheForTests();
    expect(readCachedState("a")).toBeNull();
  });
});
