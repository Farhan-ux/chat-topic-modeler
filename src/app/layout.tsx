import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chat Topic Modeler — What do you actually talk about?",
  description:
    "Upload a WhatsApp chat export and discover the topics you talk about most — their frequency, evolution, ownership, depth, and sentiment. Privacy-first, runs in your browser with your own LLM API key.",
  keywords: [
    "chat analyzer",
    "topic modeling",
    "WhatsApp analyzer",
    "chat topics",
    "conversation analysis",
    "LLM",
    "privacy-first",
  ],
  authors: [{ name: "Farhan Ch" }],
  openGraph: {
    title: "Chat Topic Modeler",
    description: "What do you actually talk about? Discover, map, and explore your chat topics.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
