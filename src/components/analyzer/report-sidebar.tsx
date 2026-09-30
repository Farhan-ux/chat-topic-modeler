"use client";

import * as React from "react";
import {
  LayoutDashboard, BarChart3, TrendingUp, Users, Network, Layers, Scale, Quote,
  type LucideIcon,
} from "lucide-react";
import { TOPIC_REPORT_SECTIONS, type TopicSectionId } from "@/lib/report-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Users,
  Network,
  Layers,
  Scale,
  Quote,
};

interface Props {
  activeSection: TopicSectionId;
  onNavigate: (id: TopicSectionId) => void;
  /** Mobile sheet open state */
  isMobile?: boolean;
  onNavigateDone?: () => void;
}

export function ReportSidebar({ activeSection, onNavigate, onNavigateDone }: Props) {
  return (
    <nav className="space-y-1">
      {TOPIC_REPORT_SECTIONS.map((section, idx) => {
        const Icon = ICONS[section.icon] ?? LayoutDashboard;
        const isActive = activeSection === section.id;
        return (
          <Button
            key={section.id}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "w-full justify-start gap-2 h-9 text-sm font-normal",
              isActive && "bg-primary/10 text-primary hover:bg-primary/15"
            )}
            onClick={() => {
              onNavigate(section.id);
              onNavigateDone?.();
            }}
          >
            <span className={cn(
              "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
              isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {idx + 1}
            </span>
            <Icon className="h-3.5 w-3.5" />
            <span className="truncate">{section.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
