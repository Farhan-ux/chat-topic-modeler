<div align="center">

# 🧠 Chat Topic Modeler

### Turn WhatsApp chats into topic-focused analysis reports — powered by your own LLM API key

[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript_5-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-38BDF8?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**What do you actually talk about?**

*Privacy-first · No data stored · Works with Groq, Google AI Studio & OpenAI*

</div>

---

## 🎯 What is this?

**Chat Topic Modeler** takes a plain `.txt` export of any WhatsApp conversation and produces a **comprehensive 8-section topic analysis report** — what topics you discuss most, how they evolved over time, who owns which topic, topic depth, sentiment, co-occurrence networks, and what you might want to talk about next.

It's the topic-focused sibling of [chat-dynamics-analyzer](https://github.com/Farhan-ux/chat-dynamics-analyzer), which answers *who you are to each other* (personality, relationship dynamics). This one answers *what you talk about*.

> ⚠️ **For entertainment and self-reflection only.** This is not a clinical or academic topic-modeling tool. Don't use it to make serious decisions.

---

## ✨ Features

### 🔬 Three-Phase Topic Extraction Pipeline

| Phase | What happens | Why it matters |
|-------|-------------|----------------|
| **1. Topic Extraction** | Chat is split into weekly chunks, batched 5-at-a-time into a fast LLM. Each chunk yields a list of topics with per-topic stats | Cuts API requests 5× — handles 100k+ message chats within free-tier limits |
| **2. Monthly Aggregation** | Weekly topic summaries are merged into monthly digests | Keeps final report input compact for any model |
| **3. Report Synthesis** | Capable model synthesizes everything into an 8-section JSON report | Produces rich, specific, evidence-backed topic analysis |

### 📊 The 8-Section Topic Report

1. **Topic Summary** — Total distinct topics, diversity score, top topics, theme distribution, headline summary
2. **Ranking & Themes** — Full ranked list (15-25 topics), grouped into 5-8 super-themes
3. **Evolution & Trends** — Topic trend river (stacked area), month×topic heatmap, emerging/declining topics, lifecycles
4. **Per-Person Dynamics** — Topic ownership chart, signature topics per person, engagement metrics
5. **Co-occurrence & Drift** — Network graph of topic pairs, common topic→topic transitions
6. **Depth & Sentiment** — Scatter plot (depth vs sentiment vs message count), deep dive topics, light topics, positive vs heavy topics
7. **Balance & Untapped** — Balance score, over/under-represented topics, untapped topic suggestions, conversation starters
8. **Quotes & Keywords** — Representative quotes per topic, keyword cloud, keywords by topic

### 🎨 Visualizations

- **Horizontal bar charts** — topic distribution, theme distribution, per-person topic ownership
- **Stacked area chart** — topic trend river showing each topic's intensity over months
- **Heatmap** — month × topic intensity grid (CSS-based, hover tooltips)
- **Network graph** — SVG co-occurrence network with weighted nodes and edges
- **Scatter plot** — topic depth vs sentiment vs message count, colored by sentiment
- **Keyword cloud** — weighted keyword sizing for visual scanning

### 🎨 Beautiful UI

- **Dark mode default** with light mode toggle
- **Sticky sidebar** table of contents (hamburger menu on mobile)
- **Active section tracking** — sidebar highlights the section you're reading
- **Collapsible cards** with smooth Framer Motion transitions
- **PDF export** (preserves dark theme via html2canvas + jsPDF)
- **JSON export** of the raw report data
- **Fully responsive** — works on phone, tablet, desktop

### 🔒 Privacy-First Architecture

- ✅ API key stays in **browser memory only** (Zustand store, never persisted)
- ✅ Chat data goes **directly from browser → LLM provider** (no server proxy)
- ✅ **Nothing is stored on our servers** — no database, no logs, no analytics
- ✅ Pre-upload **consent checkbox** required

---

## 🚀 Quick Start

### Run Locally

```bash
# Clone the repo
git clone https://github.com/Farhan-ux/chat-topic-modeler.git
cd chat-topic-modeler

# Install dependencies
bun install  # or npm install

# Start the dev server
bun run dev  # or npm run dev

# Open http://localhost:3000
```

### Get an API Key

You need **your own** API key from one of these providers. All have free tiers.

| Provider | Free Tier | Get Key | Recommended For |
|----------|-----------|---------|-----------------|
| **Groq** | 30 RPM, 14,400 RPD (fast), 1,000 RPD (capable) | [console.groq.com](https://console.groq.com) | ⚡ Fastest processing |
| **Google AI Studio** | 15 RPM, 250K TPM, 500 RPD (Gemini 3.1 Flash Lite) | [aistudio.google.com](https://aistudio.google.com) | 🆓 Most generous free tier for large chats |
| **OpenAI** | Paid only (~$0.20 for 100k messages) | [platform.openai.com](https://platform.openai.com) | 🧠 Most capable models |

### Export Your WhatsApp Chat

1. Open the chat in WhatsApp
2. Tap the contact name → **Export Chat**
3. Choose **"Without Media"** (media files aren't analyzed)
4. Save as `.txt` and upload to the app

The parser handles US (`1/13/24, 10:30 AM - Sender: Message`), EU (`13/1/24, 10:30 - Sender: Message`), ISO (`2024-01-13 10:30 - Sender: Message`), and bracketed formats, plus multi-line messages, system messages, and iOS Unicode NBSP.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client-Side)                     │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ Landing Page │ → │ Progress UI  │ → │ Report View  │    │
│  │ (API key +   │   │ (3-phase     │   │ (8 sections  │    │
│  │  file upload)│   │  tracker)    │   │  + charts)   │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│         │                   ↑                   ↑            │
│         ↓                   │                   │            │
│  ┌──────────────────────────────────────────────────┐       │
│  │           Zustand Store (in-memory only)         │       │
│  │  API key · Chat data · Progress · Final report   │       │
│  └──────────────────────────────────────────────────┘       │
│         │                                                   │
└─────────┼───────────────────────────────────────────────────┘
          │ Direct fetch() calls (no server proxy)
          ↓
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │    Groq API  │  │  Google AI   │  │   OpenAI     │
   │              │  │  Studio API  │  │    API       │
   └──────────────┘  └──────────────┘  └──────────────┘
```

### Core Libraries

| File | Purpose |
|------|---------|
| `src/lib/whatsapp-parser.ts` | Robust multi-format WhatsApp export parser |
| `src/lib/chunking.ts` | Weekly chunking + multi-chunk batching (5× request reduction) |
| `src/lib/llm-client.ts` | Provider-agnostic client with rate limiting, auto-fallback, JSON repair |
| `src/lib/rate-limiter.ts` | Per-provider RPM/RPD tracking with cooldown timers |
| `src/lib/prompts.ts` | Three structured prompts (chunk topic extraction, monthly aggregation, final 8-section report) |
| `src/lib/analyzer.ts` | Three-phase orchestrator with continuation support |
| `src/lib/report-types.ts` | Full TypeScript types for the 8-section topic report |
| `src/lib/store.ts` | Zustand state machine (no persistence) |

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) (New York style) + [Radix UI](https://www.radix-ui.com/) |
| **Charts** | [Recharts](https://recharts.org/) + custom SVG/CSS for network graph and heatmap |
| **State Management** | [Zustand](https://zustand.docs.pmnd.rs/) |
| **Theming** | [next-themes](https://github.com/pacocoursey/next-themes) |
| **Icons** | [lucide-react](https://lucide.dev/) |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) |
| **PDF Export** | [html2canvas](https://html2canvas.hertzen.com/) + [jsPDF](https://parall.ax/products/jspdf) |
| **Package Manager** | [Bun](https://bun.sh/) |

---

## 🧠 How the Analysis Works

### Phase 1: Weekly Topic Extraction
Your chat is split into ~7-day chunks (max 400 messages each). Multiple chunks are **batched into a single API call** (up to 6 chunks or 40K chars per batch). For each chunk, the model returns a JSON array of topics with:

- Topic name, share (% of the week), estimated message count
- Per-person share (who talked more about it)
- Initiator (who brings it up), sentiment, depth
- Keywords, representative quote

### Phase 2: Monthly Aggregation
If you have 6+ weekly chunks, the weekly topic summaries are compressed into monthly digests — merging the same topic across weeks into single monthly entries.

### Phase 3: Comprehensive Topic Report
The capable model receives all aggregated summaries + a structured prompt requesting strict JSON output matching the 8-section schema. If the response is truncated, the app automatically sends **continuation requests** and concatenates the parts before parsing.

### Robustness Features
- 🔄 **Auto model fallback** — if your account lacks access to a model, it tries alternatives
- 🩹 **JSON repair** — truncated JSON is auto-repaired (closes open brackets, trims incomplete keys)
- 🔁 **Continuation mechanism** — large reports that exceed token limits get multi-part generation
- ⏱️ **Rate limiting** — respects RPM/RPD limits with cooldown timers
- 🚦 **Smart error classification** — distinguishes invalid key / rate limit / context overflow / model unavailable

---

## ⚙️ Configuration

### Default Models per Provider

| Provider | Fast Model (Phase 1) | Capable Model (Phase 3) |
|----------|---------------------|------------------------|
| **Groq** | `llama-3.1-8b-instant` | `llama-3.3-70b-versatile` |
| **Google** | `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` |
| **OpenAI** | `gpt-4o-mini` | `gpt-4o` |

Override any model in the **Advanced** section of the landing page.

---

## 📊 Handling Large Chats

The app is designed to handle chats from 100 messages to 150,000+ messages:

| Chat size | Est. chunks | Est. API calls | Time (Groq) |
|-----------|-------------|----------------|-------------|
| 1,400 msgs | 11 | ~6 | ~30 sec |
| 15,000 msgs | ~80 | ~20 | ~2 min |
| 50,000 msgs | ~250 | ~55 | ~5 min |
| 112,000 msgs | ~870 | ~188 | ~13 min |

---

## 🤝 Related Project

This project is the topic-focused sibling of:

- **[chat-dynamics-analyzer](https://github.com/Farhan-ux/chat-dynamics-analyzer)** — Analyzes WHO you are to each other (personality, relationship dynamics, MBTI, humor, love & romance). 13-section psychological report.

Use them together for the full picture: chat-dynamics-analyzer tells you who you are, chat-topic-modeler tells you what you talk about.

---

## 📝 License

MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with 💜 by [Farhan Ch](https://github.com/Farhan-ux)**

**⭐ Star this repo if it helped you!**

</div>
