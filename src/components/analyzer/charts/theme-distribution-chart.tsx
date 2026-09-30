"use client";

import * as React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import type { ArchetypeTopicScore } from "@/lib/report-types";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface Props {
  themes: ArchetypeTopicScore[];
}

export function ThemeDistributionChart({ themes }: Props) {
  const data = React.useMemo(
    () => [...themes].sort((a, b) => b.share - a.share).map(t => ({
      name: t.theme,
      value: t.share,
    })),
    [themes]
  );

  if (data.length === 0) return null;

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
            stroke="hsl(var(--border))"
            width={130}
            tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + "…" : v}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.3 }}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
              color: "hsl(var(--popover-foreground))",
            }}
            formatter={(v: number) => [`${v}%`, "Share"]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
