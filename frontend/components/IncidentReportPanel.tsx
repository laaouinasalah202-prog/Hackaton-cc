"use client";

import { IncidentReport } from "@/lib/types";
import { Sparkles, ShieldCheck, AlertOctagon, Wrench, CheckCircle2 } from "lucide-react";

interface Props {
  incident: IncidentReport | null;
}

export function IncidentReportPanel({ incident }: Props) {
  if (!incident) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-500">
        <Sparkles className="h-6 w-6 text-indigo-400 mx-auto mb-2 animate-pulse" />
        Synthesizing AI root cause investigation with Gemma...
      </div>
    );
  }

  const isCritical = incident.severity === "CRITICAL";

  return (
    <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/70 to-slate-900/90 p-6 shadow-lg shadow-indigo-950/20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-indigo-500/20 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                AI Incident Root Cause Report
              </h3>
              <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                Gemma 3 Intelligence
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Curated root cause diagnosis grounded in template clustering and precedence graph.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider border ${
              isCritical
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            <span>{incident.severity || "HIGH"} Severity</span>
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left Column: Root Cause & Summary */}
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <span>Primary Root Cause</span>
            </h4>
            <div className="mt-1.5 rounded-lg bg-rose-950/30 border border-rose-500/30 p-3.5 text-sm font-medium text-rose-200">
              {incident.root_cause}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Executive Incident Summary
            </h4>
            <p className="mt-1.5 text-sm text-slate-300 leading-relaxed bg-slate-900/60 rounded-lg p-3.5 border border-slate-800">
              {incident.summary}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Affected Blast Radius
            </h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {incident.affected_services.map((svc) => (
                <span
                  key={svc}
                  className="rounded-md bg-indigo-950/60 border border-indigo-500/30 px-2.5 py-1 text-xs font-mono font-medium text-indigo-300"
                >
                  {svc}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Fix */}
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span>Timeline Cascade Sequence</span>
            </h4>
            <div className="mt-1.5 rounded-lg bg-cyan-950/20 border border-cyan-500/20 p-3.5 text-sm text-cyan-200/90 leading-relaxed font-mono text-xs">
              {incident.timeline_summary}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              <span>Recommended Engineering Fix</span>
            </h4>
            <div className="mt-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-3.5 text-sm text-emerald-200 leading-relaxed">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{incident.suggested_fix}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
