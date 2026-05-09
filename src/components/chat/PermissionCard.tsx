"use client";

import type { PermissionRequest } from "@/lib/chat-types";
import { toolPreview } from "@/lib/tool-preview";

type DecideFn = (toolUseId: string, decision: "allow" | "deny", always?: boolean) => void;

export function PermissionCard({
  req,
  onDecide,
}: {
  req: PermissionRequest;
  onDecide?: DecideFn;
}) {
  const preview = toolPreview(req.input);
  const pending = req.status === "pending";
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] w-full border rounded-lg bg-white border-amber-300 overflow-hidden">
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs">
          <span className="font-medium text-amber-900">
            {req.title || `Allow ${req.tool_name}?`}
          </span>
          <span className="mono text-zinc-500 ml-auto">{req.display_name || req.tool_name}</span>
        </div>
        {preview && (
          <div className="px-3 py-2 mono text-xs text-zinc-700 bg-zinc-50 border-b border-zinc-200 break-all">
            {preview}
          </div>
        )}
        {req.description && (
          <div className="px-3 py-2 text-xs text-zinc-600">{req.description}</div>
        )}
        {pending ? (
          <Actions toolUseId={req.tool_use_id} onDecide={onDecide} />
        ) : (
          <Verdict status={req.status === "allowed" ? "allowed" : "denied"} always={!!req.always} />
        )}
      </div>
    </div>
  );
}

function Actions({ toolUseId, onDecide }: { toolUseId: string; onDecide?: DecideFn }) {
  return (
    <div className="px-3 py-2 flex flex-wrap gap-2 text-xs">
      <button
        onClick={() => onDecide?.(toolUseId, "allow", false)}
        className="px-3 py-1.5 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700"
      >
        Allow
      </button>
      <button
        onClick={() => onDecide?.(toolUseId, "allow", true)}
        className="px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium hover:bg-emerald-100"
      >
        Allow always
      </button>
      <button
        onClick={() => onDecide?.(toolUseId, "deny", false)}
        className="px-3 py-1.5 rounded-md bg-rose-600 text-white font-medium hover:bg-rose-700"
      >
        Reject
      </button>
    </div>
  );
}

function Verdict({ status, always }: { status: "allowed" | "denied"; always: boolean }) {
  if (status === "allowed") {
    return (
      <div className="px-3 py-2 text-xs text-emerald-700 bg-emerald-50 border-t border-emerald-100">
        Allowed{always ? " · always for this session" : ""}
      </div>
    );
  }
  return (
    <div className="px-3 py-2 text-xs text-rose-700 bg-rose-50 border-t border-rose-100">
      Denied
    </div>
  );
}
