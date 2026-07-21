import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/hooks", () => ({ agentHooks: { emit: vi.fn(async (_e, c) => c) } }));

import {
  decidePermission,
  listSessionAllowlist,
  revokeSessionAllow,
  makeCanUseTool,
} from "@/lib/chat-permissions";

/** Drives one "Allow always" through the real path: request → decide. */
async function grant(sessionId: string, toolName: string, toolUseId: string) {
  const canUseTool = makeCanUseTool(() => {}, () => sessionId);
  const p = canUseTool(toolName, {}, {
    toolUseID: toolUseId,
    signal: new AbortController().signal,
  } as never);
  // The card is pending now; answer it the way the UI would.
  await new Promise((r) => setTimeout(r, 0));
  decidePermission(toolUseId, "allow", true);
  await p;
}

beforeEach(() => {
  for (const s of Array.from({ length: 80 }, (_, i) => `sess-${i}`)) revokeSessionAllow(s);
});

describe("session allowlist", () => {
  it("remembers a granted tool for that session only", async () => {
    await grant("sess-1", "Bash", "t1");
    expect(listSessionAllowlist("sess-1")).toEqual(["Bash"]);
    expect(listSessionAllowlist("sess-2")).toEqual([]);
  });

  it("forgets the oldest session once too many are held", async () => {
    // Nothing prunes a session you simply stopped using, so without a cap these
    // grants accumulate for the life of the process.
    for (let i = 0; i < 40; i++) await grant(`sess-${i}`, "Bash", `tool-${i}`);
    expect(listSessionAllowlist("sess-0")).toEqual([]);
    expect(listSessionAllowlist("sess-39")).toEqual(["Bash"]);
  });

  it("revoking makes the tool ask again", async () => {
    await grant("sess-9", "Bash", "t9");
    expect(revokeSessionAllow("sess-9", "Bash")).toBe(true);
    expect(listSessionAllowlist("sess-9")).toEqual([]);
  });
});
