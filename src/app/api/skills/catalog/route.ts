import { NextResponse } from "next/server";
import { readSkillsCatalog } from "@/lib/skills-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const skills = await readSkillsCatalog();
    return NextResponse.json({ skills });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
