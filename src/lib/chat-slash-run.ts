"use client";

import type { ChatMessage } from "@/lib/chat-types";
import { rand } from "@/lib/chat-fmt";
import { clearSnapshot } from "@/lib/chat-helpers";
import { resetRun } from "@/lib/chat-store";
import {
  parseSlash,
  helpText,
  fetchCustomCommandNames,
  fetchCustomCommand,
  fetchAgentModel,
  setAgentModel,
} from "@/lib/slash-commands";

type SetMessages = (updater: (arr: ChatMessage[]) => ChatMessage[]) => void;

/**
 * `done` — answered here, nothing goes to the agent.
 * `send` — expanded into the prompt to send instead of the raw text.
 */
export type SlashOutcome = { kind: "done" } | { kind: "send"; message: string };

function reply(trimmed: string, text: string, setMessages: SetMessages) {
  const echo: ChatMessage = { id: rand(), role: "user", text: trimmed };
  const out: ChatMessage = { id: rand(), role: "assistant", text, done: true };
  setMessages((m) => [...m, echo, out]);
}

/**
 * Handles the slash commands this chat can answer itself.
 *
 * The dashboard talks to the Agent SDK, not the CLI's interactive prompt, so a
 * slash command typed here never reaches a REPL that could interpret it. The
 * dashboard-native ones are answered locally; a project command from
 * `.claude/commands/<name>.md` is expanded into an ordinary prompt.
 */
export async function runSlashCommand(
  agentId: string,
  trimmed: string,
  setMessages: SetMessages
): Promise<SlashOutcome> {
  const parsed = parseSlash(trimmed);

  if (parsed?.name === "clear") {
    resetRun(agentId);
    clearSnapshot(agentId);
    return { kind: "done" };
  }

  if (!parsed || parsed.name === "help") {
    reply(trimmed, helpText(await fetchCustomCommandNames(agentId)), setMessages);
    return { kind: "done" };
  }

  if (parsed.name === "model") {
    reply(trimmed, await modelReply(agentId, parsed.args), setMessages);
    return { kind: "done" };
  }

  const body = await fetchCustomCommand(agentId, parsed.name);
  if (body == null) {
    reply(trimmed, `Unknown command: /${parsed.name}. Type /help for the list.`, setMessages);
    return { kind: "done" };
  }
  return { kind: "send", message: parsed.args ? `${body}\n\n${parsed.args}` : body };
}

async function modelReply(agentId: string, args: string | undefined): Promise<string> {
  if (!args) {
    const cur = await fetchAgentModel(agentId);
    return (
      `Current model: ${cur ?? "(default)"}\n` +
      `Set with: /model <name>  (e.g. opus[1m], sonnet, haiku, claude-opus-4-8[1m])\n` +
      `Takes effect on the next message/session.`
    );
  }
  const r = await setAgentModel(agentId, args);
  return r.ok
    ? `Model set to "${args}". Takes effect on the next message/session.`
    : `Failed to set model: ${r.error}`;
}
