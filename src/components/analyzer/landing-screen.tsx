"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Upload,
  FileText,
  Key,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  Clock,
  Lock,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useAnalyzerStore } from "@/lib/store";
import { LLMClient, PROVIDER_INFO, PROVIDER_MODELS, type Provider } from "@/lib/llm-client";
import { parseWhatsAppChat, getChatStats } from "@/lib/whatsapp-parser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const PROVIDERS: Provider[] = ["groq", "google", "openai"];

export function LandingScreen() {
  const {
    provider, apiKey, fastModel, capableModel,
    apiKeyValid, validatingKey,
    fileName, fileSize, parseResult, parseError, parsing, consentGiven,
    setProvider, setApiKey, setFastModel, setCapableModel,
    setApiKeyValid, setValidatingKey,
    setFile, setParseResult, setParseError, setParsing, setConsent,
    setScreen, setErrorMessage,
  } = useAnalyzerStore();

  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Validate API key whenever provider/key/models change
  const validateKey = React.useCallback(async () => {
    if (!apiKey.trim()) {
      setApiKeyValid(null);
      return;
    }
    setValidatingKey(true);
    try {
      const client = new LLMClient({ provider: provider!, apiKey, fastModel, capableModel });
      const result = await client.validateKey();
      if (result.valid) {
        setApiKeyValid(true);
      } else {
        setApiKeyValid(false);
        if (result.reason === "model_unavailable") {
          setParseError(result.message);
        }
      }
    } catch (err) {
      setApiKeyValid(false);
      setParseError((err as Error).message);
    } finally {
      setValidatingKey(false);
    }
  }, [provider, apiKey, fastModel, capableModel, setApiKeyValid, setValidatingKey, setParseError]);

  // Debounce validation
  React.useEffect(() => {
    if (!apiKey.trim() || !provider) return;
    const t = setTimeout(validateKey, 800);
    return () => clearTimeout(t);
  }, [apiKey, provider, fastModel, capableModel, validateKey]);

  const handleFile = async (file: File) => {
    setFile(file.name, file.size);
    setParsing(true);
    setParseError(null);
    setParseResult(null);
    try {
      const text = await file.text();
      const result = parseWhatsAppChat(text);
      if (result.messages.length === 0) {
        setParseError("No messages could be parsed from this file. Make sure it's a WhatsApp .txt export.");
        setParseResult(null);
      } else if (result.participants.length < 2) {
        setParseError("Could not detect two participants in this chat. The parser needs at least two senders.");
        setParseResult(null);
      } else {
        setParseResult(result);
      }
    } catch (err) {
      setParseError(`Failed to read file: ${(err as Error).message}`);
      setParseResult(null);
    } finally {
      setParsing(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const canAnalyze =
    apiKeyValid === true &&
    parseResult !== null &&
    consentGiven === true &&
    !parsing;

  const handleAnalyze = () => {
    if (!canAnalyze) return;
    setErrorMessage(null);
    setScreen("analyzing");
  };

  const stats = parseResult ? getChatStats(parseResult) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <Badge variant="secondary" className="mb-4 gap-1">
          <Sparkles className="h-3 w-3" /> Topic-focused chat analysis
        </Badge>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
          What do you actually talk about?
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
          Upload a WhatsApp chat export and discover the topics you discuss most — their frequency, evolution over time, who owns what, depth, sentiment, and structure. Privacy-first, runs in your browser.
        </p>
      </motion.div>

      <div className="space-y-6">
        {/* Step 1: Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
              Choose your LLM provider
            </CardTitle>
            <CardDescription>
              Bring your own API key. Free tiers available from Groq and Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {PROVIDERS.map((p) => {
                const info = PROVIDER_INFO[p];
                const selected = provider === p;
                return (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={cn(
                      "text-left p-4 rounded-lg border transition-all",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:border-primary/40 hover:bg-accent/40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{info.name}</span>
                      {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{info.description}</p>
                    <p className="text-[10px] text-muted-foreground/80 leading-tight">{info.rateLimits}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: API key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
              <Key className="h-4 w-4" /> Enter your API key
            </CardTitle>
            <CardDescription>
              Get a free key from{" "}
              <a
                href={PROVIDER_INFO[provider!].signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {PROVIDER_INFO[provider!].signupUrl.replace("https://", "")}
              </a>
              . Your key stays in your browser — never sent to our servers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key here"
                className="pr-10 font-mono text-sm"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validatingKey && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!validatingKey && apiKeyValid === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {!validatingKey && apiKeyValid === false && <XCircle className="h-4 w-4 text-destructive" />}
              </div>
            </div>

            {/* Advanced — model override */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground px-0 hover:bg-transparent hover:text-foreground">
                  Advanced: override models
                  {advancedOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="fast-model" className="text-xs text-muted-foreground">Fast model (Phase 1)</Label>
                    <Input
                      id="fast-model"
                      value={fastModel}
                      onChange={(e) => setFastModel(e.target.value)}
                      list="fast-models"
                      className="mt-1 font-mono text-xs"
                    />
                    <datalist id="fast-models">
                      {PROVIDER_MODELS[provider!].fast.map((m) => <option key={m} value={m} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label htmlFor="capable-model" className="text-xs text-muted-foreground">Capable model (Phase 3)</Label>
                    <Input
                      id="capable-model"
                      value={capableModel}
                      onChange={(e) => setCapableModel(e.target.value)}
                      list="capable-models"
                      className="mt-1 font-mono text-xs"
                    />
                    <datalist id="capable-models">
                      {PROVIDER_MODELS[provider!].capable.map((m) => <option key={m} value={m} />)}
                    </datalist>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {apiKeyValid === false && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>API key check failed</AlertTitle>
                <AlertDescription className="text-xs">
                  {parseError ?? "The key or model wasn't accepted by the provider. Double-check and try again."}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
              <Upload className="h-4 w-4" /> Upload your WhatsApp chat
            </CardTitle>
            <CardDescription>
              Export a chat in WhatsApp (Without Media) → .txt file. Parser handles US, EU, ISO formats.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
                "hover:border-primary/50 hover:bg-accent/30",
                parseResult && "border-green-500/50 bg-green-500/5"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                onChange={onFileChange}
                className="hidden"
              />
              {parsing ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Parsing chat...</span>
                </div>
              ) : parseResult ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <span className="text-sm font-medium">{fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {parseResult.messages.length.toLocaleString()} messages · {parseResult.participants.length} participants · {parseResult.dateRange && `${parseResult.dateRange.start.toLocaleDateString()} → ${parseResult.dateRange.end.toLocaleDateString()}`}
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs mt-1">
                    Choose a different file
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileText className="h-6 w-6" />
                  <span className="text-sm font-medium text-foreground">Drop your .txt file here</span>
                  <span className="text-xs">or click to browse</span>
                </div>
              )}
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{parseError}</AlertDescription>
              </Alert>
            )}

            {parseResult && stats && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {parseResult.participants.map((p) => {
                  const s = stats[p];
                  return (
                    <div key={p} className="rounded-md border border-border/60 bg-muted/30 p-2">
                      <div className="font-medium truncate">{p}</div>
                      <div className="text-muted-foreground text-[10px]">{s.count.toLocaleString()} messages</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Consent */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
              <ShieldCheck className="h-4 w-4" /> Consent & privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="consent"
                checked={consentGiven}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="consent" className="text-xs leading-relaxed cursor-pointer">
                I have permission from all participants to analyze this chat (or it&apos;s my own chat), and I understand the data will be sent directly from my browser to <span className="font-medium">{PROVIDER_INFO[provider!].name}</span> for processing. Nothing is stored on any server.
              </Label>
            </div>

            <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3 pt-2">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                <span>API key in memory only</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                <span>Direct browser → provider</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>No server storage</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <Button
            size="lg"
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="w-full sm:w-auto min-w-[200px]"
          >
            {parsing ? "Parsing..." : "Analyze Topics"}
          </Button>
          {!canAnalyze && !parsing && (
            <p className="text-xs text-muted-foreground">
              {!apiKeyValid && "Validate your API key first"}
              {apiKeyValid && !parseResult && "Upload a chat file to continue"}
              {apiKeyValid && parseResult && !consentGiven && "Please confirm consent to continue"}
            </p>
          )}
        </div>

        {/* Disclaimer footer */}
        <p className="text-[11px] text-muted-foreground/70 text-center pt-4 pb-8">
          For entertainment and self-reflection only. Analysis is generated by an LLM and may contain inaccuracies. Don&apos;t use it to make serious decisions.
        </p>
      </div>
    </div>
  );
}
