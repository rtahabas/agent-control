import { NextResponse } from "next/server";
import { listSessionAllowlist, revokeSessionAllow } from "@/lib/chat-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tools the session auto-allows from an earlier "Allow always". */
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("session_id");
  return NextResponse.json({ tools: listSessionAllowlist(sessionId) });
}

/**
 * Revoke one auto-allowed tool, or the whole session's list when `tool` is
 * omitted. Always returns the resulting list so the caller does not need a
 * follow-up GET.
 */
export async function DELETE(req: Request) {
  const params = new URL(req.url).searchParams;
  const sessionId = params.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }
  const tool = params.get("tool") ?? undefined;
  const revoked = revokeSessionAllow(sessionId, tool);
  return NextResponse.json({ revoked, tools: listSessionAllowlist(sessionId) });
}
