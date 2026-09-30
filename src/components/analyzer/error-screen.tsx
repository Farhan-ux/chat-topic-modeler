"use client";

import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { useAnalyzerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ErrorScreen() {
  const { errorMessage, resetToLanding } = useAnalyzerStore();

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Analysis failed</h2>
              <p className="text-sm text-muted-foreground">
                Something went wrong during the analysis. The details below may help you fix it.
              </p>
            </div>

            {errorMessage && (
              <Alert variant="destructive" className="text-left">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error details</AlertTitle>
                <AlertDescription className="text-xs font-mono whitespace-pre-wrap break-words">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-muted-foreground space-y-1 text-left bg-muted/30 rounded-md p-3 w-full">
              <p className="font-medium text-foreground">Common fixes:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Switch to a different provider (Groq is most reliable for JSON)</li>
                <li>Try a smaller chat export</li>
                <li>Use Advanced settings to override the model name</li>
                <li>Retry — sometimes models produce malformed output randomly</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button onClick={resetToLanding} variant="default">
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Try again
              </Button>
              <Button onClick={resetToLanding} variant="ghost">
                <Home className="h-4 w-4 mr-1.5" />
                Back to home
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
