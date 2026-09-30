"use client";

import * as React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import type { TopicOwnership } from "@/lib/report-types";

interface Props {
  ownership: TopicOwnership[];
  personA: string;
  personB: string;
  maxTopics?: number;
}

export function PerPersonTopicChart({ ownership, personA, personB, maxTopics = 12 }: Props) {
  const data = React.useMemo(
    () => [...ownership].slice(0, maxTopics).map(o => ({
      topic: o.topic,
      [personA]: o.person_a_share,
      [personB]: o.person_b_share,
    })),
    [ownership, personA, personB, maxTopics]
  );

  if (data.length === 0) return null;

  return (
    <div className="h-[400px] w-full">
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
            dataKey="topic"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
            stroke="hsl(var(--border))"
            width={140}
            tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 18) + "…" : v}
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
            formatter={(v: number, name: string) => [`${v}%`, name]}
          />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
          <Bar dataKey={personA} stackId="a" fill="hsl(var(--chart-1))" radius={[0, 0, 0, 0]} />
          <Bar dataKey={personB} stackId="a" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
