import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type RouteModule = typeof import("@/app/api/skills/[name]/toggle/route");

let tmpDb: string;
let route: RouteModule;

beforeEach(async () => {
  tmpDb = path.join(os.tmpdir(), `toggle-route-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  process.env.AGENT_DB_PATH = tmpDb;
  vi.resetModules();
  route = await import("@/app/api/skills/[name]/toggle/route");
});

afterEach(() => {
  try { fs.unlinkSync(tmpDb); } catch { /* ignore */ }
  delete process.env.AGENT_DB_PATH;
});

function makeRequest(): Request {
  return new Request("https://example.test/api/skills/x/toggle", { method: "POST" });
}

describe("POST /api/skills/[name]/toggle", () => {
  it("toggles a skill from enabled (default) to disabled", async () => {
    const res = await route.POST(makeRequest(), {
      params: Promise.resolve({ name: "memory-search" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ name: "memory-search", enabled: false });
  });

  it("toggles back to enabled on second call", async () => {
    await route.POST(makeRequest(), { params: Promise.resolve({ name: "alpha" }) });
    const res = await route.POST(makeRequest(), { params: Promise.resolve({ name: "alpha" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: "alpha", enabled: true });
  });

  it("rejects invalid skill names with 400", async () => {
    const res = await route.POST(makeRequest(), {
      params: Promise.resolve({ name: "../etc/passwd" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid skill name/);
  });

  it("rejects empty skill name with 400", async () => {
    const res = await route.POST(makeRequest(), {
      params: Promise.resolve({ name: "" }),
    });
    expect(res.status).toBe(400);
  });
});
