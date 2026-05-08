import { NextResponse } from "next/server";
import { sendTelegram, formatNotification } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let agent: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    agent = typeof body?.agent === "string" ? body.agent : undefined;
  } catch { /* ignore */ }

  const text = formatNotification({
    event: "test",
    agent,
    message: "Hello from Agent Control. If you see this, outbound notifications are wired up.",
  });
  const result = await sendTelegram(text);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.description ?? "send failed", status: result.status },
      { status: result.status >= 400 ? result.status : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
