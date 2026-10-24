"use client";

import { SessionSummary } from "@/lib/types";
import { Files, Server, AlertTriangle, Flame, Clock, AlertOctagon } from "lucide-react";

interface Props {
  summary: SessionSummary;
}

export function SummaryCards({ summary }: Props) {
  const errorPercentage = (summary.error_rate * 100).toFixed(1);
  const isHighError = summary.error_rate > 0.15;
  const unparsed = summary.unparsed_timestamps || 0;

  return (
    <div className="space-y-3">
      {/* Warning banner if any unparsed timestamps */}
      {unparsed > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-950/70 border border-amber-800/80 px-4 py-2.5 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span>
            <strong>Timestamp Quality Warning:</strong> {unparsed} log line{unparsed > 1 ? "s" : ""} could not be parsed into a valid UTC timestamp and were set to null (not assigned to now()).
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Logs */}
        <div
          title="Total count of raw log lines successfully ingested and normalized into unified schema"
          className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm hover:border-slate-700/80 transition-all cursor-help"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Logs Ingested</span>
            <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
              <Files className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
              {summary.total_logs.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">lines</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Clock className="h-3 w-3 text-slate-500" />
            <span>Normalized canonical representation</span>
          </div>
        </div>

        {/* Services */}
        <div
          title="Distinct software components or file sources contributing logs to this session"
          className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm hover:border-slate-700/80 transition-all cursor-help"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Services Active</span>
            <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
              {summary.services.length}
            </span>
            <span className="text-xs text-slate-400">services</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {summary.services.slice(0, 3).map((svc) => (
              <span
                key={svc}
                className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 border border-slate-700/60"
              >
                {svc}
              </span>
            ))}
            {summary.services.length > 3 && (
              <span className="text-[10px] text-slate-500">+{summary.services.length - 3} more</span>
            )}
          </div>
        </div>

        {/* Error Rate */}
        <div
          title="Percentage of all ingested logs with ERROR or CRITICAL severity level"
          className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm hover:border-slate-700/80 transition-all cursor-help"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">System Error Rate</span>
            <div className={`rounded-lg p-2 ${isHighError ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold tracking-tight font-mono ${isHighError ? "text-rose-400" : "text-emerald-400"}`}>
              {errorPercentage}%
            </span>
            <span className="text-xs text-slate-400">
              {summary.level_counts["ERROR"] || 0} err / {summary.level_counts["CRITICAL"] || 0} crit
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${isHighError ? "bg-rose-400 animate-ping" : "bg-emerald-400"}`} />
            <span>{isHighError ? "System-wide cascading failure" : "Nominal operational state"}</span>
          </div>
        </div>

        {/* Anomalies Flagged */}
        <div
          title="Number of statistically significant error spikes and newly observed failure patterns flagged by statistical models"
          className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm hover:border-slate-700/80 transition-all cursor-help"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Anomalies Detected</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-amber-400 font-mono">
              {summary.anomaly_count}
            </span>
            <span className="text-xs text-slate-400">patterns</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span>Statistical spikes & new signatures</span>
          </div>
        </div>
      </div>
    </div>
  );
}
