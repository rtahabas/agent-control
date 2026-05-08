export interface SseBlock {
  event: string;
  payload: Record<string, unknown> | null;
}

export function parseSseBlock(block: string): SseBlock | null {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    const payload = JSON.parse(data) as Record<string, unknown>;
    return { event, payload };
  } catch {
    return null;
  }
}
