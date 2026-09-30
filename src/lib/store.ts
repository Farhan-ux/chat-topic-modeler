/**
 * Zustand store for the entire topic-modeler state machine.
 * Holds: API config, parsed chat, analysis progress, final report.
 * Nothing is persisted to localStorage — fully in-memory (session only).
 */

"use client";

import { create } from "zustand";
import type { ParseResult } from "./whatsapp-parser";
import type { LLMConfig } from "./llm-client";
import type { TopicReport } from "./report-types";
import type { ProgressUpdate } from "./analyzer";

export type AppScreen = "landing" | "analyzing" | "report" | "error";

interface AnalyzerState {
  screen: AppScreen;
  // API config
  provider: LLMConfig["provider"] | null;
  apiKey: string;
  fastModel: string;
  capableModel: string;
  apiKeyValid: boolean | null;
  validatingKey: boolean;

  // File / parsing
  fileName: string;
  fileSize: number;
  parseResult: ParseResult | null;
  parseError: string | null;
  parsing: boolean;
  consentGiven: boolean;

  // Analysis
  progress: ProgressUpdate | null;
  cooldown: { seconds: number; message: string } | null;
  errorMessage: string | null;
  report: TopicReport | null;
  reportMeta: {
    personA: string;
    personB: string;
    timeframe: string;
    totalMessages: number;
    dateRange: { start: string; end: string };
    generatedAt: string;
    provider: string;
    fastModel: string;
    capableModel: string;
  } | null;

  // Cancellation
  cancelRequested: boolean;

  // Theme
  theme: "dark" | "light";

  // Actions
  setProvider: (p: LLMConfig["provider"]) => void;
  setApiKey: (k: string) => void;
  setFastModel: (m: string) => void;
  setCapableModel: (m: string) => void;
  setApiKeyValid: (v: boolean | null) => void;
  setValidatingKey: (v: boolean) => void;

  setFile: (name: string, size: number) => void;
  setParseResult: (r: ParseResult | null) => void;
  setParseError: (e: string | null) => void;
  setParsing: (v: boolean) => void;
  setConsent: (v: boolean) => void;

  setScreen: (s: AppScreen) => void;
  setProgress: (p: ProgressUpdate | null) => void;
  setCooldown: (c: { seconds: number; message: string } | null) => void;
  setErrorMessage: (e: string | null) => void;
  setReport: (r: TopicReport | null) => void;
  setReportMeta: (m: AnalyzerState["reportMeta"]) => void;

  requestCancel: () => void;
  resetCancel: () => void;

  reset: () => void;
  resetToLanding: () => void;
}

export const useAnalyzerStore = create<AnalyzerState>((set) => ({
  screen: "landing",
  provider: "groq",
  apiKey: "",
  fastModel: "llama-3.1-8b-instant",
  capableModel: "llama-3.3-70b-versatile",
  apiKeyValid: null,
  validatingKey: false,

  fileName: "",
  fileSize: 0,
  parseResult: null,
  parseError: null,
  parsing: false,
  consentGiven: false,

  progress: null,
  cooldown: null,
  errorMessage: null,
  report: null,
  reportMeta: null,

  cancelRequested: false,

  theme: "dark",

  setProvider: (p) => {
    if (p === "groq") {
      set({ provider: p, fastModel: "llama-3.1-8b-instant", capableModel: "llama-3.3-70b-versatile" });
    } else if (p === "google") {
      set({ provider: p, fastModel: "gemini-3.1-flash-lite", capableModel: "gemini-3.1-flash-lite" });
    } else if (p === "openai") {
      set({ provider: p, fastModel: "gpt-4o-mini", capableModel: "gpt-4o" });
    } else {
      set({ provider: p });
    }
    set({ apiKeyValid: null });
  },
  setApiKey: (k) => set({ apiKey: k, apiKeyValid: null }),
  setFastModel: (m) => set({ fastModel: m, apiKeyValid: null }),
  setCapableModel: (m) => set({ capableModel: m, apiKeyValid: null }),
  setApiKeyValid: (v) => set({ apiKeyValid: v }),
  setValidatingKey: (v) => set({ validatingKey: v }),

  setFile: (name, size) => set({ fileName: name, fileSize: size, parseError: null }),
  setParseResult: (r) => set({ parseResult: r }),
  setParseError: (e) => set({ parseError: e }),
  setParsing: (v) => set({ parsing: v }),
  setConsent: (v) => set({ consentGiven: v }),

  setScreen: (s) => set({ screen: s }),
  setProgress: (p) => set({ progress: p }),
  setCooldown: (c) => set({ cooldown: c }),
  setErrorMessage: (e) => set({ errorMessage: e }),
  setReport: (r) => set({ report: r }),
  setReportMeta: (m) => set({ reportMeta: m }),

  requestCancel: () => set({ cancelRequested: true }),
  resetCancel: () => set({ cancelRequested: false }),

  reset: () =>
    set({
      screen: "landing",
      fileName: "",
      fileSize: 0,
      parseResult: null,
      parseError: null,
      parsing: false,
      progress: null,
      cooldown: null,
      errorMessage: null,
      report: null,
      reportMeta: null,
      cancelRequested: false,
    }),

  resetToLanding: () =>
    set({
      screen: "landing",
      progress: null,
      cooldown: null,
      errorMessage: null,
      report: null,
      reportMeta: null,
      cancelRequested: false,
    }),
}));
