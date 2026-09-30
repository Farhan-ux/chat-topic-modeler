"use client";

import * as React from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import type { TopicTrend } from "@/lib/report-types";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface Props {
  trends: TopicTrend[];
}

export function TopicTrendRiver({ trends }: Props) {
  // Pivot: rows = months, columns = topics
  const data = React.useMemo(() => {
    if (!trends.length) return [];
    const months = trends[0]?.monthly_intensity?.map(m => m.month) ?? [];
    return months.map((month, mIdx) => {
      const row: Record<string, number | string> = { month };
      trends.forEach((t) => {
        const point = t.monthly_intensity?.[mIdx];
        row[t.topic] = point ? point.intensity : 0;
      });
      return row;
    });
  }, [trends]);

  if (data.length === 0) return null;

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          <defs>
            {trends.map((t, i) => (
              <linearGradient key={t.topic} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.85} />
                <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.25} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
          <XAxis
            dataKey="month"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            tickFormatter={(v: string) => v.length > 7 ? v.slice(0, 7) : v}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            unit="%"
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            formatter={(v: string) => v.length > 22 ? v.slice(0, 20) + "…" : v}
          />
          {trends.map((t, i) => (
            <Area
              key={t.topic}
              type="monotone"
              dataKey={t.topic}
              stackId="1"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              fill={`url(#grad-${i})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
