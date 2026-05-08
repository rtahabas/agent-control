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

async function readContent(req: Request) {
  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return { ok: false, status: 400, error: "bad json" } as const;
  }
  if (typeof body.content !== "string") {
    return { ok: false, status: 400, error: "missing content" } as const;
  }
  return { ok: true, content: body.content } as const;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const r = resolveFile(id, searchParams.get("path"));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const c = await readContent(req);
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status });
  try {
    await fs.writeFile(r.target, c.content, "utf8");
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const r = resolveFile(id, searchParams.get("path"));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const c = await readContent(req);
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status });
  try {
    await fs.access(r.target);
    return NextResponse.json({ error: "file already exists" }, { status: 409 });
  } catch { /* not exists, continue */ }
  try {
    await fs.mkdir(path.dirname(r.target), { recursive: true });
    await fs.writeFile(r.target, c.content, "utf8");
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const r = resolveFile(id, searchParams.get("path"));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  try {
    await fs.unlink(r.target);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return NextResponse.json({ error: "file not found" }, { status: 404 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
