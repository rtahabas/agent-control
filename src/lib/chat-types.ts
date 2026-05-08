export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  streaming?: boolean;
  done?: boolean;
}

export interface TurnUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface TurnInfo {
  cost_usd: number;
  duration_ms: number;
  duration_api_ms?: number;
  num_turns?: number;
  model?: string | null;
  usage?: TurnUsage | null;
  context_window?: number | null;
}

export interface CumulativeStats {
  turns: number;
  total_cost_usd: number;
  total_input: number;
  total_output: number;
  total_cache_read: number;
  total_cache_creation: number;
  total_duration_ms: number;
}

export const EMPTY_STATS: CumulativeStats = {
  turns: 0,
  total_cost_usd: 0,
  total_input: 0,
  total_output: 0,
  total_cache_read: 0,
  total_cache_creation: 0,
  total_duration_ms: 0,
};

export interface ChatSnapshot {
  messages: ChatMessage[];
  sessionId: string | null;
  lastTurn: TurnInfo | null;
  stats: CumulativeStats;
}
