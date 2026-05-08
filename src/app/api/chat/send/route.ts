import { NextResponse } from "next/server";
import fs from "fs";
import { getAgentPath } from "@/lib/db";
import { spawnClaude } from "@/lib/claude-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SendBody {
  agent_id: string;
  message: string;
  session_id?: string | null;
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return badRequest("bad json");
  }
  const agentId = (body.agent_id || "").trim();
  const message = (body.message || "").trim();
  if (!agentId || !/^[a-z0-9_-]+$/.test(agentId)) return badRequest("invalid agent_id");
  if (!message) return badRequest("empty message");
  const agentPath = getAgentPath(agentId);
  if (!agentPath) return badRequest("agent not found", 404);
  if (!fs.existsSync(agentPath) || !fs.statSync(agentPath).isDirectory()) {
    return badRequest("agent path missing", 500);
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      let aborted = false;
      const emit = (event: string, data: unknown) => {
        if (aborted) return;
        try {
          controller.enqueue(enc.encode(sse(event, data)));
        } catch {
          aborted = true;
        }
      };
      const close = () => {
        try { controller.close(); } catch { /* ignore */ }
      };
      spawnClaude({
        message,
        sessionId: body.session_id,
        cwd: agentPath,
        emit,
        onClose: close,
        abortSignal: req.signal,
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
