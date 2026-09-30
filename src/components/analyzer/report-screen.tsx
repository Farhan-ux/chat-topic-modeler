"use client";

import * as React from "react";
import {
  LayoutDashboard, BarChart3, TrendingUp, Users, Network, Layers, Scale, Quote,
  Download, FileJson, RefreshCw, Menu, X, Sparkles, ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAnalyzerStore } from "@/lib/store";
import { TOPIC_REPORT_SECTIONS, type TopicSectionId } from "@/lib/report-types";
import { Header } from "./header";
import { ReportSidebar } from "./report-sidebar";
import { ReportSection } from "./report-section";
import { TopicDistributionChart } from "./charts/topic-distribution-chart";
import { ThemeDistributionChart } from "./charts/theme-distribution-chart";
import { TopicTrendRiver } from "./charts/topic-trend-river";
import { TopicHeatmap } from "./charts/topic-heatmap";
import { CoOccurrenceNetwork } from "./charts/co-occurrence-network";
import { PerPersonTopicChart } from "./charts/per-person-topic-chart";
import { DepthScatterChart } from "./charts/depth-scatter-chart";
import { KeywordCloud } from "./charts/keyword-cloud";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<TopicSectionId, LucideIcon> = {
  executive_topic_summary: LayoutDashboard,
  topic_ranking_and_themes: BarChart3,
  topic_evolution_and_trends: TrendingUp,
  per_person_topic_dynamics: Users,
  topic_co_occurrence_and_drift: Network,
  topic_depth_and_sentiment: Layers,
  topic_balance_and_untapped: Scale,
  quotes_and_keywords: Quote,
};

