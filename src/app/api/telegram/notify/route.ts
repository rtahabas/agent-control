import { NextResponse } from "next/server";
import { sendTelegram, formatNotification, type NotifyEvent } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: NotifyEvent;
  try {
    body = (await req.json()) as NotifyEvent;
  } catch (e) {
    return NextResponse.json(
      { error: "invalid json: " + (e instanceof Error ? e.message : String(e)) },
      { status: 400 }
    );
  }
  if (!body || typeof body.event !== "string") {
    return NextResponse.json({ error: "event field is required" }, { status: 400 });
  }
  const text = formatNotification(body);
  const result = await sendTelegram(text);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.description ?? "send failed", status: result.status },
      { status: result.status >= 400 ? result.status : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
