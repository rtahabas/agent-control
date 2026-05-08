"use client";

import type { TimelinePoint } from "@/lib/api";

interface Props {
  points: TimelinePoint[];
  days?: number;
  width?: number;
  height?: number;
}

export function Sparkline({
  points,
  days = 30,
  width = 90,
  height = 16,
}: Props) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const map = new Map<string, number>();
  for (const p of points) map.set(p.date, p.count);

  const counts: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    counts.push(map.get(key) ?? 0);
  }

  const max = Math.max(1, ...counts);
  const barW = width / days;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="30-day activity"
      className="block"
    >
      {counts.map((c, i) => {
        if (c === 0) return null;
        const h = Math.max(1, (c / max) * height);
        return (
          <rect
            key={i}
            x={i * barW}
            y={height - h}
            width={Math.max(1, barW - 0.5)}
            height={h}
            className="fill-emerald-500"
          />
        );
      })}
    </svg>
  );
}
