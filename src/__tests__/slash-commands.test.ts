import { describe, it, expect, afterEach, vi } from "vitest";
import {
  parseSlash,
  helpText,
  fetchCustomCommandNames,
  fetchCustomCommand,
  fetchAgentModel,
  setAgentModel,
} from "@/lib/slash-commands";

const json = (body: unknown, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({ ok, status, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe("parseSlash", () => {
  it("splits the name from its arguments", () => {
    expect(parseSlash("/model opus[1m]")).toEqual({ name: "model", args: "opus[1m]" });
  });

  it("lowercases the name so /Clear works", () => {
    expect(parseSlash("/CLEAR")).toEqual({ name: "clear", args: "" });
  });

  it("keeps a multi-line argument intact", () => {
    expect(parseSlash("/review line one\nline two")?.args).toBe("line one\nline two");
  });

  it("is not a command without a leading slash", () => {
    expect(parseSlash("model opus")).toBeNull();
    // A bare slash or one starting with punctuation is a message, not a command,
    // and must reach the agent rather than being swallowed.
    expect(parseSlash("/")).toBeNull();
    expect(parseSlash("/ what is this")).toBeNull();
  });
});

describe("helpText", () => {
  it("lists the built-ins", () => {
    const t = helpText([]);
    for (const c of ["/clear", "/help", "/model"]) expect(t).toContain(c);
  });

  it("adds the project's own commands when there are any", () => {
    expect(helpText(["status", "review"])).toContain("/status");
  });

  it("says why the CLI-only commands are missing", () => {
    // Otherwise their absence reads as a bug rather than a different runtime.
    expect(helpText([])).toContain("/btw");
  });
});

describe("fetching", () => {
  it("returns the command list", async () => {
    vi.stubGlobal("fetch", json({ commands: ["status"] }));
    expect(await fetchCustomCommandNames("a")).toEqual(["status"]);
  });

  it("treats a failure as no commands rather than throwing into the chat", async () => {
    vi.stubGlobal("fetch", json({}, false, 500));
    expect(await fetchCustomCommandNames("a")).toEqual([]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchCustomCommandNames("a")).toEqual([]);
  });

  it("ignores a malformed list", async () => {
    vi.stubGlobal("fetch", json({ commands: "not an array" }));
    expect(await fetchCustomCommandNames("a")).toEqual([]);
  });

  it("reads a command body, and reports a missing one as null", async () => {
    vi.stubGlobal("fetch", json({ content: "do the thing" }));
    expect(await fetchCustomCommand("a", "x")).toBe("do the thing");
    vi.stubGlobal("fetch", json({ error: "not found" }, false, 404));
    expect(await fetchCustomCommand("a", "x")).toBeNull();
  });

  it("escapes the command name in the URL", async () => {
    // The name reaches this from user input; unescaped it could bend the query.
    const f = json({ content: "" });
    vi.stubGlobal("fetch", f);
    await fetchCustomCommand("a", "we ird&x=1");
    expect(f.mock.calls[0][0]).toContain("name=we%20ird%26x%3D1");
  });

  it("reads the model, and treats no model as default", async () => {
    vi.stubGlobal("fetch", json({ model: "claude-opus-4-8[1m]" }));
    expect(await fetchAgentModel("a")).toBe("claude-opus-4-8[1m]");
    vi.stubGlobal("fetch", json({}));
    expect(await fetchAgentModel("a")).toBeNull();
  });
});

describe("setAgentModel", () => {
  it("reports success", async () => {
    vi.stubGlobal("fetch", json({}, true, 200));
    expect(await setAgentModel("a", "sonnet")).toEqual({ ok: true });
  });

  it("passes the server's reason back instead of a bare failure", async () => {
    vi.stubGlobal("fetch", json({ error: "unknown model" }, false, 400));
    expect(await setAgentModel("a", "nope")).toEqual({ ok: false, error: "unknown model" });
  });

  it("falls back to the status when the server explains nothing", async () => {
    vi.stubGlobal("fetch", json({}, false, 503));
    expect(await setAgentModel("a", "x")).toEqual({ ok: false, error: "HTTP 503" });
  });

  it("reports a network failure rather than claiming the model changed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await setAgentModel("a", "x")).toEqual({ ok: false, error: "offline" });
  });
});
