"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { IncidentAnalysis, DependencyEdge, EvidenceItem } from "@/lib/types";
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  Clock,
  ShieldAlert,
  Edit2,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface Props {
  analysis: IncidentAnalysis;
  onOpenEvidence: (evidenceId: number) => void;
  onUpdateDependencies?: (dependencies: DependencyEdge[]) => Promise<void>;
}

export function ServiceFlow({ analysis, onOpenEvidence, onUpdateDependencies }: Props) {
  const [sliderIndex, setSliderIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isEditingTopology, setIsEditingTopology] = useState(false);
  const [editableEdges, setEditableEdges] = useState<DependencyEdge[]>(analysis.dependencies || []);
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [isSavingDeps, setIsSavingDeps] = useState(false);

  const timeline = analysis.health_timeline || [];
  const maxIdx = Math.max(0, timeline.length - 1);
  const currentBucket = timeline[sliderIndex] || null;

  // Auto-play interval
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setSliderIndex((prev) => {
          if (prev >= maxIdx) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, maxIdx]);

  // Synchronize editable edges with analysis changes
  useEffect(() => {
    setEditableEdges(analysis.dependencies || []);
  }, [analysis.dependencies]);

  // Extract all distinct services
  const services = useMemo(() => {
    const set = new Set<string>();
    (analysis.ranked_candidates || []).forEach((c) => set.add(c.service));
    Object.keys(analysis.service_onsets || {}).forEach((s) => set.add(s));
    return Array.from(set).sort();
  }, [analysis]);

  // Compute Layering (Left to Right: Clients/Gateway -> Intermediate -> Deepest DB)
  // Distance from root_cause_service: deepest = highest layer
  const serviceLayers = useMemo(() => {
    const layers: Record<string, number> = {};
    const root = analysis.root_cause_service;

    // Default layer assignment based on service role heuristics
    services.forEach((s) => {
      const lower = s.toLowerCase();
      if (lower.includes("gateway") || lower.includes("ingress") || lower.includes("proxy") || lower.includes("frontend")) {
        layers[s] = 0; // Leftmost client
      } else if (s === root || lower.includes("database") || lower.includes("db") || lower.includes("postgres")) {
        layers[s] = 2; // Rightmost backend dependency
      } else {
        layers[s] = 1; // Middle tier
      }
    });

    return layers;
  }, [services, analysis.root_cause_service]);

  // Group services by layer column
  const layerColumns = useMemo(() => {
    const cols: Record<number, string[]> = { 0: [], 1: [], 2: [] };
    services.forEach((s) => {
      const l = serviceLayers[s] ?? 1;
      cols[l].push(s);
    });
    return cols;
  }, [services, serviceLayers]);

  // Get current health of a service at slider time
  const getServiceHealth = (service: string) => {
    if (!currentBucket || !currentBucket.services[service]) {
      return { status: "HEALTHY", error_rate: 0.0, top_sig: null, req_cnt: 0 };
    }
    const info = currentBucket.services[service];
    const rate = info.error_rate || 0.0;
    if (rate >= 0.25) {
      return { status: "FAILING", error_rate: rate, top_sig: info.top_error_signature, req_cnt: info.request_count };
    }
    if (rate > 0.05) {
      return { status: "DEGRADED", error_rate: rate, top_sig: info.top_error_signature, req_cnt: info.request_count };
    }
    return { status: "HEALTHY", error_rate: rate, top_sig: null, req_cnt: info.request_count };
  };

  const handleAddDependency = () => {
    if (!newSource || !newTarget || newSource === newTarget) return;
    const exists = editableEdges.some((e) => e.source === newSource && e.target === newTarget);
    if (exists) return;

    setEditableEdges((prev) => [
      ...prev,
      {
        source: newSource,
        target: newTarget,
        type: "user_defined",
        confidence: 1.0,
        reason: "User-defined dependency",
        evidence_ids: [],
      },
    ]);
    setNewSource("");
    setNewTarget("");
  };

  const handleRemoveDependency = (idx: number) => {
    setEditableEdges((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveDependencies = async () => {
    if (!onUpdateDependencies) return;
    setIsSavingDeps(true);
    try {
      await onUpdateDependencies(editableEdges);
      setIsEditingTopology(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingDeps(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-400" />
              Service Flow & Dependency Architecture
            </h3>
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
              Interactive Incident Replay
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Arrows point from caller to the dependency it relies on. Scrub slider to watch the failure propagate.
          </p>
        </div>

        {/* Topology Editor Toggle */}
        {onUpdateDependencies && (
          <button
            onClick={() => setIsEditingTopology((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 text-xs font-medium border border-slate-700/80 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Edit2 className="h-3.5 w-3.5 text-indigo-400" />
            <span>{isEditingTopology ? "Close Editor" : "Edit Topology"}</span>
          </button>
        )}
      </div>

      {/* Dependency Editor Drawer / Box */}
      {isEditingTopology && (
        <div className="rounded-xl bg-slate-950 p-4 border border-indigo-500/40 space-y-3 animate-in fade-in duration-200 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Edit2 className="h-3.5 w-3.5 text-indigo-400" />
              Configure Service Dependencies
            </span>
            <span className="text-[11px] text-slate-400">
              Add or remove caller-to-dependency relationships to re-score root cause.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="rounded bg-slate-800 px-2.5 py-1.5 text-xs text-white border border-slate-700 focus:outline-none"
            >
              <option value="">Select Caller (Source)...</option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="text-slate-500">depends on ➔</span>
            <select
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              className="rounded bg-slate-800 px-2.5 py-1.5 text-xs text-white border border-slate-700 focus:outline-none"
            >
              <option value="">Select Dependency (Target)...</option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddDependency}
              disabled={!newSource || !newTarget || newSource === newTarget}
              className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Dependency Edge</span>
            </button>
          </div>

          {/* List of active edges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {editableEdges.map((e, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 border border-slate-800 px-2.5 py-1 text-[11px] text-slate-200"
              >
                <span className="font-mono font-bold text-indigo-300">{e.source}</span>
                <span className="text-slate-500">➔</span>
                <span className="font-mono font-bold text-rose-300">{e.target}</span>
                <span className="text-[9px] rounded bg-slate-800 px-1 py-0.2 text-slate-400">
                  {e.type}
                </span>
                <button
                  onClick={() => handleRemoveDependency(idx)}
                  className="text-slate-500 hover:text-rose-400 ml-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              onClick={handleSaveDependencies}
              disabled={isSavingDeps}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{isSavingDeps ? "Recalculating..." : "Save Topology & Recalculate Root Cause"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Time Slider & Playback Bar */}
      <div className="rounded-xl bg-slate-950/80 p-4 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Replay Cascade</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setSliderIndex(0);
              }}
              className="rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:text-white border border-slate-700/80"
              title="Reset to Start"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-xs text-slate-300 font-semibold pl-1">
              Time: {currentBucket?.start ? currentBucket.start.slice(11, 19) : "00:00:00"} UTC
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Healthy
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Degraded
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Failing
            </span>
          </div>
        </div>

        {/* Scrubbable Slider */}
        <input
          type="range"
          min={0}
          max={maxIdx}
          value={sliderIndex}
          onChange={(e) => {
            setIsPlaying(false);
            setSliderIndex(parseInt(e.target.value, 10));
          }}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>

      {/* Layered Flow Diagram (SVG + Div Nodes) */}
      <div className="relative rounded-xl bg-[#060a14] border border-slate-800 p-6 min-h-[380px] overflow-x-auto">
        {/* Layer Column Headers */}
        <div className="grid grid-cols-3 gap-8 mb-6 pb-2 border-b border-slate-800/80 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <div>Client & Ingress Layer</div>
          <div>Application & Services Layer</div>
          <div>Storage & Database Layer</div>
        </div>

        {/* Three Columns of Service Nodes */}
        <div className="grid grid-cols-3 gap-8 relative z-10">
          {[0, 1, 2].map((colIdx) => (
            <div key={colIdx} className="space-y-4 flex flex-col items-center">
              {layerColumns[colIdx].map((svc) => {
                const health = getServiceHealth(svc);
                const isRoot = svc === analysis.root_cause_service;
                const onset = analysis.service_onsets[svc];

                return (
                  <div
                    key={svc}
                    onClick={() => {
                      if (onset?.evidence_ids?.length) {
                        onOpenEvidence(onset.evidence_ids[0]);
                      }
                    }}
                    onMouseEnter={() => setHoveredNode(svc)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className={`w-full max-w-[220px] rounded-xl p-3.5 border transition-all cursor-pointer shadow-md text-left ${
                      health.status === "FAILING"
                        ? "bg-rose-950/70 border-rose-600/80 shadow-rose-950/30 ring-1 ring-rose-500/40"
                        : health.status === "DEGRADED"
                        ? "bg-amber-950/60 border-amber-600/80 shadow-amber-950/30 ring-1 ring-amber-500/40"
                        : "bg-slate-900/90 border-slate-700/80 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            health.status === "FAILING"
                              ? "bg-rose-500 animate-pulse"
                              : health.status === "DEGRADED"
                              ? "bg-amber-400"
                              : "bg-emerald-500"
                          }`}
                        />
                        <span className="font-mono text-xs font-bold text-white truncate max-w-[120px]">
                          {svc}
                        </span>
                      </div>
                      {isRoot && (
                        <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[9px] font-bold uppercase text-white shadow-sm">
                          ORIGIN
                        </span>
                      )}
                    </div>

                    {/* Subtitle: Error rate & signature */}
                    <div className="mt-2 text-[11px] font-mono">
                      <div
                        className={
                          health.status === "FAILING"
                            ? "text-rose-300 font-bold"
                            : health.status === "DEGRADED"
                            ? "text-amber-300"
                            : "text-slate-400"
                        }
                      >
                        Error Rate: {(health.error_rate * 100).toFixed(0)}%
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5" title={health.top_sig || "Normal traffic"}>
                        {health.top_sig || (health.status === "HEALTHY" ? "Normal traffic" : "Latency degradation")}
                      </p>
                    </div>

                    {onset?.onset_ts && (
                      <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Onset:</span>
                        <span className="font-mono text-indigo-300">{onset.onset_ts.slice(11, 19)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend Footnote */}
        <div className="mt-6 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-indigo-500" />
              Observed Dependency
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 border-b border-dashed border-indigo-400" />
              Inferred Dependency
            </span>
          </div>
          <span className="italic text-slate-400">
            Click any service box to view its earliest symptoms in the Evidence Drawer.
          </span>
        </div>
      </div>
    </div>
  );
}
