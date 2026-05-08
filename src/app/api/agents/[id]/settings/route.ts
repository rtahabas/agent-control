import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getAgentPath } from "@/lib/db";

export const dynamic = "force-dynamic";

function settingsPath(agentPath: string): string {
  return path.join(agentPath, ".claude", "settings.json");
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
  try {
    const content = await fs.readFile(settingsPath(agentPath), "utf8");
    return NextResponse.json({ content });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return NextResponse.json({ content: "" });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agentPath = getAgentPath(id);
  if (!agentPath) {
    return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
  }
  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json (request body)" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "missing content" }, { status: 400 });
  }
  try {
    JSON.parse(body.content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "invalid JSON: " + msg }, { status: 400 });
  }
  try {
    const target = settingsPath(agentPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body.content, "utf8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
