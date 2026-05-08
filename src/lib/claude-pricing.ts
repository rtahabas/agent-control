// USD per 1M tokens. Anthropic public pricing snapshot (2026 baseline).
// Update when Anthropic publishes new pricing. Cache write defaults to the 5m rate.
// Unknown models fall back to "default" entry.
export interface ModelPrice {
  input: number;
  output: number;
  cache_write_5m: number;
  cache_write_1h: number;
  cache_read: number;
}

const PRICES: Record<string, ModelPrice> = {
  "claude-opus-4-7": {
    input: 15,
    output: 75,
    cache_write_5m: 18.75,
    cache_write_1h: 30,
    cache_read: 1.5,
  },
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cache_write_5m: 3.75,
    cache_write_1h: 6,
    cache_read: 0.3,
  },
  "claude-haiku-4-5": {
    input: 0.8,
    output: 4,
    cache_write_5m: 1,
    cache_write_1h: 1.6,
    cache_read: 0.08,
  },
  default: {
    input: 3,
    output: 15,
    cache_write_5m: 3.75,
    cache_write_1h: 6,
    cache_read: 0.3,
  },
};

function familyKey(model: string): string {
  if (model.startsWith("claude-opus-4")) return "claude-opus-4-7";
  if (model.startsWith("claude-sonnet-4")) return "claude-sonnet-4-6";
  if (model.startsWith("claude-haiku-4")) return "claude-haiku-4-5";
  return "default";
}

export function priceFor(model: string | undefined): ModelPrice {
  if (!model) return PRICES.default;
  return PRICES[familyKey(model)] ?? PRICES.default;
}

export interface UsageBreakdown {
  input: number;
  output: number;
  cache_write_5m: number;
  cache_write_1h: number;
  cache_read: number;
}

export function costFor(model: string | undefined, u: UsageBreakdown): number {
  const p = priceFor(model);
  return (
    (u.input / 1e6) * p.input +
    (u.output / 1e6) * p.output +
    (u.cache_write_5m / 1e6) * p.cache_write_5m +
    (u.cache_write_1h / 1e6) * p.cache_write_1h +
    (u.cache_read / 1e6) * p.cache_read
  );
}
