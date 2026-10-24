"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getSessionSummary,
  getTimeline,
  getAnomalies,
  getCausalityGraph,
  getIncidentReport,
  getSessionLogs,
  getIncidentAnalysis,
  updateSessionDependencies,
} from "@/lib/api";
import {
  SessionSummary,
  TimelineBucket,
  Anomaly,
  CausalityGraph,
  IncidentReport,
  LogEntry,
  IncidentAnalysis,
  DependencyEdge,
  EvidenceItem,
} from "@/lib/types";

import { Navbar } from "@/components/Navbar";
import { SummaryCards } from "@/components/SummaryCards";
import { IncidentStoryCard } from "@/components/IncidentStoryCard";
import { ServiceFlow } from "@/components/ServiceFlow";
import { SwimlaneTimeline } from "@/components/SwimlaneTimeline";
import { ServiceLogsChart } from "@/components/ServiceLogsChart";
import { ErrorHeatmap } from "@/components/ErrorHeatmap";
import { TimelineChart } from "@/components/TimelineChart";
import { AnomalyList } from "@/components/AnomalyList";
import { ChatBox } from "@/components/ChatBox";
import { LogTable } from "@/components/LogTable";
import { LogNetworkGraph } from "@/components/LogNetworkGraph";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";

import {
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Network,
  Terminal,
} from "lucide-react";

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [analysis, setAnalysis] = useState<IncidentAnalysis | null>(null);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [graph, setGraph] = useState<CausalityGraph | null>(null);
  const [sessionLogs, setSessionLogs] = useState<LogEntry[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  // Evidence Drawer state
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState(false);
  const [selectedEvidenceItem, setSelectedEvidenceItem] = useState<EvidenceItem | null>(null);
  const [highlightedEvidenceId, setHighlightedEvidenceId] = useState<number | null>(null);

  // Collapsed state for Advanced Log Pattern Graph
  const [isPatternGraphOpen, setIsPatternGraphOpen] = useState(false);

  const loadCompletedData = useCallback(async (sid: string) => {
    try {
      const [anlz, tl, anoms, grp, logsData] = await Promise.all([
        getIncidentAnalysis(sid).catch(() => null),
        getTimeline(sid).catch(() => []),
        getAnomalies(sid).catch(() => []),
        getCausalityGraph(sid).catch(() => ({ nodes: [], edges: [] })),
        getSessionLogs(sid, undefined, undefined, 2000, 0).catch(() => ({ total: 0, logs: [] })),
      ]);
      setAnalysis(anlz);
      setTimeline(tl);
      setAnomalies(anoms);
      setGraph(grp);
      setSessionLogs(logsData.logs || []);
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed loading session data.");
      setIsLoading(false);
    }
  }, []);

  // Polling loop
  useEffect(() => {
    if (!sessionId) return;

    let isMounted = true;
    let timer: NodeJS.Timeout;

    const poll = async () => {
      try {
        const sum = await getSessionSummary(sessionId);
        if (!isMounted) return;
        setSummary(sum);

        if (sum.status === "completed") {
          await loadCompletedData(sessionId);
        } else if (sum.status === "failed") {
          setError(sum.message || "Analysis failed.");
          setIsLoading(false);
        } else {
          // Still processing, poll again in 1.5s
          timer = setTimeout(poll, 1500);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || "Session not found.");
        setIsLoading(false);
      }
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [sessionId, loadCompletedData]);

  // Handle opening evidence item in drawer
  const handleOpenEvidence = (evidenceId: number) => {
    if (!analysis) return;
    const found = analysis.evidence.find((e) => e.id === evidenceId);
    if (found) {
      setSelectedEvidenceItem(found);
      setIsEvidenceDrawerOpen(true);
    }
  };

  // Jump from evidence drawer to table
  const handleJumpToTable = (evidenceId: number, service: string) => {
    setHighlightedEvidenceId(evidenceId);
    setSelectedService(service);
    const tableEl = document.getElementById("logs-table-section");
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Handle dependency topology updates
  const handleUpdateDependencies = async (dependencies: DependencyEdge[]) => {
    try {
      const updated = await updateSessionDependencies(sessionId, dependencies);
      setAnalysis(updated);
    } catch (err) {
      console.error("Failed to update dependencies:", err);
    }
  };

  // Loading / Processing Progress Screen
  if (isLoading && (!summary || summary.status === "processing")) {
    const progress = summary?.progress || 10;
    return (
      <div className="min-h-screen flex flex-col bg-[#080c14]">
        <Navbar sessionId={sessionId} />
        <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-xl mx-auto w-full text-center">
          <div className="relative mb-6">
            <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">
            Deterministic Analysis & Diagnostics Pipeline
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {summary?.message || "Ingesting and parsing multi-format log files..."}
          </p>

          {/* Progress Bar */}
          <div className="mt-6 w-full space-y-2">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>{summary?.message ? summary.message.split("...")[0] : "Processing"}</span>
              <span className="text-indigo-400 font-bold">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2 text-left w-full text-[11px] text-slate-500 font-mono">
            <div className="flex items-center gap-1.5">
              <span className={progress >= 20 ? "text-emerald-400 font-bold" : ""}>✓</span> Format Discovery
            </div>
            <div className="flex items-center gap-1.5">
              <span className={progress >= 40 ? "text-emerald-400 font-bold" : ""}>✓</span> Template Patterns
            </div>
            <div className="flex items-center gap-1.5">
              <span className={progress >= 70 ? "text-emerald-400 font-bold" : ""}>✓</span> Statistical Anomalies
            </div>
            <div className="flex items-center gap-1.5">
              <span className={progress >= 90 ? "text-emerald-400 font-bold" : ""}>✓</span> Root Cause Discovery
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error State Screen
  if (error || (summary && summary.status === "failed")) {
    return (
      <div className="min-h-screen flex flex-col bg-[#080c14]">
        <Navbar sessionId={sessionId} />
        <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full text-center">
          <div className="rounded-full bg-rose-500/10 p-4 text-rose-400 border border-rose-500/20 mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Log Analysis Failed</h2>
          <p className="mt-2 text-xs text-rose-300 bg-rose-950/30 p-3 rounded-lg border border-rose-500/30 font-mono">
            {error || summary?.message || "An unknown error occurred while processing log files."}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => router.push("/")}
              className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              Back to Upload
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14]">
      <Navbar sessionId={sessionId} />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        {/* 1. Top Summary Cards (with Tooltips & Quality Warnings) */}
        {summary && <SummaryCards summary={summary} />}

        {/* 2. INCIDENT STORY CARD (Deterministic Facts + Clickable [E#] Citations) */}
        <IncidentStoryCard
          analysis={analysis}
          onOpenEvidence={handleOpenEvidence}
        />

        {/* 3. SERVICE FLOW DIAGRAM WITH TIME SLIDER & TOPOLOGY EDITOR */}
        {analysis && (
          <ServiceFlow
            analysis={analysis}
            onOpenEvidence={handleOpenEvidence}
            onUpdateDependencies={handleUpdateDependencies}
          />
        )}

        {/* 4. INCIDENT SWIMLANE TIMELINE (Who Broke First Visual) */}
        {analysis && (
          <SwimlaneTimeline
            analysis={analysis}
            onOpenEvidence={handleOpenEvidence}
          />
        )}

        {/* 5. Middle Row: Service Logs Breakdown & Error Density Heatmap */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ServiceLogsChart
            logs={sessionLogs}
            selectedService={selectedService}
            onSelectService={setSelectedService}
            graph={graph}
          />

          {summary && (
            <ErrorHeatmap
              timeline={timeline}
              services={summary.services}
              selectedService={selectedService}
              onSelectService={setSelectedService}
            />
          )}
        </div>

        {/* 6. Stacked Timeline Volume Chart */}
        {summary && (
          <TimelineChart
            timeline={timeline}
            anomalies={anomalies}
            services={summary.services}
            selectedService={selectedService}
            onSelectService={setSelectedService}
          />
        )}

        {/* 7. Bottom Row: Grouped Anomaly List & Copilot Chat */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AnomalyList
            anomalies={anomalies}
            selectedService={selectedService}
            onSelectService={setSelectedService}
            onOpenEvidence={handleOpenEvidence}
          />

          <ChatBox sessionId={sessionId} />
        </div>

        {/* 8. Collapsible Section: Advanced Log Pattern Graph (Old Hairball, Collapsed by Default) */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
          <button
            onClick={() => setIsPatternGraphOpen((prev) => !prev)}
            className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-rose-400" />
              <span>Advanced: Log Pattern Graph (Fine-Grained Transitions)</span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                Optional Deep Dive
              </span>
            </div>
            {isPatternGraphOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {isPatternGraphOpen && graph && (
            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <LogNetworkGraph
                graph={graph}
                selectedService={selectedService}
                onSelectService={setSelectedService}
              />
            </div>
          )}
        </div>

        {/* 9. Canonical Normalized Log Table (with Evidence Highlight) */}
        {summary && (
          <LogTable
            sessionId={sessionId}
            selectedService={selectedService}
            services={summary.services}
            highlightedEvidenceId={highlightedEvidenceId}
            onClearHighlight={() => setHighlightedEvidenceId(null)}
          />
        )}
      </main>

      {/* Persistent Evidence Drawer */}
      <EvidenceDrawer
        isOpen={isEvidenceDrawerOpen}
        onClose={() => setIsEvidenceDrawerOpen(false)}
        evidenceItem={selectedEvidenceItem}
        onJumpToTable={handleJumpToTable}
      />

      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        LogLens — Evidence-Backed AI Incident Intelligence Platform.
      </footer>
    </div>
  );
}
