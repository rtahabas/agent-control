"use client";

import { useSyncExternalStore } from "react";
import { getAttention, subscribeAny, type AgentAttention } from "@/lib/chat-store";

const EMPTY: Record<string, AgentAttention> = {};

/**
 * Live status for every agent, not just the one on screen.
 *
 * The chat panel is mounted once for the selected agent, so anything that only
 * watched that panel could not tell you a different agent had stopped and was
 * waiting on a permission card. This reads the store directly instead.
 */
export function useAgentAttention(): Record<string, AgentAttention> {
  return useSyncExternalStore(subscribeAny, getAttention, () => EMPTY);
}
