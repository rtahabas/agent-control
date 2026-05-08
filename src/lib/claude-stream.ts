import { spawn } from "child_process";

export type EmitFn = (event: string, data: unknown) => void;

export function buildClaudeArgs(message: string, sessionId: string | null | undefined): string[] {
  const args = [
    "-p",
    message,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
  ];
  if (sessionId && /^[a-f0-9-]{8,}$/.test(sessionId)) {
    args.push("--resume", sessionId);
  }
  return args;
}

export function spawnClaude({
  message,
  sessionId,
  cwd,
  emit,
  onClose,
  abortSignal,
}: {
  message: string;
  sessionId: string | null | undefined;
  cwd: string;
  emit: EmitFn;
  onClose: () => void;
  abortSignal: AbortSignal;
}) {
  const child = spawn("claude", buildClaudeArgs(message, sessionId), {
    cwd,
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  let buf = "";
  let sessionEmitted = false;
  let aborted = false;

  child.stdout.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf-8");
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        const next = handleLine(line, sessionEmitted, emit);
        if (next) sessionEmitted = true;
      }
    }
  });

  child.stderr.on("data", () => {
    /* swallow noisy hook stderr */
  });

  child.on("error", (err) => {
    if (!aborted) emit("error", { message: "spawn failed: " + err.message });
    onClose();
  });

  child.on("close", (code) => {
    if (code !== 0 && !aborted) emit("error", { message: "claude exited " + code });
    onClose();
  });

  abortSignal.addEventListener("abort", () => {
    aborted = true;
    try { child.kill("SIGTERM"); } catch { /* ignore */ }
  });
}

function handleLine(line: string, sessionEmitted: boolean, emit: EmitFn): boolean {
  let evt: Record<string, unknown>;
  try {
    evt = JSON.parse(line);
  } catch {
    return false;
  }
  const type = evt.type as string | undefined;
  if (type === "system" && evt.subtype === "init" && !sessionEmitted) {
    emit("session", { id: evt.session_id });
    return true;
  }
  if (type === "stream_event") {
    const inner = evt.event as Record<string, unknown> | undefined;
    if (inner?.type === "content_block_delta") {
      const delta = inner.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        emit("delta", { text: delta.text });
      }
    }
    return false;
  }
  if (type === "result") {
    const usage = evt.usage as Record<string, unknown> | undefined;
    const modelUsage = evt.modelUsage as Record<string, Record<string, unknown>> | undefined;
    const modelKey = modelUsage ? Object.keys(modelUsage)[0] : null;
    emit("done", {
      reason: evt.stop_reason,
      duration_ms: evt.duration_ms,
      duration_api_ms: evt.duration_api_ms,
      num_turns: evt.num_turns,
      cost_usd: evt.total_cost_usd,
      model: modelKey,
      usage: usage
        ? {
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            cache_read_input_tokens: usage.cache_read_input_tokens,
            cache_creation_input_tokens: usage.cache_creation_input_tokens,
          }
        : null,
      context_window:
        modelKey && modelUsage ? (modelUsage[modelKey].contextWindow as number) : null,
    });
  }
  return false;
}
