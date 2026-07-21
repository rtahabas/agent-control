export interface SseBlock {
  event: string;
  payload: Record<string, unknown> | null;
}

export function parseSseBlock(block: string): SseBlock | null {
  let event = "message";
  // Per the SSE spec a field may span several `data:` lines and the value is
  // their newline join. Concatenating them bare — as this did — silently welds
  // two fragments together, and the only symptom is a block that fails to parse
  // and gets dropped. Today's server emits one line per event so it never fired;
  // collecting properly means a future multi-line emitter cannot resurrect it.
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (data.length === 0) return null;
  const joined = data.join("\n").trim();
  if (!joined) return null;
  try {
    const payload = JSON.parse(joined) as Record<string, unknown>;
    return { event, payload };
  } catch {
    return null;
  }
}
