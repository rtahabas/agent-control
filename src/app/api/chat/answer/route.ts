import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/chat-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AnswerBody {
  tool_use_id: string;
  answers: Record<string, string>;
}

export async function POST(req: Request) {
  let body: AnswerBody;
  try {
    body = (await req.json()) as AnswerBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.tool_use_id || !body.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  const ok = answerQuestion(body.tool_use_id, body.answers);
  if (!ok) return NextResponse.json({ error: "request not pending" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
