import { describe, it, expect, vi, beforeEach } from "vitest";
import { agentHooks } from "@/lib/hooks";
import {
  makeCanUseTool,
  decidePermission,
  listSessionAllowlist,
  revokeSessionAllow,
} from "@/lib/chat-permissions";

type CanUseToolOpts = Parameters<ReturnType<typeof makeCanUseTool>>[2];

function makeOpts(toolUseID: string, signal: AbortSignal): CanUseToolOpts {
  return { toolUseID, signal, suggestions: [] } as CanUseToolOpts;
}

/** Let the gate reach its pending state (it awaits a hook before registering). */
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  agentHooks.clear();
});

describe("session allowlist (Allow always) is inspectable and reversible", () => {
  it("lists a tool after it is allowed with always, and drops it on revoke", async () => {
    const sid = "sess-allowlist-1";
    const ac = new AbortController();
    const can = makeCanUseTool(vi.fn(), () => sid);

    const gate = can("Bash", { cmd: "ls" }, makeOpts("t-a", ac.signal));
    await settle();
    expect(decidePermission("t-a", "allow", true)).toBe(true);
    expect((await gate).behavior).toBe("allow");

    expect(listSessionAllowlist(sid)).toEqual(["Bash"]);

    expect(revokeSessionAllow(sid, "Bash")).toBe(true);
    expect(listSessionAllowlist(sid)).toEqual([]);
  });

  it("auto-allows while listed, and asks again once revoked", async () => {
    const sid = "sess-allowlist-2";
    const ac = new AbortController();
    const emit = vi.fn();
    const can = makeCanUseTool(emit, () => sid);

    // Grant "always" on the first call.
    const first = can("Bash", { cmd: "ls" }, makeOpts("t-b1", ac.signal));
    await settle();
    decidePermission("t-b1", "allow", true);
    await first;

    // Second call must NOT prompt — it is auto-allowed off the allowlist.
    emit.mockClear();
    const second = await can("Bash", { cmd: "ls" }, makeOpts("t-b2", ac.signal));
    expect(second.behavior).toBe("allow");
    expect(emit.mock.calls.some(([e]) => e === "permission_request")).toBe(false);

    // After revoking, the very same call prompts again — proving the revoke
    // reaches the gate and is not just cosmetic bookkeeping.
    revokeSessionAllow(sid, "Bash");
    emit.mockClear();
    const third = can("Bash", { cmd: "ls" }, makeOpts("t-b3", ac.signal));
    await settle();
    expect(emit.mock.calls.some(([e]) => e === "permission_request")).toBe(true);

    ac.abort();
    await third;
  });

  it("clears the whole session when no tool is named", async () => {
    const sid = "sess-allowlist-3";
    const ac = new AbortController();
    const can = makeCanUseTool(vi.fn(), () => sid);

    for (const [tool, id] of [
      ["Bash", "t-c1"],
      ["Read", "t-c2"],
    ] as const) {
      const gate = can(tool, {}, makeOpts(id, ac.signal));
      await settle();
      decidePermission(id, "allow", true);
      await gate;
    }
    expect(listSessionAllowlist(sid)).toEqual(["Bash", "Read"]);

    expect(revokeSessionAllow(sid)).toBe(true);
    expect(listSessionAllowlist(sid)).toEqual([]);
  });

  it("is inert for an unknown session or a missing session id", () => {
    expect(listSessionAllowlist(null)).toEqual([]);
    expect(listSessionAllowlist("never-seen")).toEqual([]);
    expect(revokeSessionAllow(null, "Bash")).toBe(false);
    expect(revokeSessionAllow("never-seen", "Bash")).toBe(false);
  });
});
