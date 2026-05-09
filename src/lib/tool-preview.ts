export function toolPreview(input: Record<string, unknown> | null | undefined): string | null {
  if (!input) return null;
  const keys = ["command", "file_path", "path", "pattern", "url", "query", "description"];
  for (const k of keys) {
    const v = input[k];
    if (typeof v === "string" && v.trim()) return v.length > 200 ? v.slice(0, 197) + "…" : v;
  }
  return null;
}
