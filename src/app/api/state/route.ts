import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "node:path";
import { getAgentPath } from "@/lib/db";

const execFileP = promisify(execFile);

const STATE_SCRIPT = path.join(process.cwd(), "scripts", "state-json.sh");

export const dynamic = "force-dynamic";

const EMPTY_STATE = {
  generated: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  projects: [],
  skills: { window_days: 30, installed_count: 0, total_invocations: 0, active: [], inactive: [], dead: [], external: [] },
  sub_agents: [],
  memory: { total_files: 0, total_lines: 0, modified_last_7d: 0, modified_last_30d: 0, categories: { feedback: 0, project: 0, pending: 0, other: 0 }, indexes: [] },
  pending: [],
  hooks: { SessionStart: 0, PreToolUse: 0, PostToolUse: 0, Stop: 0 },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json(EMPTY_STATE);
  }

  const agentPath = getAgentPath(agentId);
  if (!agentPath) {
    return NextResponse.json({ error: "agent not found: " + agentId }, { status: 404 });
  }

  try {
    const { stdout } = await execFileP(STATE_SCRIPT, ["--root", agentPath], {
      maxBuffer: 8 * 1024 * 1024,
      timeout: 30000,
    });
    return new NextResponse(stdout, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "state script failed: " + msg }, { status: 500 });
  }
}
