import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAgent } from "@/lib/db";
import { listConversations, createConversation } from "@/lib/conversations";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-z0-9_-]+$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  return NextResponse.json({ conversations: listConversations(id) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  // An unknown agent would otherwise leave orphan rows nothing can ever list.
  if (!getAgent(id)) {
    return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
  }
  let sessionId: string | null = null;
  try {
    const body = (await req.json()) as { sessionId?: string | null };
    sessionId = body?.sessionId ?? null;
  } catch {
    // A body is optional here — a new conversation has no session yet.
  }
  const conversation = createConversation(id, randomUUID(), sessionId);
  return NextResponse.json({ conversation }, { status: 201 });
}
