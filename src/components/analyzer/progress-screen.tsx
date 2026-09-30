"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Clock, Layers, TrendingUp, FileBarChart } from "lucide-react";
import { useAnalyzerStore } from "@/lib/store";
import { LLMClient } from "@/lib/llm-client";
import { runAnalysis, AnalysisCancelledError, type ProgressUpdate } from "@/lib/analyzer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const PHASES = [
  {
    id: 1 as const,
    name: "Topic Extraction",
    icon: Layers,
    description: "Each weekly chunk is analyzed to extract its topics, sentiment, depth, and ownership.",
  },
  {
    id: 2 as const,
    name: "Monthly Aggregation",
    icon: TrendingUp,
    description: "Weekly topic summaries are compressed into monthly digests to keep the final input compact.",
  },
  {
    id: 3 as const,
    name: "Report Synthesis",
    icon: FileBarChart,
    description: "The capable model synthesizes everything into your comprehensive 8-section topic report.",
  },
];

function formatEta(seconds: number): string {
  if (seconds <= 0) return "";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function ProgressScreen() {
  const {
    provider, apiKey, fastModel, capableModel,
    parseResult, progress, cooldown, cancelRequested,
    setProgress, setCooldown, setScreen, setErrorMessage,
    setReport, setReportMeta, requestCancel, resetCancel,
  } = useAnalyzerStore();

  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const client = new LLMClient({ provider: provider!, apiKey, fastModel, capableModel });
    const isCancelled = () => useAnalyzerStore.getState().cancelRequested;

    runAnalysis({
      parseResult: parseResult!,
      client,
      onProgress: (u: ProgressUpdate) => setProgress(u),
      isCancelled,
      onCooldown: (seconds, message) => {
        setCooldown({ seconds, message });
        // Auto-clear cooldown after the wait
        setTimeout(() => setCooldown(null), seconds * 1000);
      },
    })
      .then(({ report }) => {
        const dateRange = parseResult!.dateRange!;
        setReport(report);
        setReportMeta({
          personA: parseResult!.participants[0],
          personB: parseResult!.participants[1],
          timeframe: `${dateRange.start.toLocaleDateString("en-US", { month: "short", year: "numeric" })} to ${dateRange.end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
          totalMessages: parseResult!.messages.length,
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
          },
          generatedAt: new Date().toISOString(),
          provider: provider!,
          fastModel,
          capableModel,
        });
        setScreen("report");
      })
      .catch((err) => {
        if (err instanceof AnalysisCancelledError) {
          setScreen("landing");
          return;
        }
        console.error("Analysis failed:", err);
        setErrorMessage(err.message || "Unknown error");
        setScreen("error");
      })
      .finally(() => {
        resetCancel();
      });
  }, []);

  const handleCancel = () => {
    requestCancel();
  };

  const currentPhase = progress?.phase ?? 1;
  const phaseProgress = progress
    ? Math.min(100, (progress.current / Math.max(1, progress.total)) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Analyzing your topics...</h2>
        <p className="text-sm text-muted-foreground">
          This usually takes 30 seconds to a few minutes depending on chat size and provider.
        </p>
      </div>

      {/* Phase list */}
      <div className="space-y-3 mb-6">
        {PHASES.map((phase) => {
          const isComplete = currentPhase > phase.id;
          const isActive = currentPhase === phase.id;
          const Icon = phase.icon;
          return (
            <Card
              key={phase.id}
              className={cn(
                "transition-all",
                isActive && "border-primary ring-1 ring-primary/30",
                isComplete && "opacity-60"
              )}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  isActive && "bg-primary text-primary-foreground",
                  isComplete && "bg-green-500/15 text-green-500",
                  !isActive && !isComplete && "bg-muted text-muted-foreground"
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Phase {phase.id}: {phase.name}</span>
                    {isActive && progress?.etaSeconds ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatEta(progress.etaSeconds)} left
                      </span>
                    ) : isComplete ? (
                      <span className="text-xs text-green-500">Done</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 space-y-2"
                    >
                      <Progress value={phaseProgress} className="h-1.5" />
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={progress?.message}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="text-xs text-muted-foreground"
                        >
                          {progress?.message ?? "Working..."}
                        </motion.p>
                      </AnimatePresence>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cooldown banner */}
      <AnimatePresence>
        {cooldown && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4"
          >
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-xs">{cooldown.message} ({cooldown.seconds}s)</span>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel */}
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={handleCancel} disabled={cancelRequested}>
          {cancelRequested ? "Cancelling..." : "Cancel"}
        </Button>
      </div>
    </div>
  );
}