export function ReportScreen() {
  const { report, reportMeta, resetToLanding } = useAnalyzerStore();
  const [activeSection, setActiveSection] = React.useState<TopicSectionId>("executive_topic_summary");
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const reportRef = React.useRef<HTMLDivElement>(null);

  // Track active section via IntersectionObserver
  React.useEffect(() => {
    if (!report || !reportMeta) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.id as TopicSectionId;
          if (id) setActiveSection(id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: [0, 0.1, 0.5, 1] }
    );
    TOPIC_REPORT_SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [report, reportMeta]);

  if (!report || !reportMeta) return null;

  const handleNavigate = (id: TopicSectionId) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleExportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ report, meta: reportMeta }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `topic-report-${reportMeta.personA}-${reportMeta.personB}.json`.replace(/\s+/g, "_");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        scale: 1.5,
        useCORS: true,
        logging: false,
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`topic-report-${reportMeta.personA}-${reportMeta.personB}.pdf`.replace(/\s+/g, "_"));
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Try the JSON export instead.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Mobile nav bar */}
      <div className="lg:hidden sticky top-14 z-40 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-2">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Menu className="h-4 w-4" />
              Sections
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-left">Report sections</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <ReportSidebar
                activeSection={activeSection}
                onNavigate={handleNavigate}
                onNavigateDone={() => setMobileNavOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto custom-scrollbar pr-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2 px-2">
              Report sections
            </div>
            <ReportSidebar
              activeSection={activeSection}
              onNavigate={handleNavigate}
            />
          </div>
        </aside>

        {/* Main report */}
        <main ref={reportRef} className="flex-1 min-w-0 space-y-6 pb-12">
          {/* Report header */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <Badge variant="secondary" className="mb-2 gap-1">
                      <Sparkles className="h-3 w-3" /> Topic Report
                    </Badge>
                    <h1 className="text-xl sm:text-2xl font-bold">
                      {reportMeta.personA} × {reportMeta.personB}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {reportMeta.timeframe} · {reportMeta.totalMessages.toLocaleString()} messages
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={handleExportPDF} disabled={exporting}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {exporting ? "Exporting..." : "PDF"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportJSON}>
                      <FileJson className="h-3.5 w-3.5 mr-1.5" />
                      JSON
                    </Button>
                    <Button size="sm" variant="ghost" onClick={resetToLanding}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      New
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* SECTION 1: Executive Topic Summary */}
          <ReportSection
            id="executive_topic_summary"
            index={1}
            title="Topic Summary"
            subtitle="The big picture of what this conversation is about"
            icon={<LayoutDashboard className="h-4 w-4 text-primary" />}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Distinct topics" value={String(report.executive_topic_summary.total_distinct_topics)} />
              <StatCard label="Diversity score" value={`${report.executive_topic_summary.topic_diversity_score}/100`} hint="Higher = dominated by few topics" />
              <StatCard label="Top topic" value={report.executive_topic_summary.top_topics[0]?.topic ?? "—"} hint={`${report.executive_topic_summary.top_topics[0]?.percentage ?? 0}% of conversation`} />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Headline</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{report.executive_topic_summary.headline_summary}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="text-xs font-medium mb-1">Surprising finding</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{report.executive_topic_summary.surprising_finding}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="text-xs font-medium mb-1">Essence</div>
                <p className="text-xs text-muted-foreground leading-relaxed italic">&ldquo;{report.executive_topic_summary.essence_sentence}&rdquo;</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Top topics</h4>
              <TopicDistributionChart topics={report.executive_topic_summary.top_topics} />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Theme distribution</h4>
              <ThemeDistributionChart themes={report.executive_topic_summary.theme_distribution} />
            </div>
          </ReportSection>

          {/* SECTION 2: Topic Ranking & Themes */}
          <ReportSection
            id="topic_ranking_and_themes"
            index={2}
            title="Ranking & Themes"
            subtitle="Every topic ranked by share, grouped into super-themes"
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
          >
            <div>
              <h4 className="text-sm font-medium mb-2">Full ranking</h4>
              <div className="rounded-md border border-border/60 overflow-hidden">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">#</th>
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">Topic</th>
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Description</th>
                        <th className="text-right p-2 text-xs font-medium text-muted-foreground">Msgs</th>
                        <th className="text-right p-2 text-xs font-medium text-muted-foreground">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topic_ranking_and_themes.ranking.map((t, i) => (
                        <tr key={t.topic} className="border-t border-border/40 hover:bg-muted/20">
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2 font-medium">{t.topic}</td>
                          <td className="p-2 text-muted-foreground text-xs hidden sm:table-cell">{t.description}</td>
                          <td className="p-2 text-right text-muted-foreground text-xs">{t.estimated_messages.toLocaleString()}</td>
                          <td className="p-2 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-medium">{t.share}%</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Themes</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {report.topic_ranking_and_themes.themes.map((theme) => (
                  <div key={theme.theme} className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{theme.theme}</span>
                      <Badge variant="secondary" className="text-xs">{theme.share}%</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {theme.topics.map(t => (
                        <Badge key={t} variant="outline" className="text-[10px] py-0 px-1.5 h-4">{t}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{theme.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{report.topic_ranking_and_themes.comparison_note}</p>
            </div>
          </ReportSection>

          {/* SECTION 3: Topic Evolution & Trends */}
          <ReportSection
            id="topic_evolution_and_trends"
            index={3}
            title="Evolution & Trends"
            subtitle="How your topic mix has shifted over time"
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
          >
            <div>
              <h4 className="text-sm font-medium mb-2">Topic trend river</h4>
              <p className="text-xs text-muted-foreground mb-3">Stacked area showing each topic&apos;s monthly intensity (relative to its own peak = 100).</p>
              <TopicTrendRiver trends={report.topic_evolution_and_trends.trends} />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Month × Topic heatmap</h4>
              <p className="text-xs text-muted-foreground mb-3">Darker cells = more intense discussion of that topic that month.</p>
              <TopicHeatmap trends={report.topic_evolution_and_trends.trends} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <h4 className="text-sm font-medium mb-2">Emerging & declining</h4>
                <div className="space-y-2">
                  {report.topic_evolution_and_trends.emerging_and_declining.map((e) => (
                    <div key={e.topic + e.status} className="rounded-md border border-border/60 p-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant={e.status === "emerging" ? "default" : "secondary"} className="text-[10px] py-0 h-4 capitalize">{e.status}</Badge>
                        <span className="text-sm font-medium">{e.topic}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{e.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Lifecycles</h4>
                <div className="space-y-2">
                  {report.topic_evolution_and_trends.lifecycles.map((l) => (
                    <div key={l.topic} className="rounded-md border border-border/60 p-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium">{l.topic}</span>
                        <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">{l.current_status}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        First seen {l.first_seen} · Peak {l.peak}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{l.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{report.topic_evolution_and_trends.evolution_narrative}</p>
            </div>
          </ReportSection>

          {/* SECTION 4: Per-Person Topic Dynamics */}
          <ReportSection
            id="per_person_topic_dynamics"
            index={4}
            title="Per-Person Dynamics"
            subtitle="Who owns which topic — and how engaged each person is"
            icon={<Users className="h-4 w-4 text-primary" />}
          >
            <div>
              <h4 className="text-sm font-medium mb-2">Topic ownership</h4>
              <PerPersonTopicChart
                ownership={report.per_person_topic_dynamics.ownership}
                personA={reportMeta.personA}
                personB={reportMeta.personB}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="text-xs font-medium mb-1">{reportMeta.personA}&apos;s signature topics</div>
                <div className="flex flex-wrap gap-1">
                  {report.per_person_topic_dynamics.person_a_signature_topics.map(t => (
                    <Badge key={t} variant="default" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="text-xs font-medium mb-1">{reportMeta.personB}&apos;s signature topics</div>
                <div className="flex flex-wrap gap-1">
                  {report.per_person_topic_dynamics.person_b_signature_topics.map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Engagement by topic</h4>
              <div className="rounded-md border border-border/60 overflow-hidden max-h-80 overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium text-muted-foreground">Topic</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">{reportMeta.personA} avg</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">{reportMeta.personB} avg</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Initiator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.per_person_topic_dynamics.engagement.map((e) => (
                      <tr key={e.topic} className="border-t border-border/40">
                        <td className="p-2 font-medium">{e.topic}</td>
                        <td className="p-2 text-right text-muted-foreground">{e.person_a_avg_length} ch</td>
                        <td className="p-2 text-right text-muted-foreground">{e.person_b_avg_length} ch</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">{e.initiator}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{report.per_person_topic_dynamics.ownership_summary}</p>
            </div>
          </ReportSection>

          {/* SECTION 5: Topic Co-occurrence & Drift */}
          <ReportSection
            id="topic_co_occurrence_and_drift"
            index={5}
            title="Co-occurrence & Drift"
            subtitle="Which topics come up together — and how conversations flow"
            icon={<Network className="h-4 w-4 text-primary" />}
          >
            <div>
              <h4 className="text-sm font-medium mb-2">Co-occurrence network</h4>
              <p className="text-xs text-muted-foreground mb-3">Topics connected by how often they appear together. Larger nodes = more connected.</p>
              <CoOccurrenceNetwork edges={report.topic_co_occurrence_and_drift.co_occurrence_edges} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <h4 className="text-sm font-medium mb-2">Top topic transitions</h4>
                <div className="space-y-1.5">
                  {report.topic_co_occurrence_and_drift.drift_patterns.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-medium truncate flex-1">{d.from_topic}</span>
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate flex-1">{d.to_topic}</span>
                      <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize shrink-0">{d.frequency}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="text-xs font-medium mb-1">Network insight</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{report.topic_co_occurrence_and_drift.network_note}</p>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="text-xs font-medium mb-1">Drift insight</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{report.topic_co_occurrence_and_drift.drift_note}</p>
                </div>
              </div>
            </div>
          </ReportSection>

          {/* SECTION 6: Topic Depth & Sentiment */}
          <ReportSection
            id="topic_depth_and_sentiment"
            index={6}
            title="Depth & Sentiment"
            subtitle="Which topics go deep — and which bring positive vs heavy energy"
            icon={<Layers className="h-4 w-4 text-primary" />}
          >
            <div>
              <h4 className="text-sm font-medium mb-2">Depth vs sentiment map</h4>
              <p className="text-xs text-muted-foreground mb-3">Each bubble is a topic. X = message count, Y = depth, color = sentiment.</p>
              <DepthScatterChart
                depth={report.topic_depth_and_sentiment.depth_spectrum}
                sentiment={report.topic_depth_and_sentiment.sentiment_by_topic}
                ranking={report.topic_ranking_and_themes.ranking}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3">
                <div className="text-xs font-medium mb-1.5">Deep dive topics</div>
                <div className="flex flex-wrap gap-1">
                  {report.topic_depth_and_sentiment.deep_dive_topics.map(t => (
                    <Badge key={t} variant="default" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="text-xs font-medium mb-1.5">Light topics</div>
                <div className="flex flex-wrap gap-1">
                  {report.topic_depth_and_sentiment.light_topics.map(t => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3">
                <div className="text-xs font-medium mb-1.5">Positive topics</div>
                <div className="flex flex-wrap gap-1">
                  {report.topic_depth_and_sentiment.positive_topics.map(t => (
                    <Badge key={t} variant="default" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="text-xs font-medium mb-1.5">Heavy topics</div>
                <div className="flex flex-wrap gap-1">
                  {report.topic_depth_and_sentiment.heavy_topics.map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </ReportSection>

          {/* SECTION 7: Topic Balance & Untapped */}
          <ReportSection
            id="topic_balance_and_untapped"
            index={7}
            title="Balance & Untapped"
            subtitle="Is your topic mix healthy? What might be worth discussing?"
            icon={<Scale className="h-4 w-4 text-primary" />}
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <StatCard label="Balance score" value={`${report.topic_balance_and_untapped.balance_score}/100`} hint="Higher = well-distributed" />
              <StatCard label="Conversation starters" value={`${report.topic_balance_and_untapped.conversation_starters.length} ideas`} />
            </div>

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{report.topic_balance_and_untapped.balance_explanation}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="text-xs font-medium mb-1.5">Over-represented</div>
                <div className="flex flex-wrap gap-1">
                  {report.topic_balance_and_untapped.over_represented.map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="text-xs font-medium mb-1.5">Under-represented</div>
                <div className="flex flex-wrap gap-1">
                  {report.topic_balance_and_untapped.under_represented.map(t => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Untapped topics</h4>
              <div className="space-y-2">
                {report.topic_balance_and_untapped.untapped_topics.map((t) => (
                  <div key={t.topic} className="rounded-md border border-border/60 p-2">
                    <div className="text-sm font-medium mb-0.5">{t.topic}</div>
                    <p className="text-xs text-muted-foreground">{t.rationale}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Conversation starters</h4>
              <ol className="space-y-1.5 list-none">
                {report.topic_balance_and_untapped.conversation_starters.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold mt-0.5">{i + 1}</span>
                    <span className="text-foreground">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </ReportSection>

          {/* SECTION 8: Quotes & Keywords */}
          <ReportSection
            id="quotes_and_keywords"
            index={8}
            title="Quotes & Keywords"
            subtitle="The messages that capture each topic — and the words that define them"
            icon={<Quote className="h-4 w-4 text-primary" />}
          >
            <div>
              <h4 className="text-sm font-medium mb-3">Representative quotes by topic</h4>
              <div className="space-y-2">
                {report.quotes_and_keywords.quotes.map((q, i) => (
                  <div key={i} className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{q.topic}</span>
                      <Badge variant="outline" className="text-[10px] py-0 h-4">{q.said_by === "A" ? reportMeta.personA : reportMeta.personB}</Badge>
                    </div>
                    <blockquote className="text-sm italic border-l-2 border-primary/40 pl-3 my-1">
                      &ldquo;{q.quote}&rdquo;
                    </blockquote>
                    <p className="text-[11px] text-muted-foreground mt-1">{q.context}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Overall keyword cloud</h4>
              <div className="rounded-md border border-border/60 bg-muted/10 p-2">
                <KeywordCloud keywords={report.quotes_and_keywords.overall_top_keywords} />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Keywords by topic</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {report.quotes_and_keywords.keywords_by_topic.map((k) => (
                  <div key={k.topic} className="rounded-md border border-border/60 p-2">
                    <div className="text-xs font-medium mb-1.5">{k.topic}</div>
                    <div className="flex flex-wrap gap-1">
                      {k.keywords.map((kw) => (
                        <Badge key={kw} variant="outline" className="text-[10px] py-0 h-4">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ReportSection>

          {/* Closing thought */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6 text-center">
                <p className="text-sm sm:text-base font-medium italic leading-relaxed">
                  &ldquo;{report.closing_thought}&rdquo;
                </p>
                <div className="mt-4 pt-4 border-t border-border/40 text-[11px] text-muted-foreground">
                  Generated with {reportMeta.provider} · {reportMeta.capableModel} · {new Date(reportMeta.generatedAt).toLocaleString()}
                  <br />
                  For entertainment and self-reflection only. Analysis is generated by an LLM and may contain inaccuracies.
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Floating "back to top" */}
          <div className="flex justify-center pt-4">
            <Button variant="ghost" size="sm" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Back to top
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-bold truncate" title={value}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground/80 mt-0.5">{hint}</div>}
    </div>
  );
}
