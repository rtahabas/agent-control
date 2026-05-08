import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getAgentPath } from "@/lib/db";
import { parseFrontmatter } from "@/lib/skill-fs";

export const dynamic = "force-dynamic";

export interface SubAgentSummary {
  name: string;
  description: string;
  model: string;
  isolation: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agentPath = getAgentPath(id);
  if (!agentPath) {
    return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
  }
  const dir = path.join(agentPath, ".claude", "agents");
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return NextResponse.json({ subAgents: [] });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  const out: SubAgentSummary[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".md")) continue;
    const raw = await fs.readFile(path.join(dir, e.name), "utf8").catch(() => "");
    const meta = parseFrontmatter(raw);
    out.push({
      name: meta.name || e.name.replace(/\.md$/, ""),
      description: meta.description || "",
      model: meta.model || "",
      isolation: meta.isolation || "",
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ subAgents: out });
}
