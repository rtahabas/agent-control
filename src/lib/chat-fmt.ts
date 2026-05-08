export function fmtNum(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function fmtCost(n: number): string {
  if (n < 0.001) return "<$0.001";
  if (n < 1) return "$" + n.toFixed(4);
  return "$" + n.toFixed(3);
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(2) + "s";
}

export function rand(): string {
  return Math.random().toString(36).slice(2, 10);
}
