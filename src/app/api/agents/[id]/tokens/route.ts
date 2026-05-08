import { NextResponse } from "next/server";
import { getAgentPath } from "@/lib/db";
import { collectTokenStats } from "@/lib/token-stats";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agentPath = getAgentPath(id);
  if (!agentPath) {
    return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
  }
  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");
  const days = daysParam ? Math.max(1, Math.min(90, Number(daysParam) || 7)) : 7;
  try {
    const stats = await collectTokenStats(agentPath, days);
    return NextResponse.json(stats);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
