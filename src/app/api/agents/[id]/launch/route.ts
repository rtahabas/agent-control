import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { getAgentPath } from "@/lib/db";

const execp = promisify(exec);
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[a-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid agent id" }, { status: 400 });
  }
  const agentPath = getAgentPath(id);
  if (!agentPath) {
    return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
  }
  if (!fs.existsSync(agentPath) || !fs.statSync(agentPath).isDirectory()) {
    return NextResponse.json({ error: "path not a directory: " + agentPath }, { status: 500 });
  }
  const safe = agentPath.replace(/"/g, '\\"');
  const script = `tell application "Terminal"\n  do script "cd \\"${safe}\\" && claude"\n  activate\nend tell`;
  try {
    await execp(`osascript -e ${JSON.stringify(script)}`, { timeout: 10000 });
    return NextResponse.json({ id, launched: true, path: agentPath });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "launch failed: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
