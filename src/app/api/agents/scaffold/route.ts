import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getAgent, createAgent } from "@/lib/db";
import { ID_RE, slugify } from "@/lib/id-utils";
import { scaffold, pathIsEmpty } from "@/lib/scaffolder";

export const dynamic = "force-dynamic";

interface Identity {
  role?: string;
  mission?: string;
  language?: string;
  personality?: string;
  human?: string;
}

interface ScaffoldBody {
  id?: string;
  name?: string;
  path?: string;
  notes?: string | null;
  identity?: Identity;
  skills?: string[];
  template?: string;
}

const FALLBACK = {
  ROLE: "Autonomous engineering agent. Not a chatbot.",
  MISSION: "_(set on first session)_",
  LANGUAGE: "_(set on first session)_",
  PERSONALITY: "Direct, pragmatic, engineer-mode. No filler.",
  HUMAN: "_(unset)_",
};

function pickToken(v: string | undefined, fallback: string): string {
  const trimmed = (v ?? "").trim();
  return trimmed || fallback;
}

export async function POST(req: Request) {
  let body: ScaffoldBody;
  try {
    body = (await req.json()) as ScaffoldBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  const targetPath = (body.path || "").trim();
  const template = (body.template || "blank").trim();
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });
  if (!targetPath) return NextResponse.json({ error: "missing path" }, { status: 400 });
  if (!targetPath.startsWith("/")) {
    return NextResponse.json({ error: "path must be absolute" }, { status: 400 });
  }
  if (!(await pathIsEmpty(targetPath))) {
    return NextResponse.json({ error: "path is not empty: " + targetPath }, { status: 400 });
  }
  const id = (body.id?.trim() || slugify(name)) || "";
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  if (getAgent(id)) {
    return NextResponse.json({ error: "id already exists: " + id }, { status: 409 });
  }
  const ident = body.identity ?? {};
  const tokens = {
    AGENT_NAME: name,
    ROLE: pickToken(ident.role, FALLBACK.ROLE),
    MISSION: pickToken(ident.mission, FALLBACK.MISSION),
    LANGUAGE: pickToken(ident.language, FALLBACK.LANGUAGE),
    PERSONALITY: pickToken(ident.personality, FALLBACK.PERSONALITY),
    HUMAN: pickToken(ident.human, FALLBACK.HUMAN),
    TODAY: new Date().toISOString().slice(0, 10),
  };
  const skills = Array.isArray(body.skills) ? body.skills.filter((s) => /^[a-z0-9_-]+$/i.test(s)) : [];
  try {
    await fs.mkdir(targetPath, { recursive: true });
    await scaffold({ template, target: targetPath, tokens, skills });
    const agent = createAgent({ id, name, path: targetPath, notes: body.notes ?? null });
    return NextResponse.json({ agent }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "scaffold failed: " + msg }, { status: 500 });
  }
}
