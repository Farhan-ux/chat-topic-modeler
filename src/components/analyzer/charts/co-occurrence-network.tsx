"use client";

import * as React from "react";
import type { CoOccurrenceEdge } from "@/lib/report-types";

interface Props {
  edges: CoOccurrenceEdge[];
}

/**
 * Topic co-occurrence network — an SVG graph where nodes are topics
 * and edges are co-occurrence relationships (strength = thickness/opacity).
 *
 * Uses a simple radial layout: highest-degree node in center, others around it.
 */
export function CoOccurrenceNetwork({ edges }: Props) {
  const svgRef = React.useRef<SVGSVGElement>(null);

  const { nodes, links } = React.useMemo(() => {
    if (!edges.length) return { nodes: [], links: [] };

    // Build node degree map
    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + e.strength);
      degree.set(e.target, (degree.get(e.target) ?? 0) + e.strength);
    }

    // Get unique nodes sorted by degree (descending)
    const nodeNames = Array.from(degree.keys()).sort((a, b) => (degree.get(b)! - degree.get(a)!));
    const maxDegree = Math.max(...Array.from(degree.values()));

    // Layout: center node + radial others
    const cx = 250, cy = 200;
    const radius = 130;
    const nodes = nodeNames.map((name, i) => {
      if (i === 0) {
        return { name, x: cx, y: cy, degree: degree.get(name)!, isCenter: true };
      }
      const angle = (i - 1) / Math.max(1, nodeNames.length - 1) * Math.PI * 2;
      return {
        name,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        degree: degree.get(name)!,
        isCenter: false,
      };
    });

    const links = edges.map(e => {
      const source = nodes.find(n => n.name === e.source);
      const target = nodes.find(n => n.name === e.target);
      return { source, target, strength: e.strength };
    }).filter(l => l.source && l.target);

    return { nodes, links };
  }, [edges]);

  if (nodes.length === 0) return null;

  const maxStrength = Math.max(...edges.map(e => e.strength), 1);

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        viewBox="0 0 500 400"
        className="w-full h-[400px]"
        style={{ background: "transparent" }}
      >
        {/* Edges */}
        {links.map((l, i) => {
          const opacity = 0.15 + (l.strength / maxStrength) * 0.5;
          const width = 0.5 + (l.strength / maxStrength) * 4;
          return (
            <line
              key={`edge-${i}`}
              x1={l.source!.x}
              y1={l.source!.y}
              x2={l.target!.x}
              y2={l.target!.y}
              stroke="hsl(var(--primary))"
              strokeOpacity={opacity}
              strokeWidth={width}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const size = 14 + (n.degree / Math.max(1, nodes[0].degree)) * 22;
          return (
            <g key={n.name}>
              <circle
                cx={n.x}
                cy={n.y}
                r={size / 2}
                fill={n.isCenter ? "hsl(var(--primary))" : "hsl(var(--chart-2))"}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
              <text
                x={n.x}
                y={n.y + size / 2 + 14}
                textAnchor="middle"
                fontSize="10"
                fill="hsl(var(--foreground))"
                fontWeight={n.isCenter ? 600 : 400}
              >
                {n.name.length > 16 ? n.name.slice(0, 14) + "…" : n.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
