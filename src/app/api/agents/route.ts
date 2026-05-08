import { NextResponse } from "next/server";
import fs from "fs";
import { getAgents, getAgent, createAgent } from "@/lib/db";
import { ID_RE, slugify } from "@/lib/id-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agents = getAgents();
    return NextResponse.json({ agents, count: agents.length });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "agents read failed: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}

interface CreateBody {
  id?: string;
  name?: string;
  path?: string;
  notes?: string | null;
}

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  const path = (body.path || "").trim();
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });
  if (!path) return NextResponse.json({ error: "missing path" }, { status: 400 });
  if (!path.startsWith("/")) {
    return NextResponse.json({ error: "path must be absolute" }, { status: 400 });
  }
  if (!fs.existsSync(path) || !fs.statSync(path).isDirectory()) {
    return NextResponse.json({ error: "path not a directory: " + path }, { status: 400 });
  }
  const id = (body.id?.trim() || slugify(name)) || "";
  if (!ID_RE.test(id)) {
    return NextResponse.json(
      { error: "invalid id (use a-z, 0-9, _, -; max 64 chars)" },
      { status: 400 }
    );
  }
  if (getAgent(id)) {
    return NextResponse.json({ error: "id already exists: " + id }, { status: 409 });
  }
  try {
    const agent = createAgent({ id, name, path, notes: body.notes ?? null });
    return NextResponse.json({ agent }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "create failed: " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
