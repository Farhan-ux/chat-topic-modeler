"use client";

import { useAnalyzerStore } from "@/lib/store";
import { Header } from "@/components/analyzer/header";
import { LandingScreen } from "@/components/analyzer/landing-screen";
import { ProgressScreen } from "@/components/analyzer/progress-screen";
import { ReportScreen } from "@/components/analyzer/report-screen";
import { ErrorScreen } from "@/components/analyzer/error-screen";

export default function Home() {
  const { screen } = useAnalyzerStore();

  // Report screen has its own header (sticky sidebar layout)
  if (screen === "report") {
    return <ReportScreen />;
  }

  // Other screens share the standard header
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {screen === "landing" && <LandingScreen />}
        {screen === "analyzing" && <ProgressScreen />}
        {screen === "error" && <ErrorScreen />}
      </main>
      <footer className="mt-auto border-t border-border/40 py-4 px-4 text-center text-[11px] text-muted-foreground/70">
        Chat Topic Modeler · Built with Next.js, TypeScript, Tailwind, and Recharts ·{" "}
        <a
          href="https://github.com/Farhan-ux/chat-topic-modeler"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground hover:underline"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
