"use client";

import { useState } from "react";
import { Anomaly } from "@/lib/types";
import { AlertTriangle, ChevronRight, ChevronDown, Sparkles, Terminal, ArrowUpRight } from "lucide-react";

interface Props {
  anomalies: Anomaly[];
  selectedService: string | null;
  onSelectService?: (service: string | null) => void;
}

export function AnomalyList({ anomalies, selectedService, onSelectService }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = selectedService
    ? anomalies.filter((a) => a.service === selectedService)
    : anomalies;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "spike":
        return <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-400 border border-rose-500/20">Traffic Spike</span>;
      case "rare_template":
        return <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-400 border border-amber-500/20">Rare Template</span>;
      case "error_jump":
        return <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-purple-400 border border-purple-500/20">Error Jump</span>;
      default:
        return <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">{type}</span>;
    }
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Detected Anomalies ({filtered.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any anomaly to inspect Gemma AI diagnostic explanation and raw sample traces.
          </p>
        </div>

        {selectedService && (
          <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
            Filtered by: {selectedService}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          No anomalies matched the current filter criteria.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {filtered.map((anomaly) => {
            const isExpanded = expandedId === anomaly.id;

            return (
              <div
                key={anomaly.id}
                className={`rounded-lg border transition-all ${
                  isExpanded
                    ? "border-indigo-500/40 bg-slate-850 shadow-md"
                    : "border-slate-800/70 bg-slate-900/60 hover:border-slate-700/80 hover:bg-slate-850"
                }`}
              >
                <div
                  onClick={() => toggleExpand(anomaly.id)}
                  className="flex items-center justify-between p-3.5 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button className="text-slate-500 hover:text-slate-300">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-indigo-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div className="flex items-center gap-2 min-w-0">
                      {getTypeBadge(anomaly.type)}
                      <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                        {anomaly.service}
                      </span>
                    </div>

                    <span className="text-xs text-slate-400 truncate hidden sm:inline">
                      {anomaly.template_str || anomaly.explanation?.slice(0, 60) || "Anomaly pattern"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-[10px] text-slate-400 uppercase font-medium">Anomaly Score:</span>
                        <span className="font-mono text-xs font-bold text-amber-400">
                          {(anomaly.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(anomaly.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Drawer: LLM Explanation + Samples */}
                {isExpanded && (
                  <div className="border-t border-slate-800 px-4 py-3.5 space-y-3 bg-[#080d1a] rounded-b-lg">
                    {/* LLM Explanation */}
                    <div className="rounded-lg bg-indigo-950/20 border border-indigo-500/20 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 mb-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Gemma AI Root Cause Explanation</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {anomaly.explanation || "Downstream cascade detected from upstream dependency failure."}
                      </p>
                    </div>

                    {/* Template ID / Pattern */}
                    {anomaly.template_str && (
                      <div>
                        <span className="text-[11px] font-semibold uppercase text-slate-400">
                          Drain3 Template Pattern
                        </span>
                        <div className="mt-1 rounded bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-cyan-300 border border-slate-800 truncate">
                          {anomaly.template_str}
                        </div>
                      </div>
                    )}

                    {/* Sample Log Lines */}
                    {anomaly.sample_messages && anomaly.sample_messages.length > 0 && (
                      <div>
                        <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                          <Terminal className="h-3 w-3" />
                          <span>Sample Log Traces</span>
                        </span>
                        <div className="mt-1.5 space-y-1">
                          {anomaly.sample_messages.map((msg, i) => (
                            <pre
                              key={i}
                              className="rounded bg-black/60 p-2 font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800/80 whitespace-pre-wrap leading-relaxed"
                            >
                              {msg}
                            </pre>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
