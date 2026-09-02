import { NextResponse } from "next/server";
import { searchMessages } from "@/lib/conversations";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-z0-9_-]+$/;
const MAX = 50;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const agent = url.searchParams.get("agent");

  if (agent && !ID_RE.test(agent)) {
    return NextResponse.json({ error: "invalid agent" }, { status: 400 });
  }
  // An empty query is not an error — it is a box nobody has typed in yet.
  return NextResponse.json({ hits: searchMessages(q, agent, MAX) });
}
