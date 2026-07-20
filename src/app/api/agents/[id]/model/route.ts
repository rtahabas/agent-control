import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getAgentPath } from "@/lib/db";

// Dashboard-native /model: reads/writes the agent's .claude/settings.json "model" field.
// GET → { model: string | null }
// PUT { model } → writes settings.json.model, returns { model } (400 on empty/unsafe value).
const settingsFile = (agentPath: string) => path.join(agentPath, ".claude", "settings.json");

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentPath = getAgentPath(id);
  if (!agentPath) return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });
  try {
    const raw = await fs.readFile(settingsFile(agentPath), "utf8");
    const parsed = JSON.parse(raw) as { model?: unknown };
    return NextResponse.json({ model: typeof parsed.model === "string" ? parsed.model : null });
  } catch {
    return NextResponse.json({ model: null });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentPath = getAgentPath(id);
  if (!agentPath) return NextResponse.json({ error: "agent not found: " + id }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { model?: unknown };
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model) return NextResponse.json({ error: "model required" }, { status: 400 });
  // Model ids/aliases are simple tokens (e.g. opus, sonnet, claude-opus-4-8[1m]).
  if (!/^[a-zA-Z0-9._[\]-]+$/.test(model)) {
    return NextResponse.json({ error: "invalid model value" }, { status: 400 });
  }

  const file = settingsFile(agentPath);
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
  } catch {
    obj = { $schema: "https://json.schemastore.org/claude-code-settings.json" };
  }
  obj.model = model;
  await fs.writeFile(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
  return NextResponse.json({ model });
}
