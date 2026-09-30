"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TopicTrend } from "@/lib/report-types";

interface Props {
  trends: TopicTrend[];
  maxTopics?: number;
}

/**
 * Month × Topic heatmap.
 * Uses a CSS grid with color-coded cells (intensity → opacity of accent color).
 */
export function TopicHeatmap({ trends, maxTopics = 10 }: Props) {
  const topTrends = React.useMemo(
    () => trends.slice(0, maxTopics),
    [trends, maxTopics]
  );

  // Find global max for normalization
  const maxIntensity = React.useMemo(() => {
    if (topTrends.length === 0) return 100;
    let max = 0;
    for (const t of topTrends) {
      for (const p of t.monthly_intensity ?? []) {
        if (p.intensity > max) max = p.intensity;
      }
    }
    return max || 100;
  }, [topTrends]);

  if (topTrends.length === 0) return null;

  const months = topTrends[0]?.monthly_intensity?.map(m => m.month) ?? [];

  const colorFor = (intensity: number) => {
    const ratio = intensity / maxIntensity;
    // Use primary color with varying opacity
    return `hsl(var(--primary) / ${0.08 + ratio * 0.85})`;
  };

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <div className="min-w-[600px]">
        <div
          className="grid gap-[2px] text-[10px]"
          style={{
            gridTemplateColumns: `140px repeat(${months.length}, minmax(34px, 1fr))`,
          }}
        >
          {/* Header row */}
          <div></div>
          {months.map((m) => (
            <div
              key={m}
              className="text-center text-muted-foreground font-medium py-1 truncate"
              title={m}
            >
              {m.length > 7 ? m.slice(5) + "/" + m.slice(2, 4) : m}
            </div>
          ))}

          {/* Topic rows */}
          {topTrends.map((t) => (
            <React.Fragment key={t.topic}>
              <div
                className="flex items-center text-foreground truncate pr-2"
                title={t.topic}
              >
                <span className="truncate">{t.topic}</span>
              </div>
              {months.map((month, mIdx) => {
                const point = t.monthly_intensity?.[mIdx];
                const intensity = point?.intensity ?? 0;
                return (
                  <TooltipProvider key={month} delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="aspect-square rounded-[3px] cursor-default transition-transform hover:scale-110 hover:ring-1 hover:ring-primary"
                          style={{ backgroundColor: colorFor(intensity) }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <div className="font-medium">{t.topic}</div>
                        <div className="text-muted-foreground">{month}: {intensity}% intensity</div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
          <span>Low</span>
          <div className="h-2 w-24 rounded-full bg-gradient-to-r" style={{
            background: `linear-gradient(to right, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.93))`,
          }} />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
