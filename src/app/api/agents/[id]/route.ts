import { NextResponse } from "next/server";
import fs from "fs";
import { getAgent, updateAgent, deleteAgent } from "@/lib/db";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-z0-9_-]+$/;

interface UpdateBody {
  name?: string;
  path?: string;
  notes?: string | null;
  status?: "active" | "inactive";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const agent = getAgent(id);
  if (!agent) {
    return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
  }
  return NextResponse.json({ agent });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (body.path !== undefined) {
    const p = body.path.trim();
    if (!p) return NextResponse.json({ error: "path empty" }, { status: 400 });
    if (!p.startsWith("/")) {
      return NextResponse.json({ error: "path must be absolute" }, { status: 400 });
    }
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
      return NextResponse.json({ error: "path not a directory: " + p }, { status: 400 });
    }
    body.path = p;
  }
  if (body.name !== undefined) {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: "name empty" }, { status: 400 });
    body.name = n;
  }
  try {
    const agent = updateAgent(id, body);
    if (!agent) {
      return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
    }
    return NextResponse.json({ agent });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "update failed: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const ok = deleteAgent(id);
    if (!ok) {
      return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
    }
    return NextResponse.json({ deleted: id });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "delete failed: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
