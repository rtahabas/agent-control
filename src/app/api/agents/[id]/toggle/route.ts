import { NextResponse } from "next/server";
import { toggleAgent } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[a-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid agent id" }, { status: 400 });
  }
  try {
    const { changed, status } = toggleAgent(id);
    if (!changed) {
      return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
    }
    return NextResponse.json({ id, status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "toggle failed: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
