import { NextResponse } from "next/server";
import { isValidSkillName, toggleSkillEnabled } from "@/lib/skill-state";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!isValidSkillName(name)) {
    return NextResponse.json({ error: "invalid skill name" }, { status: 400 });
  }
  try {
    const { enabled } = toggleSkillEnabled(name);
    return NextResponse.json({ name, enabled });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "toggle failed: " + msg }, { status: 500 });
  }
}
