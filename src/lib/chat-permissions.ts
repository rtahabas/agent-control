import type { CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { agentHooks } from "@/lib/hooks";

export type EmitFn = (event: string, data: unknown) => void;

interface Pending {
  resolve: (r: PermissionResult) => void;
  toolName: string;
  sessionId: string | null;
}

// Module-level Maps are reset on Next.js dev hot-reload, which strands any
// in-flight canUseTool promise (its `pending` entry vanishes, so the next
// /api/chat/permission call 404s and the stream hangs forever). Caching on
// globalThis pins the Maps to the Node.js process lifetime instead.
const globalForChatPermissions = globalThis as unknown as {
  __chatPending?: Map<string, Pending>;
  __chatPendingQuestions?: Map<string, (answers: Record<string, string>) => void>;
  __chatSessionAllowlists?: Map<string, Set<string>>;
};
const pending = (globalForChatPermissions.__chatPending ??= new Map<string, Pending>());
const pendingQuestions = (globalForChatPermissions.__chatPendingQuestions ??= new Map<
  string,
  (answers: Record<string, string>) => void
>());
const sessionAllowlists = (globalForChatPermissions.__chatSessionAllowlists ??= new Map<
  string,
  Set<string>
>());

export function answerQuestion(toolUseId: string, answers: Record<string, string>): boolean {
  const resolve = pendingQuestions.get(toolUseId);
  if (!resolve) return false;
  pendingQuestions.delete(toolUseId);
  resolve(answers);
  return true;
}

export function decidePermission(
  toolUseId: string,
  decision: "allow" | "deny",
  always?: boolean
): boolean {
  const p = pending.get(toolUseId);
  if (!p) return false;
  pending.delete(toolUseId);
  if (decision === "allow") {
    if (always && p.sessionId) {
      let set = sessionAllowlists.get(p.sessionId);
      if (!set) {
        set = new Set();
        sessionAllowlists.set(p.sessionId, set);
      }
      set.add(p.toolName);
    }
    p.resolve({ behavior: "allow", updatedInput: {} } as PermissionResult);
  } else {
    p.resolve({ behavior: "deny", message: "denied by user", interrupt: false });
  }
  return true;
}

/**
 * Tools this session auto-allows because of an earlier "Allow always". These
 * skip the permission card entirely (see the allowlist check in makeCanUseTool),
 * so they need to be inspectable — otherwise a mis-click grants a tool for the
 * rest of the session with nothing to show for it.
 */
export function listSessionAllowlist(sessionId: string | null): string[] {
  if (!sessionId) return [];
  return [...(sessionAllowlists.get(sessionId) ?? [])].sort();
}

/**
 * Undo an auto-allow, so the tool asks again. Omit `toolName` to clear the whole
 * session. Returns whether anything was actually removed.
 */
export function revokeSessionAllow(sessionId: string | null, toolName?: string): boolean {
  if (!sessionId) return false;
  const set = sessionAllowlists.get(sessionId);
  if (!set) return false;
  if (toolName === undefined) return sessionAllowlists.delete(sessionId);
  const removed = set.delete(toolName);
  if (set.size === 0) sessionAllowlists.delete(sessionId);
  return removed;
}

export function makeCanUseTool(emit: EmitFn, getSessionId: () => string | null): CanUseTool {
  return async (toolName, input, opts) => {
    const sid = getSessionId();

    const beforeCtx = await agentHooks.emit("before_tool_call", {
      toolName,
      input: { ...input },
      sessionId: sid,
    });
    const finalInput = beforeCtx.input;

    let decision: PermissionResult;
    if (toolName === "AskUserQuestion") {
      decision = await handleAskUserQuestion(emit, finalInput, opts);
    } else if (sid && sessionAllowlists.get(sid)?.has(toolName)) {
      decision = { behavior: "allow", updatedInput: finalInput };
    } else {
      decision = await new Promise<PermissionResult>((resolve) => {
        const id = opts.toolUseID;
        pending.set(id, {
          resolve: (r) => resolve(r.behavior === "allow" ? { ...r, updatedInput: finalInput } : r),
          toolName,
          sessionId: sid,
        });
        emit("permission_request", {
          tool_use_id: id,
          tool_name: toolName,
          input: finalInput,
          title: opts.title ?? null,
          display_name: opts.displayName ?? null,
          description: opts.description ?? null,
        });
        opts.signal.addEventListener("abort", () => {
          pending.delete(id);
          resolve({ behavior: "deny", message: "aborted", interrupt: true });
        });
      });
    }

    await agentHooks.emit("after_tool_call", {
      toolName,
      input: finalInput,
      result: decision,
      sessionId: sid,
    });

    return decision;
  };
}

async function handleAskUserQuestion(
  emit: EmitFn,
  input: Record<string, unknown>,
  opts: { toolUseID: string; signal: AbortSignal }
): Promise<PermissionResult> {
  return await new Promise<PermissionResult>((resolve) => {
    const id = opts.toolUseID;
    pendingQuestions.set(id, (answers) => {
      const lines = Object.entries(answers).map(([q, a]) => `${q}: ${a}`).join("\n");
      resolve({ behavior: "deny", message: `User answered:\n${lines}`, interrupt: false });
    });
    emit("ask_user_question", { tool_use_id: id, input });
    opts.signal.addEventListener("abort", () => {
      pendingQuestions.delete(id);
      resolve({ behavior: "deny", message: "aborted", interrupt: true });
    });
  });
}
