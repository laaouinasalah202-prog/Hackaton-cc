"use client";

import { useState, useMemo } from "react";
import { Anomaly } from "@/lib/types";
import {
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Terminal,
  Clock,
  Layers,
} from "lucide-react";

interface Props {
  anomalies: Anomaly[];
  selectedService: string | null;
  onSelectService?: (service: string | null) => void;
  onOpenEvidence?: (evidenceId: number) => void;
}

interface GroupedAnomaly {
  key: string;
  title: string;
  service: string;
  type: string;
  firstTimestamp: string;
  lastTimestamp: string;
  count: number;
  highestScore: number;
  sampleMessages: string[];
  templateStr: string | null;
  anomalies: Anomaly[];
}

export function AnomalyList({ anomalies, selectedService, onSelectService, onOpenEvidence }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filtered = selectedService
    ? anomalies.filter((a) => a.service === selectedService)
    : anomalies;

  // Group duplicate anomalies by (service + explanation/title)
  const groupedAnomalies = useMemo(() => {
    const groups: Record<string, GroupedAnomaly> = {};

    filtered.forEach((a) => {
      const title = a.explanation || a.template_str || "Unusual error pattern";
      const key = `${a.service}::${title}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          title,
          service: a.service,
          type: a.type,
          firstTimestamp: a.timestamp,
          lastTimestamp: a.timestamp,
          count: 1,
          highestScore: a.score,
          sampleMessages: [...(a.sample_messages || [])],
          templateStr: a.template_str,
          anomalies: [a],
        };
      } else {
        groups[key].count += 1;
        if (a.score > groups[key].highestScore) {
          groups[key].highestScore = a.score;
        }
        if (a.sample_messages) {
          groups[key].sampleMessages.push(...a.sample_messages);
        }
        groups[key].lastTimestamp = a.timestamp;
        groups[key].anomalies.push(a);
      }
    });

    return Object.values(groups).sort((a, b) => b.highestScore - a.highestScore);
  }, [filtered]);

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "spike":
        return (
          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-400 border border-rose-500/20">
            Unusual Spike
          </span>
        );
      case "rare_template":
        return (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-400 border border-amber-500/20">
            New Pattern
          </span>
        );
      case "error_jump":
        return (
          <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-purple-400 border border-purple-500/20">
            Error Surge
          </span>
        );
      default:
        return (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Detected System Anomalies ({groupedAnomalies.length} patterns)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked by impact. Click any anomaly to view plain-English diagnostic explanations and technical details.
          </p>
        </div>

        {selectedService && (
          <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20 font-mono">
            Filtered by: {selectedService}
          </span>
        )}
      </div>

      {groupedAnomalies.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          No anomalies recorded for the current filter.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
          {groupedAnomalies.map((item) => {
            const isExpanded = expandedKey === item.key;

            return (
              <div
                key={item.key}
                className={`rounded-lg border transition-all ${
                  isExpanded
                    ? "border-indigo-500/40 bg-slate-850 shadow-md"
                    : "border-slate-800/70 bg-slate-900/60 hover:border-slate-700/80 hover:bg-slate-850"
                }`}
              >
                {/* Header row: Plain-English Title First */}
                <div
                  onClick={() => toggleExpand(item.key)}
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
                      {getTypeBadge(item.type)}
                      <span className="font-mono text-xs font-semibold text-indigo-300 shrink-0">
                        [{item.service}]
                      </span>
                    </div>

                    {/* Plain English title */}
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {item.title}
                    </span>

                    {item.count > 1 && (
                      <span className="rounded-full bg-slate-800 px-2 py-0.2 text-[10px] font-mono text-slate-400 shrink-0 border border-slate-700">
                        {item.count} occurrences
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400">
                      {item.firstTimestamp.slice(11, 19)} UTC
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-3 text-xs animate-in fade-in duration-150">
                    {/* Plain English explanation */}
                    <div className="rounded-lg bg-slate-900/90 p-3 border border-slate-800">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-300 mb-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Incident Context</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        {item.title}
                      </p>
                    </div>

                    {/* Sample log lines */}
                    {item.sampleMessages.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                          <Terminal className="h-3 w-3" />
                          Sample Evidence Lines
                        </span>
                        <div className="space-y-1">
                          {item.sampleMessages.slice(0, 2).map((msg, i) => (
                            <pre
                              key={i}
                              className="rounded bg-black/80 p-2 font-mono text-[10px] text-slate-300 border border-slate-800/80 overflow-x-auto whitespace-pre-wrap"
                            >
                              {msg}
                            </pre>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Collapsible Technical Details (Jargon isolated here) */}
                    <details className="text-[11px] text-slate-400 bg-slate-950/60 rounded p-2.5 border border-slate-800/80">
                      <summary className="cursor-pointer font-semibold text-slate-400 hover:text-slate-200">
                        View Technical Parser & Detection Metadata
                      </summary>
                      <div className="mt-2 space-y-1 font-mono text-[10px]">
                        <div>
                          <strong>Message pattern:</strong>{" "}
                          <span className="text-cyan-400">
                            {item.templateStr || "N/A"}
                          </span>
                        </div>
                        <div>
                          <strong>Anomaly severity score:</strong>{" "}
                          <span className="text-amber-400">
                            {item.highestScore.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <strong>Time range:</strong> {item.firstTimestamp} ➔{" "}
                          {item.lastTimestamp}
                        </div>
                      </div>
                    </details>
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
