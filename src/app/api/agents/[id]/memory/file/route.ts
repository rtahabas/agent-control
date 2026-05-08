import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getAgentPath } from "@/lib/db";

export const dynamic = "force-dynamic";

const NAME_RE = /^[A-Za-z0-9._-]+\.md$/;

type Resolved =
  | { ok: true; target: string }
  | { ok: false; error: string; status: number };

function resolveFile(agentId: string, name: string | null): Resolved {
  if (!name || !NAME_RE.test(name) || name.includes("..")) {
    return { ok: false, error: "invalid path", status: 400 };
  }
  const agentPath = getAgentPath(agentId);
  if (!agentPath) return { ok: false, error: "agent not found: " + agentId, status: 404 };
  const memoryDir = path.resolve(agentPath, "memory");
  const target = path.resolve(memoryDir, name);
  if (!target.startsWith(memoryDir + path.sep)) {
    return { ok: false, error: "path traversal blocked", status: 400 };
  }
  return { ok: true, target };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const r = resolveFile(id, searchParams.get("path"));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  try {
    const content = await fs.readFile(r.target, "utf8");
    return NextResponse.json({ content });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return NextResponse.json({ error: "file not found" }, { status: 404 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const r = resolveFile(id, searchParams.get("path"));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "missing content" }, { status: 400 });
  }
  try {
    await fs.writeFile(r.target, body.content, "utf8");
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
