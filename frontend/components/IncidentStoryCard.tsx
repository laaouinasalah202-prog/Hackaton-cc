"use client";

import React from "react";
import { IncidentAnalysis } from "@/lib/types";
import {
  Sparkles,
  AlertOctagon,
  ArrowRight,
  ShieldAlert,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Layers,
  Wrench,
} from "lucide-react";

interface Props {
  analysis: IncidentAnalysis | null;
  onOpenEvidence: (evidenceId: number) => void;
}

export function IncidentStoryCard({ analysis, onOpenEvidence }: Props) {
  if (!analysis) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-500 animate-pulse">
        <Sparkles className="h-6 w-6 text-indigo-400 mx-auto mb-2" />
        Computing deterministic incident root cause analysis...
      </div>
    );
  }

  const confidencePercent = Math.round(analysis.confidence * 100);
  const isRuleBased = analysis.ai_status === "unavailable";
  const isSimulated = analysis.ai_status === "simulated";

  // Parse [E#] citations in what_happened and make them clickable links
  const renderNarrativeWithCitations = (text: string) => {
    const parts = text.split(/(\[E\d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[E(\d+)\]/);
      if (match) {
        const evId = parseInt(match[1], 10);
        return (
          <button
            key={i}
            onClick={() => onOpenEvidence(evId)}
            className="inline-flex items-center font-mono font-bold text-cyan-400 hover:text-cyan-300 hover:underline mx-0.5 px-1 py-0.2 rounded bg-cyan-950/60 border border-cyan-800/60 text-[11px]"
            title="Click to view raw evidence log line"
          >
            {part}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Export report as Markdown file
  const exportMarkdown = () => {
    const md = `# Incident Report: ${analysis.headline}
Session: ${analysis.session_id}
Status: ${analysis.ai_status.toUpperCase()} ${analysis.ai_status_reason ? `(${analysis.ai_status_reason})` : ""}

## Summary
${analysis.what_happened}

## Root Cause Analysis
- **Likely Origin**: ${analysis.root_cause_service} (${confidencePercent}% confidence)
- **Explanation**: ${analysis.root_cause_explanation}
- **First Symptom**: ${analysis.first_symptom}
- **Time to Full Outage**: ${analysis.time_to_full_outage}
- **User Impact**: ${analysis.user_impact}

## Propagation Path
${analysis.propagation_path.join(" ➔ ")}

## Suggested Action Items
${analysis.suggested_actions.map((a) => `- [${a.priority}] ${a.action}\n  *Why:* ${a.why}`).join("\n")}

## Incident Phases
${analysis.phases.map((p) => `- **${p.label}** (${p.start_ts} to ${p.end_ts}): ${p.description}`).join("\n")}

## Evidence Log Lines Cited
${analysis.evidence_ids_used
  .map((eid) => {
    const ev = analysis.evidence.find((e) => e.id === eid);
    return ev ? `- [E${ev.id}] [${ev.ts}] [${ev.service}] [${ev.level}] ${ev.message}` : "";
  })
  .filter(Boolean)
  .join("\n")}
`;

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-report-${analysis.session_id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900/95 p-6 shadow-xl shadow-indigo-950/20 space-y-5">
      {/* AI Status Banner if unavailable or simulated */}
      {isRuleBased && (
        <div className="flex items-center justify-between rounded-lg bg-amber-950/60 border border-amber-800/80 px-4 py-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>AI narration unavailable</strong> ({analysis.ai_status_reason || "API key missing / timeout"}). Showing deterministic rule-based analysis.
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider rounded bg-amber-900/80 px-2 py-0.5 border border-amber-700">
            Rule-Based
          </span>
        </div>
      )}

      {isSimulated && (
        <div className="flex items-center gap-2 rounded-lg bg-cyan-950/50 border border-cyan-800/60 px-3.5 py-1.5 text-xs text-cyan-200">
          <Info className="h-4 w-4 text-cyan-400" />
          <span>
            Offline Demo Mode active: Showing simulated response (<strong className="font-mono">LLM_MOCK=1</strong>).
          </span>
          <span className="ml-auto rounded bg-cyan-900/80 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-700">
            SIMULATED
          </span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-indigo-500/20 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="rounded bg-rose-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-rose-300 border border-rose-500/40">
              Root Cause Origin: {analysis.root_cause_service}
            </span>
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
              Deterministic Ground Truth
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight mt-2">
            {analysis.headline}
          </h2>
        </div>

        {/* Action: Export Markdown / Print */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportMarkdown}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-1.5 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-indigo-400" />
            <span>Export Report (.md)</span>
          </button>
        </div>
      </div>

      {/* What Happened Narrative */}
      <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4.5 leading-relaxed text-slate-200 text-xs sm:text-sm">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-indigo-400" />
          <span>Incident Overview & Timeline Narrative</span>
        </div>
        <p className="leading-relaxed">
          {renderNarrativeWithCitations(analysis.what_happened)}
        </p>
      </div>

      {/* Origin Confidence & Propagation Chain */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Origin & Confidence */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Likely Origin Service
            </span>
            <span className="font-mono text-xs font-bold text-indigo-300">
              {confidencePercent}% Confidence
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-rose-950/90 border border-rose-600/80 px-3 py-1.5 font-mono text-sm font-bold text-rose-200">
              {analysis.root_cause_service}
            </span>
            <div className="flex-1">
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full"
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            {analysis.root_cause_explanation}
          </p>
          {analysis.confidence_note && (
            <p className="text-[10px] text-amber-300/90 italic">
              * {analysis.confidence_note}
            </p>
          )}
        </div>

        {/* Propagation Chain of Chips */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-2.5 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Observed Propagation Cascade Path
          </span>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {analysis.propagation_path.map((svc, idx) => (
              <React.Fragment key={svc}>
                <span
                  className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold border ${
                    idx === 0
                      ? "bg-rose-950/90 text-rose-300 border-rose-700/80 shadow-sm"
                      : "bg-slate-800/90 text-slate-200 border-slate-700"
                  }`}
                >
                  {svc}
                  {idx === 0 && (
                    <span className="ml-1.5 text-[9px] uppercase px-1 py-0.2 rounded bg-rose-800/80 text-rose-100">
                      Origin
                    </span>
                  )}
                </span>
                {idx < analysis.propagation_path.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="text-[11px] text-slate-400 pt-1">
            <strong>Time to full outage:</strong> {analysis.time_to_full_outage}
          </div>
        </div>
      </div>

      {/* User Impact Alert */}
      <div className="rounded-lg bg-rose-950/30 border border-rose-500/30 p-3.5 text-xs flex items-start gap-2.5 text-rose-200">
        <AlertOctagon className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-rose-300 mr-1.5">User-Facing Blast Radius:</span>
          <span>{analysis.user_impact}</span>
        </div>
      </div>

      {/* 3 Prioritized Actions */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-indigo-400" />
          <span>Recommended Engineering Actions (Priority Order)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {analysis.suggested_actions.map((act, i) => (
            <div
              key={i}
              className="rounded-xl bg-slate-950/80 border border-slate-800 p-3.5 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                    act.priority === "P1"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : act.priority === "P2"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  }`}
                >
                  {act.priority}
                </span>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Action Item {i + 1}
                </span>
              </div>
              <p className="font-semibold text-slate-200">{act.action}</p>
              <p className="text-[11px] text-slate-400 leading-normal">
                <strong className="text-slate-500">Why:</strong> {act.why}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
