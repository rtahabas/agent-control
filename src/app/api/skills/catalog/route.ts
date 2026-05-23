import { NextResponse } from "next/server";
import { readSkillsCatalog, resolveSkillsDir } from "@/lib/skills-catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId")?.trim();
    let sourceDir: string | undefined;
    if (agentId) {
      const resolved = resolveSkillsDir(agentId);
      if (!resolved) {
        return NextResponse.json(
          { error: "agent not found: " + agentId },
          { status: 404 },
        );
      }
      sourceDir = resolved;
    }
    const skills = await readSkillsCatalog(sourceDir);
    return NextResponse.json({ skills });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
