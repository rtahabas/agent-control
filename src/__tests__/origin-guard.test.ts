import { describe, it, expect } from "vitest";
import { isAllowedRequest } from "@/lib/origin-guard";

const HOST = "localhost:3005";
const LOOPBACK = ["127", "0", "0", "1"].join(".") + ":3005";

describe("isAllowedRequest", () => {
  it("lets reads through regardless of where they came from", () => {
    // Reads change nothing, and the browser will not hand over the response
    // cross-origin anyway.
    expect(isAllowedRequest("GET", "https://evil.example", HOST)).toBe(true);
    expect(isAllowedRequest("HEAD", "https://evil.example", HOST)).toBe(true);
  });

  it("allows a write from the page the dashboard was opened as", () => {
    expect(isAllowedRequest("POST", `http://${HOST}`, HOST)).toBe(true);
    expect(isAllowedRequest("POST", `http://${LOOPBACK}`, LOOPBACK)).toBe(true);
  });

  it("refuses a write from another site", () => {
    // The attack: a page you visited POSTs text/plain to your own machine, no
    // preflight, and an agent starts running.
    expect(isAllowedRequest("POST", "https://evil.example", HOST)).toBe(false);
    for (const m of ["PUT", "PATCH", "DELETE"]) {
      expect(isAllowedRequest(m, "https://evil.example", HOST)).toBe(false);
    }
  });

  it("refuses a site that only looks like this one", () => {
    expect(isAllowedRequest("POST", `http://${HOST}.evil.example`, HOST)).toBe(false);
    expect(isAllowedRequest("POST", "http://localhost:9999", HOST)).toBe(false);
    // Same host and port over https stays allowed on purpose: producing that
    // Origin means holding this exact port with a TLS listener, which is this
    // server. Reachability is the boundary here, not scheme.
    expect(isAllowedRequest("POST", `https://${HOST}`, HOST)).toBe(true);
  });

  it("leaves non-browser clients alone", () => {
    // curl, the Telegram bridge and local scripts send no Origin at all;
    // rejecting them would break tooling without closing the hole.
    expect(isAllowedRequest("POST", null, HOST)).toBe(true);
  });

  it("refuses anything it cannot make sense of", () => {
    expect(isAllowedRequest("POST", "not a url", HOST)).toBe(false);
    expect(isAllowedRequest("POST", "file:///etc/passwd", HOST)).toBe(false);
    expect(isAllowedRequest("POST", `http://${HOST}`, null)).toBe(false);
  });

  it("compares case-insensitively, as hostnames are", () => {
    expect(isAllowedRequest("post", "http://LOCALHOST:3005", HOST)).toBe(true);
  });
});
