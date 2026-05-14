import type { CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { agentHooks } from "@/lib/hooks";

export type EmitFn = (event: string, data: unknown) => void;

interface Pending {
  resolve: (r: PermissionResult) => void;
  toolName: string;
  sessionId: string | null;
}

const pending = new Map<string, Pending>();
const pendingQuestions = new Map<string, (answers: Record<string, string>) => void>();
const sessionAllowlists = new Map<string, Set<string>>();

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
