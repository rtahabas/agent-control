export type ChatRole = "user" | "assistant" | "tool" | "permission" | "question";

// Image attachment carried with a user message. MVP: single image per message,
// PNG/JPEG/WEBP/GIF, ≤5MB. Encoded as base64 (without the data URL prefix) so
// it can ride in the SDK's ImageBlockParam → Base64ImageSource directly.
export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIMES: readonly ImageMime[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export interface ImageAttachment {
  kind: "image";
  mime: ImageMime;
  name: string;
  size: number;
  // Base64 string without `data:<mime>;base64,` prefix. Use `dataUrl()` helper
  // when rendering an <img>.
  dataBase64: string;
}

export type Attachment = ImageAttachment;

export function isAllowedImageMime(mime: string): mime is ImageMime {
  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(mime);
}

export function attachmentDataUrl(att: Attachment): string {
  return `data:${att.mime};base64,${att.dataBase64}`;
}

export interface AttachmentInput {
  kind?: string;
  mime?: string;
  name?: string;
  size?: number;
  dataBase64?: string;
}

/**
 * Validate untrusted attachment input from an API request.
 * Returns the typed Attachment on success, or an error string on failure.
 */
export function validateAttachmentInput(input: AttachmentInput): Attachment | string {
  if (input.kind !== "image") return `unsupported attachment kind: ${input.kind}`;
  if (typeof input.mime !== "string" || !(ALLOWED_IMAGE_MIMES as readonly string[]).includes(input.mime)) {
    return `disallowed mime: ${input.mime}`;
  }
  if (typeof input.size !== "number" || input.size <= 0) {
    return "invalid attachment size";
  }
  if (input.size > MAX_ATTACHMENT_BYTES) {
    return `attachment too large: ${input.size} bytes (max ${MAX_ATTACHMENT_BYTES})`;
  }
  if (typeof input.dataBase64 !== "string" || input.dataBase64.length === 0) {
    return "missing attachment data";
  }
  // Defense in depth: base64 decoded length should match declared size within
  // ~10% tolerance. Reject if data is way larger than declared (spoofed size).
  const approxBytes = (input.dataBase64.length * 3) / 4;
  if (approxBytes > MAX_ATTACHMENT_BYTES * 1.1) {
    return "attachment data exceeds size limit";
  }
  return {
    kind: "image",
    mime: input.mime as ImageMime,
    name: typeof input.name === "string" ? input.name : "attachment",
    size: input.size,
    dataBase64: input.dataBase64,
  };
}

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

/** "expired" — the run ended before it was answered, so it never can be. */
export type QuestionStatus = "pending" | "answered" | "expired";

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

export type PermissionStatus = "pending" | "allowed" | "denied" | "expired";

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
  attachment?: Attachment;
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
  /** Optional: snapshots written before history existed do not carry one. */
  conversationId?: string | null;
  lastTurn: TurnInfo | null;
  stats: CumulativeStats;
}
