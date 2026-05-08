import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getAgentPath } from "@/lib/db";

export const dynamic = "force-dynamic";

const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

type Resolved =
  | { ok: true; skillDir: string; skillFile: string }
  | { ok: false; error: string; status: number };

function resolveSkill(agentId: string, name: string): Resolved {
  if (!name || !NAME_RE.test(name) || name.length > 64) {
    return { ok: false, error: "invalid skill name", status: 400 };
  }
  const agentPath = getAgentPath(agentId);
  if (!agentPath) return { ok: false, error: "agent not found: " + agentId, status: 404 };
  const skillsRoot = path.resolve(agentPath, ".claude", "skills");
  const skillDir = path.resolve(skillsRoot, name);
  if (!skillDir.startsWith(skillsRoot + path.sep)) {
    return { ok: false, error: "path traversal blocked", status: 400 };
  }
  return { ok: true, skillDir, skillFile: path.join(skillDir, "SKILL.md") };
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  const { id, name } = await params;
  const r = resolveSkill(id, name);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  try {
    const content = await fs.readFile(r.skillFile, "utf8");
    return NextResponse.json({ content });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return NextResponse.json({ error: "skill not found" }, { status: 404 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  const { id, name } = await params;
  const r = resolveSkill(id, name);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const c = await readContent(req);
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status });
  try {
    await fs.writeFile(r.skillFile, c.content, "utf8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  const { id, name } = await params;
  const r = resolveSkill(id, name);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const c = await readContent(req);
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: c.status });
  try {
    await fs.access(r.skillFile);
    return NextResponse.json({ error: "skill already exists" }, { status: 409 });
  } catch { /* not exists */ }
  try {
    await fs.mkdir(r.skillDir, { recursive: true });
    await fs.writeFile(r.skillFile, c.content, "utf8");
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  const { id, name } = await params;
  const r = resolveSkill(id, name);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  try {
    await fs.rm(r.skillDir, { recursive: true, force: false });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return NextResponse.json({ error: "skill not found" }, { status: 404 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
