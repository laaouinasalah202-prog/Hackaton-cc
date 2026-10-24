"use client";

import { useState } from "react";
import { CausalityGraph, CausalityNode } from "@/lib/types";
import { GitCommit, ArrowRight, Info, Filter } from "lucide-react";

interface Props {
  graph: CausalityGraph;
  selectedService: string | null;
  onSelectService: (service: string | null) => void;
}

export function CausalityGraphView({ graph, selectedService, onSelectService }: Props) {
  const [hoveredEdge, setHoveredEdge] = useState<any | null>(null);

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-slate-500">
        No causality edges detected.
      </div>
    );
  }

  // Layout node positions in a circular or flow layout for clean SVG rendering
  const width = 640;
  const height = 340;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 120;

  const nodeCount = graph.nodes.length;
  const nodePositions: Record<string, { x: number; y: number }> = {};

  graph.nodes.forEach((node, i) => {
    // Arrange in circle or tiered layout
    const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
    nodePositions[node.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-cyan-400" />
            Service Precedence & Causality Graph
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Directed propagation paths where upstream errors triggered downstream cascades.
          </p>
        </div>

        {selectedService && (
          <button
            onClick={() => onSelectService(null)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors"
          >
            <Filter className="h-3 w-3" />
            <span>Clear Filter ({selectedService})</span>
          </button>
        )}
      </div>

      <div className="relative flex items-center justify-center bg-[#070b13] rounded-lg border border-slate-800/60 p-2 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-80 select-none">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="18"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="8"
              markerHeight="6"
              refX="18"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#f43f5e" />
            </marker>
          </defs>

          {/* Edges */}
          {graph.edges.map((edge, idx) => {
            const src = nodePositions[edge.source];
            const tgt = nodePositions[edge.target];
            if (!src || !tgt) return null;

            const isRelated =
              !selectedService ||
              selectedService === edge.source ||
              selectedService === edge.target;

            const isHovered =
              hoveredEdge &&
              hoveredEdge.source === edge.source &&
              hoveredEdge.target === edge.target;

            // Compute curve midpoint
            const midX = (src.x + tgt.x) / 2;
            const midY = (src.y + tgt.y) / 2;
            const strokeWidth = Math.max(1.5, edge.weight * 3.5);

            return (
              <g
                key={`${edge.source}-${edge.target}-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredEdge(edge)}
                onMouseLeave={() => setHoveredEdge(null)}
                opacity={isRelated ? 1 : 0.15}
              >
                <line
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={isHovered ? "#f43f5e" : "#06b6d4"}
                  strokeWidth={strokeWidth}
                  strokeDasharray={edge.weight < 0.6 ? "4 4" : undefined}
                  markerEnd={isHovered ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                  className="transition-colors"
                />

                {/* Lag label badge */}
                <rect
                  x={midX - 22}
                  y={midY - 8}
                  width="44"
                  height="16"
                  rx="4"
                  fill="#0b1324"
                  stroke={isHovered ? "#f43f5e" : "#1e293b"}
                  strokeWidth="1"
                />
                <text
                  x={midX}
                  y={midY + 3.5}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  +{edge.lag_seconds}s
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {graph.nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const isSelected = selectedService === node.id;
            const isDimmed = selectedService && !isSelected;
            const hasErrors = node.error_count > 0;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer"
                onClick={() => onSelectService(isSelected ? null : node.id)}
                opacity={isDimmed ? 0.35 : 1}
              >
                {/* Active pulse ring for high errors */}
                {hasErrors && (
                  <circle
                    r="24"
                    fill="none"
                    stroke={isSelected ? "#818cf8" : "#f43f5e"}
                    strokeWidth="1.5"
                    opacity="0.4"
                    className="animate-ping"
                  />
                )}

                {/* Main node circle */}
                <circle
                  r="20"
                  fill={isSelected ? "#4338ca" : hasErrors ? "#1e1b4b" : "#0f172a"}
                  stroke={isSelected ? "#818cf8" : hasErrors ? "#f43f5e" : "#334155"}
                  strokeWidth={isSelected ? "2.5" : "1.5"}
                  className="transition-all hover:scale-110"
                />

                {/* Error count badge */}
                <text
                  textAnchor="middle"
                  dy="-1"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {node.error_count > 999 ? "999+" : node.error_count}
                </text>

                {/* Node name label */}
                <text
                  textAnchor="middle"
                  dy="32"
                  fill={isSelected ? "#818cf8" : "#e2e8f0"}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover detail tooltip bar */}
        {hoveredEdge && (
          <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-slate-900/90 border border-slate-700/80 px-3 py-2 text-xs flex items-center justify-between backdrop-blur-md">
            <span className="text-slate-300 flex items-center gap-2">
              <span className="font-mono font-bold text-cyan-400">{hoveredEdge.source}</span>
              <ArrowRight className="h-3 w-3 text-slate-500" />
              <span className="font-mono font-bold text-rose-400">{hoveredEdge.target}</span>
              <span className="text-slate-400">({hoveredEdge.description})</span>
            </span>
            <span className="font-mono text-cyan-400 font-semibold">
              Weight: {(hoveredEdge.weight * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-indigo-400" />
          Click any service node to cross-filter timeline, heatmap, and logs.
        </span>
        <span className="font-mono text-[11px] text-slate-500">
          {graph.edges.length} causality cascade paths discovered
        </span>
      </div>
    </div>
  );
}
