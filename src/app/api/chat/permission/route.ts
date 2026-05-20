import { NextResponse } from "next/server";
import { decidePermission } from "@/lib/claude-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DecideBody {
  tool_use_id: string;
  decision: "allow" | "deny";
  always?: boolean;
}

export async function POST(req: Request) {
  let body: DecideBody;
  try {
    body = (await req.json()) as DecideBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.tool_use_id || (body.decision !== "allow" && body.decision !== "deny")) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  const ok = decidePermission(body.tool_use_id, body.decision, body.always);
  if (!ok) {
    // The permission request either already resolved, was aborted, or the
    // pending map was lost across a server restart. Surface "expired" so
    // the UI can mark the orphan card without a console-spamming 404.
    return NextResponse.json(
      { ok: false, reason: "expired" },
      { status: 410 },
    );
  }
  return NextResponse.json({ ok: true });
}
