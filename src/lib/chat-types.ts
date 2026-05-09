export type ChatRole = "user" | "assistant" | "tool" | "permission" | "question";

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionItem {
  question: string;
  header?: string;
  multiSelect?: boolean;
  options: QuestionOption[];
}

export type QuestionStatus = "pending" | "answered";

export interface QuestionRequest {
  tool_use_id: string;
  questions: QuestionItem[];
  answers?: Record<string, string>;
  status: QuestionStatus;
}

export interface ToolCall {
  index: number;
  name: string;
  id: string | null;
  input?: Record<string, unknown> | null;
  done?: boolean;
}

export type PermissionStatus = "pending" | "allowed" | "denied";

export interface PermissionRequest {
  tool_use_id: string;
  tool_name: string;
  input: Record<string, unknown>;
  title?: string | null;
  display_name?: string | null;
  description?: string | null;
  status: PermissionStatus;
  always?: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  streaming?: boolean;
  done?: boolean;
  tool?: ToolCall;
  permission?: PermissionRequest;
  question?: QuestionRequest;
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
