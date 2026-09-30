"use client";

import * as React from "react";

interface Props {
  keywords: string[];
  /** Optional weights (0-1) for each keyword; if absent, derived from position */
  weights?: number[];
}

/**
 * A lightweight keyword cloud — uses CSS to size keywords by weight.
 * Not a true word-cloud layout, but readable and responsive.
 */
export function KeywordCloud({ keywords, weights }: Props) {
  const items = React.useMemo(() => {
    return keywords.map((kw, i) => {
      const w = weights?.[i] ?? 1 - i / Math.max(1, keywords.length);
      return {
        word: kw,
        weight: Math.max(0.3, Math.min(1, w)),
      };
    });
  }, [keywords, weights]);

  // Shuffle for visual variety (deterministic — same each render for a given list)
  const shuffled = React.useMemo(() => {
    if (items.length === 0) return [];
    const arr = [...items];
    let seed = 42;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor(seed / 233280 * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [items]);

  return (
    <div className="flex flex-wrap gap-2 items-baseline justify-center p-4">
      {shuffled.map((item, i) => {
        const fontSize = 0.85 + item.weight * 1.6; // 0.85rem to 2.45rem
        const opacity = 0.55 + item.weight * 0.45;
        return (
          <span
            key={`${item.word}-${i}`}
            className="font-medium leading-tight transition-colors hover:text-primary cursor-default"
            style={{
              fontSize: `${fontSize}rem`,
              opacity,
              color: "hsl(var(--foreground))",
            }}
          >
            {item.word}
          </span>
        );
      })}
    </div>
  );
}
