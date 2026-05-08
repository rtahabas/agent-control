import { NextResponse } from "next/server";
import path from "node:path";
import { getAgentPath } from "@/lib/db";
import { readSkillsDir } from "@/lib/skill-fs";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agentPath = getAgentPath(id);
  if (!agentPath) {
    return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
  }
  const skillsDir = path.join(agentPath, ".claude", "skills");
  const skills = await readSkillsDir(skillsDir);
  return NextResponse.json({ skills });
}
