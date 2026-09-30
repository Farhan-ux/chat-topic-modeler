"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** The numeric index of this section in the report (1-based) */
  index?: number;
}

export function ReportSection({ id, title, subtitle, icon, children, index }: Props) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.35 }}
      className="scroll-mt-20"
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {index !== undefined && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {index}
              </span>
            )}
            {icon}
            <div>
              <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn("space-y-4")}>
          {children}
        </CardContent>
      </Card>
    </motion.section>
  );
}
