import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getAgentPath } from "@/lib/db";

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
  const memoryDir = path.join(agentPath, "memory");
  try {
    const entries = await fs.readdir(memoryDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name)
      .sort();
    return NextResponse.json({ files });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return NextResponse.json({ files: [] });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
