"use client";

import React, { useMemo } from "react";
import { IncidentAnalysis } from "@/lib/types";
import { Clock, Layers, ArrowRight, AlertTriangle, AlertOctagon, CheckCircle2 } from "lucide-react";

interface Props {
  analysis: IncidentAnalysis;
  onOpenEvidence: (evidenceId: number) => void;
}

export function SwimlaneTimeline({ analysis, onOpenEvidence }: Props) {
  const timeline = analysis.health_timeline || [];
  const phases = analysis.phases || [];

  // Services sorted so root cause is at the top
  const services = useMemo(() => {
    const list = [...(analysis.propagation_path || [])];
    Object.keys(analysis.service_onsets || {}).forEach((s) => {
      if (!list.includes(s)) list.push(s);
    });
    return list;
  }, [analysis]);

  if (!timeline.length || !services.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-500 text-xs">
        No health timeline buckets available for swimlane display.
      </div>
    );
  }

  // Find onset bucket index for each service
  const serviceOnsetBucketIdx: Record<string, number> = {};
  services.forEach((s) => {
    const onsetTs = analysis.service_onsets[s]?.onset_ts;
    if (onsetTs) {
      const idx = timeline.findIndex((b) => b.start <= onsetTs && onsetTs <= b.end);
      if (idx !== -1) {
        serviceOnsetBucketIdx[s] = idx;
      } else {
        // Fallback: match by first bucket with errors
        const errIdx = timeline.findIndex((b) => (b.services[s]?.error_count || 0) > 0);
        if (errIdx !== -1) serviceOnsetBucketIdx[s] = errIdx;
      }
    }
  });

  // Calculate cell color based on error rate
  const getCellColor = (errorRate: number, reqCount: number) => {
    if (reqCount === 0) return "bg-slate-900/40";
    if (errorRate === 0) return "bg-emerald-950/40 hover:bg-emerald-900/60";
    if (errorRate < 0.2) return "bg-amber-950/60 hover:bg-amber-900/80";
    if (errorRate < 0.6) return "bg-rose-950/80 hover:bg-rose-900";
    return "bg-rose-600/90 hover:bg-rose-500";
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-400" />
              Incident Onset Swimlane Timeline
            </h3>
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
              Who Broke First Analysis
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tracks error rate progression over time. Markers highlight the exact onset time when each service started failing.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-emerald-900 border border-emerald-700" />
            0%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-amber-900 border border-amber-700" />
            &lt;20%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-rose-600" />
            50-100%
          </span>
          <span className="flex items-center gap-1 text-white font-bold pl-1">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-[9px] text-white">
              !
            </span>
            Onset
          </span>
        </div>
      </div>

      {/* Swimlane Grid */}
      <div className="rounded-xl bg-[#060a14] border border-slate-800 p-4 overflow-x-auto space-y-3">
        {/* Phase Header Bands */}
        {phases.length > 0 && (
          <div className="flex items-center gap-1 pl-32 pr-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {phases.map((p, idx) => (
              <div
                key={idx}
                className={`flex-1 text-center py-1 rounded border ${
                  p.label === "HEALTHY"
                    ? "bg-emerald-950/20 text-emerald-400 border-emerald-900/40"
                    : p.label === "DEGRADED"
                    ? "bg-amber-950/30 text-amber-300 border-amber-800/40"
                    : "bg-rose-950/40 text-rose-300 border-rose-800/60"
                }`}
              >
                <span>{p.label} Phase</span>
              </div>
            ))}
          </div>
        )}

        {/* Rows per Service */}
        <div className="space-y-2">
          {services.map((svc) => {
            const isRoot = svc === analysis.root_cause_service;
            const onset = analysis.service_onsets[svc];
            const onsetIdx = serviceOnsetBucketIdx[svc];

            return (
              <div key={svc} className="flex items-center gap-2">
                {/* Service Label */}
                <div className="w-32 shrink-0 flex items-center justify-between text-xs font-mono pr-2">
                  <span
                    className={`truncate font-bold ${
                      isRoot ? "text-rose-300" : "text-slate-300"
                    }`}
                    title={svc}
                  >
                    {svc}
                  </span>
                  {isRoot && (
                    <span className="rounded bg-rose-600 px-1 py-0.2 text-[8px] font-bold uppercase text-white shrink-0">
                      ROOT
                    </span>
                  )}
                </div>

                {/* Timeline Cells for this Service */}
                <div className="flex-1 flex items-center gap-0.5 h-8 bg-slate-950 rounded-lg p-1 border border-slate-800/80 relative">
                  {timeline.map((bucket, bIdx) => {
                    const sData = bucket.services[svc];
                    const errRate = sData?.error_rate || 0.0;
                    const reqCount = sData?.request_count || 0;
                    const isOnset = bIdx === onsetIdx;

                    return (
                      <div
                        key={bIdx}
                        onClick={() => {
                          if (isOnset && onset?.evidence_ids?.length) {
                            onOpenEvidence(onset.evidence_ids[0]);
                          }
                        }}
                        title={`${svc} at ${bucket.start.slice(11, 19)} UTC\nErrors: ${sData?.error_count || 0}/${reqCount} (${(errRate * 100).toFixed(0)}%)\n${isOnset ? "★ SERVICE ONSET" : ""}`}
                        className={`flex-1 h-full rounded-sm transition-colors cursor-pointer relative flex items-center justify-center ${getCellColor(
                          errRate,
                          reqCount
                        )}`}
                      >
                        {isOnset && (
                          <div className="h-4 w-4 rounded-full bg-rose-600 text-white font-bold text-[9px] flex items-center justify-center shadow-md animate-pulse">
                            !
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Onset Time Label */}
                <div className="w-20 shrink-0 text-right font-mono text-[11px] text-slate-400">
                  {onset?.onset_ts ? onset.onset_ts.slice(11, 19) : "—"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer time labels */}
        <div className="flex items-center justify-between pl-32 pr-20 pt-1 text-[10px] font-mono text-slate-400">
          <span>{timeline[0]?.start.slice(11, 19)} UTC</span>
          <span>Incident Propagation Timeline</span>
          <span>{timeline[timeline.length - 1]?.end.slice(11, 19)} UTC</span>
        </div>
      </div>
    </div>
  );
}
