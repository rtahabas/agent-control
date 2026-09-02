import { describe, it, expect } from "vitest";
import { resolveAgent, resolveTab } from "@/lib/tabs";

// The app writes ?tab= and ?agent= into the address bar on every change and
// calls those links shareable. They only are if the URL is read back on
// arrival: before this, a pasted link opened on whatever the recipient had
// looked at last, then quietly rewrote the address to match.

describe("resolveTab", () => {
  it("takes the tab from the URL, so a shared link opens where it points", () => {
    expect(resolveTab(null, "?tab=chat")).toBe("chat");
  });

  it("lets the URL win over this window's stored tab", () => {
    // The stored value is where you happened to be; the link is where someone
    // asked you to go.
    expect(resolveTab("overview", "?tab=memory")).toBe("memory");
  });

  it("keeps the stored tab when the URL says nothing", () => {
    expect(resolveTab("hooks", "")).toBe("hooks");
  });

  it("falls back to the stored tab when the URL names one that is gone", () => {
    // An old link should degrade to something usable rather than a blank screen.
    expect(resolveTab("skills", "?tab=nonesuch")).toBe("skills");
  });

  it("lands on overview when neither source has anything valid", () => {
    expect(resolveTab(null, "?tab=nonesuch")).toBe("overview");
    expect(resolveTab("gone", "")).toBe("overview");
  });

  it("ignores other query parameters", () => {
    expect(resolveTab(null, "?agent=agent-one&tab=tokens&x=1")).toBe("tokens");
  });
});

describe("resolveAgent", () => {
  it("takes the agent from the URL", () => {
    expect(resolveAgent(null, "?agent=agent-one")).toBe("agent-one");
  });

  it("lets the URL win over the stored selection", () => {
    expect(resolveAgent("agent-two", "?agent=agent-one")).toBe("agent-one");
  });

  it("keeps the stored selection when the URL says nothing", () => {
    expect(resolveAgent("agent-two", "")).toBe("agent-two");
  });

  it("treats an empty agent parameter as absent", () => {
    // ?agent= with no value should not clear a valid stored selection.
    expect(resolveAgent("agent-two", "?agent=")).toBe("agent-two");
  });

  it("returns null when there is nothing to select", () => {
    expect(resolveAgent(null, "")).toBeNull();
  });
});
