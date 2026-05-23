import { NextResponse } from "next/server";
import fs from "fs";
import { getAgentPath } from "@/lib/db";
import { claudeSdkAdapter } from "@/lib/claude-sdk-adapter";
import { registerRuntimeContext } from "@/lib/runtime-context-subscriber";
import { registerSkillSubscriptions } from "@/lib/skill-subscriber";
import {
  validateAttachmentInput,
  type Attachment,
  type AttachmentInput,
} from "@/lib/chat-types";

// Next.js JSON body limit needs raising for base64-encoded images (5MB raw →
// ~7MB base64). The Next 16 App Router parses bodies in-route via req.json(),
// which doesn't honor pages-router `bodyParser.sizeLimit`. We rely on the
// Node fetch parser's default streaming limit (≥10MB) and validate size
// ourselves below.

registerRuntimeContext();

// Skill registration is per-agent and lazy. Each agentId is registered once
// (idempotent on repeat) when the first chat message for that agent arrives.
// The Map tracks the in-flight registration promise per agentId so concurrent
// POSTs for the same agent await a single registration pass.
const skillsReadyByAgent = new Map<string, Promise<unknown>>();

function ensureSkillsRegistered(agentId: string): Promise<unknown> {
  let pending = skillsReadyByAgent.get(agentId);
  if (!pending) {
    pending = registerSkillSubscriptions({ agentId }).catch((err) => {
      console.error(`[chat/send] skill registration failed for ${agentId}:`, err);
    });
    skillsReadyByAgent.set(agentId, pending);
  }
  return pending;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SendBody {
  agent_id: string;
  message: string;
  session_id?: string | null;
  attachment?: AttachmentInput | null;
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
  let attachment: Attachment | null = null;
  if (body.attachment) {
    const validated = validateAttachmentInput(body.attachment);
    if (typeof validated === "string") return badRequest(validated);
    attachment = validated;
  }
  if (!message && !attachment) return badRequest("empty message");
  const agentPath = getAgentPath(agentId);
  if (!agentPath) return badRequest("agent not found", 404);
  if (!fs.existsSync(agentPath) || !fs.statSync(agentPath).isDirectory()) {
    return badRequest("agent path missing", 500);
  }

  // Register this agent's skills once (idempotent). Await before streaming.
  await ensureSkillsRegistered(agentId);

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
      void claudeSdkAdapter.runAttempt({
        agentId,
        message,
        attachment,
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
