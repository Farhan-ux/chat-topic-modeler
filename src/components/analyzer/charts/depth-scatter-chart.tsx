"use client";

import * as React from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import type { TopicDepthEntry, TopicSentimentEntry, RankedTopic } from "@/lib/report-types";

interface Props {
  depth: TopicDepthEntry[];
  sentiment: TopicSentimentEntry[];
  ranking: RankedTopic[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "hsl(145 70% 50%)",
  negative: "hsl(0 75% 55%)",
  neutral: "hsl(220 15% 55%)",
  mixed: "hsl(45 85% 55%)",
};

const DEPTH_Y: Record<string, number> = {
  surface: 1,
  moderate: 2,
  deep: 3,
};

export function DepthScatterChart({ depth, sentiment, ranking }: Props) {
  // Build a merged dataset: one point per topic
  const data = React.useMemo(() => {
    const sentimentMap = new Map(sentiment.map(s => [s.topic, s.sentiment]));
    const msgCountMap = new Map(ranking.map(r => [r.topic, r.estimated_messages]));
    return depth.map(d => ({
      topic: d.topic,
      messages: msgCountMap.get(d.topic) ?? 0,
      depth: d.depth,
      depthY: DEPTH_Y[d.depth] ?? 2,
      sentiment: sentimentMap.get(d.topic) ?? "neutral",
    }));
  }, [depth, sentiment, ranking]);

  if (data.length === 0) return null;

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{ top: 16, right: 16, bottom: 16, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
          <XAxis
            type="number"
            dataKey="messages"
            name="Messages"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            label={{ value: "Message count", position: "insideBottom", offset: -8, style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } }}
          />
          <YAxis
            type="number"
            dataKey="depthY"
            name="Depth"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            domain={[0.5, 3.5]}
            ticks={[1, 2, 3]}
            tickFormatter={(v: number) => v === 1 ? "Surface" : v === 2 ? "Moderate" : v === 3 ? "Deep" : ""}
            label={{ value: "Depth", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } }}
          />
          <ZAxis type="number" range={[120, 120]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "hsl(var(--border))" }}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
              color: "hsl(var(--popover-foreground))",
            }}
            formatter={(_v: number, name: string) => {
              if (name === "Depth") return ["", ""];
              return [String(_v), name];
            }}
            labelFormatter={(_label, payload) => {
              const p = payload?.[0]?.payload as { topic?: string; sentiment?: string; depth?: string; messages?: number } | undefined;
              if (!p) return "";
              return (
                <div>
                  <div className="font-medium">{p.topic}</div>
                  <div className="text-muted-foreground">{p.depth} · {p.sentiment} · {p.messages} msgs</div>
                </div>
              ) as unknown as string;
            }}
          />
          <Scatter name="Topics" data={data}>
            {data.map((d, i) => (
              <Cell key={i} fill={SENTIMENT_COLORS[d.sentiment] ?? SENTIMENT_COLORS.neutral} fillOpacity={0.75} />
            ))}
          </Scatter>
          {/* Custom legend for sentiment colors */}
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            formatter={() => ""}
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Manual legend for sentiment */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2 text-[11px] text-muted-foreground">
        {Object.entries(SENTIMENT_COLORS).map(([k, color]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            <span className="capitalize">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
