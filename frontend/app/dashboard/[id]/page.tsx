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
} from "@/lib/api";
import {
  SessionSummary,
  TimelineBucket,
  Anomaly,
  CausalityGraph,
  IncidentReport,
  LogEntry,
} from "@/lib/types";

import { Navbar } from "@/components/Navbar";
import { SummaryCards } from "@/components/SummaryCards";
import { TimelineChart } from "@/components/TimelineChart";
import { ErrorHeatmap } from "@/components/ErrorHeatmap";
import { ServiceLogsChart } from "@/components/ServiceLogsChart";
import { IncidentReportPanel } from "@/components/IncidentReportPanel";
import { AnomalyList } from "@/components/AnomalyList";
import { ChatBox } from "@/components/ChatBox";
import { LogTable } from "@/components/LogTable";
import { Loader2, AlertCircle, RefreshCw, Layers } from "lucide-react";

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [graph, setGraph] = useState<CausalityGraph | null>(null);
  const [incident, setIncident] = useState<IncidentReport | null>(null);
  const [sessionLogs, setSessionLogs] = useState<LogEntry[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const loadCompletedData = useCallback(async (sid: string) => {
    try {
      const [tl, anoms, grp, inc, logsData] = await Promise.all([
        getTimeline(sid).catch(() => []),
        getAnomalies(sid).catch(() => []),
        getCausalityGraph(sid).catch(() => ({ nodes: [], edges: [] })),
        getIncidentReport(sid).catch(() => null),
        getSessionLogs(sid, undefined, undefined, 2000, 0).catch(() => ({ total: 0, logs: [] })),
      ]);
      setTimeline(tl);
      setAnomalies(anoms);
      setGraph(grp);
      setIncident(inc);
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
            AI Normalization & Diagnostic Pipeline
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
              <span className={progress >= 40 ? "text-emerald-400 font-bold" : ""}>✓</span> Drain3 Templates
            </div>
            <div className="flex items-center gap-1.5">
              <span className={progress >= 70 ? "text-emerald-400 font-bold" : ""}>✓</span> Z-Score Anomalies
            </div>
            <div className="flex items-center gap-1.5">
              <span className={progress >= 90 ? "text-emerald-400 font-bold" : ""}>✓</span> Gemma Root Cause
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
        {/* Top Summary Cards */}
        {summary && <SummaryCards summary={summary} />}

        {/* AI Root Cause Incident Panel */}
        <IncidentReportPanel incident={incident} />

        {/* Middle Row: Service Breakdown & Error Heatmap */}
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

        {/* Stacked Timeline Chart */}
        {summary && (
          <TimelineChart
            timeline={timeline}
            anomalies={anomalies}
            services={summary.services}
            selectedService={selectedService}
            onSelectService={setSelectedService}
          />
        )}

        {/* Bottom Row: Anomaly List & Copilot Chat */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AnomalyList
            anomalies={anomalies}
            selectedService={selectedService}
            onSelectService={setSelectedService}
          />

          <ChatBox sessionId={sessionId} />
        </div>

        {/* Canonical Normalized Log Table */}
        {summary && (
          <LogTable
            sessionId={sessionId}
            selectedService={selectedService}
            services={summary.services}
          />
        )}
      </main>

      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        LogLens MVP — Format-agnostic AI log intelligence platform.
      </footer>
    </div>
  );
}
