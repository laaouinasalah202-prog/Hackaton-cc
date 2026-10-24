"use client";

import { SessionSummary } from "@/lib/types";
import { Files, Server, AlertTriangle, Flame, Clock, Cpu } from "lucide-react";

interface Props {
  summary: SessionSummary;
}

export function SummaryCards({ summary }: Props) {
  const errorPercentage = (summary.error_rate * 100).toFixed(1);
  const isHighError = summary.error_rate > 0.15;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Logs */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Logs Cleaned</span>
          <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
            <Files className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
            {summary.total_logs.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400">normalized</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
          <Clock className="h-3 w-3 text-slate-500" />
          <span>Unified schema & ISO UTC timestamps</span>
        </div>
      </div>

      {/* Services */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Services Monitored</span>
          <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
            <Server className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
            {summary.services.length}
          </span>
          <span className="text-xs text-slate-400">sources</span>
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
      <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm hover:border-slate-700/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Error Rate</span>
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
          <span>{isHighError ? "Elevated error cluster detected" : "Nominal operational state"}</span>
        </div>
      </div>

      {/* Anomalies Flagged */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm hover:border-slate-700/80 transition-all">
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
          <span className="text-xs text-slate-400">spikes & rare templates</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-300/80">
          <Cpu className="h-3 w-3" />
          <span>Drain3 + Z-Score + Error Jumps</span>
        </div>
      </div>
    </div>
  );
}
