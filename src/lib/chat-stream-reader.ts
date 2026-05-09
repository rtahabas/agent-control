"use client";

export async function streamSse(
  res: Response,
  onBlock: (block: string) => void
): Promise<void> {
  if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      onBlock(buf.slice(0, sep));
      buf = buf.slice(sep + 2);
    }
  }
}
