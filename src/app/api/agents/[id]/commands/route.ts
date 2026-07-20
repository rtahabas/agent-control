import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getAgentPath } from "@/lib/db";

// Lists / reads an agent's custom slash commands (.claude/commands/<name>.md).
// GET                → { commands: string[] }   (names, no .md)
// GET ?name=<name>   → { name, content }        (404 if missing, 400 if name is unsafe)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const agentPath = getAgentPath(id);
  if (!agentPath) {
    return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
  }

  const dir = path.join(agentPath, ".claude", "commands");
  const name = new URL(req.url).searchParams.get("name");

  if (name) {
    // Guard against path traversal — command names are simple slugs only.
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json({ error: "invalid command name" }, { status: 400 });
    }
    try {
      const content = await fs.readFile(path.join(dir, `${name}.md`), "utf8");
      return NextResponse.json({ name, content });
    } catch {
      return NextResponse.json({ error: "command not found: " + name }, { status: 404 });
    }
  }

  try {
    const files = await fs.readdir(dir);
    const commands = files
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
    return NextResponse.json({ commands });
  } catch {
    return NextResponse.json({ commands: [] });
  }
}
