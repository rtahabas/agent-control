import { NextResponse } from "next/server";
import {
  getConversation,
  loadTranscript,
  saveTranscript,
  deleteConversation,
} from "@/lib/conversations";
import type { ChatMessage } from "@/lib/chat-types";

export const dynamic = "force-dynamic";

const CID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params;
  if (!CID_RE.test(cid)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const conversation = getConversation(cid);
  if (!conversation) {
    return NextResponse.json({ error: "conversation not found: " + cid }, { status: 404 });
  }
  return NextResponse.json({ conversation, messages: loadTranscript(cid) });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params;
  if (!CID_RE.test(cid)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  if (!getConversation(cid)) {
    return NextResponse.json({ error: "conversation not found: " + cid }, { status: 404 });
  }
  let body: { messages?: ChatMessage[]; sessionId?: string | null; costUsd?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (!Array.isArray(body?.messages)) {
    return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
  }
  const written = saveTranscript(cid, body.messages, {
    sessionId: body.sessionId ?? null,
    costUsd: body.costUsd,
  });
  return NextResponse.json({ written });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params;
  if (!CID_RE.test(cid)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  if (!deleteConversation(cid)) {
    return NextResponse.json({ error: "conversation not found: " + cid }, { status: 404 });
  }
  return NextResponse.json({ deleted: cid });
}
