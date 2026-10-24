"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3Force from "d3-force";
import { CausalityGraph, CausalityNode, CausalityEdge } from "@/lib/types";
import {
  GitCommit,
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Filter,
  X,
  AlertOctagon,
  AlertTriangle,
  Info,
  Clock,
  Layers,
  Terminal,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface Props {
  graph: CausalityGraph;
  selectedService: string | null;
  onSelectService: (service: string | null) => void;
}

interface SimNode extends d3Force.SimulationNodeDatum, CausalityNode {
  radius: number;
}

interface SimLink extends d3Force.SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
  weight: number;
  lag_seconds: number;
  description: string;
}

const LEVEL_COLORS: Record<string, { fill: string; stroke: string; text: string; bg: string }> = {
  CRITICAL: {
    fill: "#7f1d1d",
    stroke: "#ef4444",
    text: "text-red-300",
    bg: "bg-red-950/80 border-red-800/80",
  },
  ERROR: {
    fill: "#9f1239",
    stroke: "#f43f5e",
    text: "text-rose-300",
    bg: "bg-rose-950/80 border-rose-800/80",
  },
  WARN: {
    fill: "#78350f",
    stroke: "#f59e0b",
    text: "text-amber-300",
    bg: "bg-amber-950/80 border-amber-800/80",
  },
  INFO: {
    fill: "#0e3a5a",
    stroke: "#06b6d4",
    text: "text-cyan-300",
    bg: "bg-cyan-950/80 border-cyan-800/80",
  },
};

export function LogNetworkGraph({ graph, selectedService, onSelectService }: Props) {
  const [viewMode, setViewMode] = useState<"log_events" | "services">("log_events");
  const [selectedNode, setSelectedNode] = useState<CausalityNode | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>("ERRORS");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<CausalityNode | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);

  // Choose between detailed log_event nodes or macro service nodes
  const rawNodes = useMemo(() => {
    if (viewMode === "services" && graph.service_nodes && graph.service_nodes.length > 0) {
      return graph.service_nodes;
    }
    return graph.nodes || [];
  }, [graph, viewMode]);

  const rawEdges = useMemo(() => {
    if (viewMode === "services" && graph.service_edges && graph.service_edges.length > 0) {
      return graph.service_edges;
    }
    return graph.edges || [];
  }, [graph, viewMode]);

  // Extract all distinct services for filter dropdown
  const allServices = useMemo(() => {
    const set = new Set<string>();
    rawNodes.forEach((n) => {
      if (n.service) set.add(n.service);
    });
    return Array.from(set).sort();
  }, [rawNodes]);

  // Filter nodes according to level & service (capped at max 25 highest-priority patterns)
  const filteredNodes = useMemo(() => {
    const list = rawNodes.filter((node) => {
      // Level filter (default to errors/critical)
      if (levelFilter === "ERRORS" && !["ERROR", "CRITICAL"].includes(node.level || "")) return false;
      if (levelFilter === "WARN" && node.level !== "WARN") return false;
      if (levelFilter === "INFO" && node.level !== "INFO") return false;
      // Service filter
      if (selectedService && node.service && node.service !== selectedService) return false;
      return true;
    });

    return list
      .sort((a, b) => ((b.error_count || 0) * 10 + (b.count || 0)) - ((a.error_count || 0) * 10 + (a.count || 0)))
      .slice(0, 25);
  }, [rawNodes, levelFilter, selectedService]);

  const filteredNodeIds = useMemo(() => {
    return new Set(filteredNodes.map((n) => n.id));
  }, [filteredNodes]);

  // Filter edges to only those connecting visible nodes
  const filteredEdges = useMemo(() => {
    return rawEdges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );
  }, [rawEdges, filteredNodeIds]);

  // Run d3-force simulation
  useEffect(() => {
    if (filteredNodes.length === 0) {
      setSimNodes([]);
      setSimLinks([]);
      return;
    }

    const width = 800;
    const height = 480;

    const nodes: SimNode[] = filteredNodes.map((n) => {
      const isHighSev = ["CRITICAL", "ERROR"].includes(n.level || "");
      const baseRadius = isHighSev ? 18 : 13;
      const countBonus = Math.min(10, Math.log2(Math.max(1, n.count || 1)) * 1.5);
      return {
        ...n,
        radius: baseRadius + countBonus,
      };
    });

    const links: SimLink[] = filteredEdges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      lag_seconds: e.lag_seconds,
      description: e.description,
    }));

    const simulation = d3Force
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3Force
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => Math.max(90, 160 - (d.weight || 0.5) * 50))
      )
      .force("charge", d3Force.forceManyBody().strength(-280))
      .force("center", d3Force.forceCenter(width / 2, height / 2))
      .force("collide", d3Force.forceCollide<SimNode>().radius((d) => d.radius + 18).iterations(2))
      .stop();

    // Pre-heat simulation 120 ticks for immediate stable layout
    for (let i = 0; i < 120; ++i) simulation.tick();

    setSimNodes([...nodes]);
    setSimLinks([...links]);
  }, [filteredNodes, filteredEdges]);

  // Pan & Zoom controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoomLevel((prev) => Math.min(2.5, Math.max(0.4, prev * zoomFactor)));
  };

  const resetView = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // Upstream and downstream links for the selected node
  const nodeConnections = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };
    const incoming: { from: CausalityNode; desc: string; lag: number }[] = [];
    const outgoing: { to: CausalityNode; desc: string; lag: number }[] = [];

    rawEdges.forEach((edge) => {
      if (edge.target === selectedNode.id) {
        const fromNode = rawNodes.find((n) => n.id === edge.source);
        if (fromNode) incoming.push({ from: fromNode, desc: edge.description, lag: edge.lag_seconds });
      }
      if (edge.source === selectedNode.id) {
        const toNode = rawNodes.find((n) => n.id === edge.target);
        if (toNode) outgoing.push({ to: toNode, desc: edge.description, lag: edge.lag_seconds });
      }
    });

    return { incoming, outgoing };
  }, [selectedNode, rawEdges, rawNodes]);

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm space-y-4">
      {/* Top Header & Interactive Filter Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Network className="h-5 w-5 text-rose-400" />
              Advanced Log Pattern Causality Graph
            </h3>
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
              {simNodes.length} Patterns • {simLinks.length} Precedence Edges
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Each circular node represents a distinct message pattern colored by severity. Arrows connect events that directly preceded each other in time. Capped at top 25 high-priority patterns.
          </p>
        </div>

        {/* View Switcher Tabs & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg bg-slate-800/90 p-0.5 border border-slate-700/60 text-xs">
            <button
              onClick={() => setViewMode("log_events")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                viewMode === "log_events"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Log Line Nodes</span>
            </button>
            <button
              onClick={() => setViewMode("services")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                viewMode === "services"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <GitCommit className="h-3.5 w-3.5" />
              <span>Services Macro</span>
            </button>
          </div>

          {/* Reset Zoom */}
          <button
            onClick={resetView}
            title="Reset View"
            className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.min(2.5, z * 1.2))}
            title="Zoom In"
            className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.4, z * 0.8))}
            title="Zoom Out"
            className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Filter toolbar: Severity chips, Search, and Service selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Severity filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase text-slate-400 mr-1">Filter Severity:</span>
          {[
            { id: "ALL", label: "All Severity", color: "bg-slate-800 text-slate-300" },
            { id: "ERRORS", label: "Errors & Critical", color: "bg-rose-950/80 text-rose-300 border-rose-800/80" },
            { id: "WARN", label: "Warnings", color: "bg-amber-950/80 text-amber-300 border-amber-800/80" },
            { id: "INFO", label: "Info", color: "bg-cyan-950/80 text-cyan-300 border-cyan-800/80" },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setLevelFilter(btn.id)}
              className={`rounded-full px-2.5 py-1 font-medium border transition-all ${
                levelFilter === btn.id
                  ? "bg-indigo-600 text-white border-indigo-400 shadow-sm"
                  : `${btn.color} border-slate-700/60 hover:border-slate-500`
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Search input & Service filter */}
        <div className="flex items-center gap-2">
          {/* Service dropdown */}
          <select
            value={selectedService || ""}
            onChange={(e) => onSelectService(e.target.value || null)}
            className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 border border-slate-700/80 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Services ({allServices.length})</option>
            {allServices.map((svc) => (
              <option key={svc} value={svc}>
                {svc}
              </option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search log lines..."
              className="rounded-lg bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 border border-slate-700/80 focus:outline-none focus:border-indigo-500 w-44"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {selectedService && (
            <button
              onClick={() => onSelectService(null)}
              className="flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30"
            >
              <Filter className="h-3 w-3" />
              <span>Clear Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Canvas / SVG Area */}
      <div className="relative flex flex-col lg:flex-row gap-4">
        <div
          className="relative flex-1 bg-[#060a12] rounded-xl border border-slate-800 overflow-hidden cursor-grab active:cursor-grabbing select-none"
          style={{ height: "500px" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Empty state when no nodes match filter */}
          {simNodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-400 bg-slate-950/80 z-20">
              <Network className="h-8 w-8 text-slate-600 mb-2" />
              <p className="font-semibold text-slate-300">No matching log patterns found</p>
              <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                {levelFilter === "ERRORS"
                  ? "No Error or Critical log patterns were recorded for this service. Click 'All Severity' to view background info lines."
                  : "No patterns match the active service or keyword filter."}
              </p>
              <button
                onClick={() => setLevelFilter("ALL")}
                className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Switch to All Severity
              </button>
            </div>
          )}

          {/* Graph SVG */}
          <svg
            ref={svgRef}
            viewBox="0 0 800 480"
            className="w-full h-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 0.15s ease-out",
            }}
          >
            <defs>
              <marker
                id="real-arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="24"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
              </marker>
              <marker
                id="real-arrowhead-active"
                markerWidth="10"
                markerHeight="7"
                refX="24"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#f43f5e" />
              </marker>
              <marker
                id="real-arrowhead-cyan"
                markerWidth="10"
                markerHeight="7"
                refX="24"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#06b6d4" />
              </marker>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Links / Directed Edges */}
            <g className="links">
              {simLinks.map((link, idx) => {
                const src = link.source as SimNode;
                const tgt = link.target as SimNode;
                if (!src.x || !src.y || !tgt.x || !tgt.y) return null;

                const isConnectedToSelected =
                  selectedNode &&
                  (selectedNode.id === src.id || selectedNode.id === tgt.id);

                const isErrorFlow =
                  ["CRITICAL", "ERROR"].includes(src.level || "") ||
                  ["CRITICAL", "ERROR"].includes(tgt.level || "");

                const strokeColor = isConnectedToSelected
                  ? "#f43f5e"
                  : isErrorFlow
                  ? "#e11d48"
                  : "#334155";

                const strokeWidth = isConnectedToSelected ? 2.5 : Math.max(1.2, link.weight * 2.5);

                const midX = (src.x + tgt.x) / 2;
                const midY = (src.y + tgt.y) / 2;

                return (
                  <g key={`${src.id}-${tgt.id}-${idx}`} opacity={isConnectedToSelected ? 1 : 0.65}>
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={link.weight < 0.6 ? "3 3" : undefined}
                      markerEnd={
                        isConnectedToSelected
                          ? "url(#real-arrowhead-active)"
                          : isErrorFlow
                          ? "url(#real-arrowhead-active)"
                          : "url(#real-arrowhead-cyan)"
                      }
                    />
                    {/* Lag label on hover or error flow */}
                    {(isConnectedToSelected || isErrorFlow) && link.lag_seconds > 0 && (
                      <text
                        x={midX}
                        y={midY - 4}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="9"
                        fontFamily="monospace"
                        className="pointer-events-none"
                      >
                        +{link.lag_seconds}s
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Nodes */}
            <g className="nodes">
              {simNodes.map((node) => {
                if (!node.x || !node.y) return null;

                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNode?.id === node.id;
                const isMatchedBySearch =
                  searchQuery.trim() !== "" &&
                  (node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (node.sample_message &&
                      node.sample_message.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (node.service && node.service.toLowerCase().includes(searchQuery.toLowerCase())));

                const isDimmed =
                  (selectedNode && !isSelected && selectedNode.id !== node.id) ||
                  (searchQuery.trim() !== "" && !isMatchedBySearch);

                const sev = (node.level || "INFO").toUpperCase();
                const colors = LEVEL_COLORS[sev] || LEVEL_COLORS.INFO;
                const isCritical = sev === "CRITICAL" || sev === "FATAL";
                const isError = sev === "ERROR";

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode((prev) => (prev?.id === node.id ? null : node));
                    }}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    opacity={isDimmed ? 0.25 : 1}
                  >
                    {/* Critical/Error pulsing ring */}
                    {(isCritical || isError) && (
                      <circle
                        r={node.radius + 8}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth="1.5"
                        opacity="0.3"
                        className="animate-ping"
                      />
                    )}

                    {/* Outer glow for selected or search matched */}
                    {(isSelected || isMatchedBySearch) && (
                      <circle
                        r={node.radius + 6}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth="3"
                        filter="url(#glow)"
                        opacity="0.9"
                      />
                    )}

                    {/* Main Node Circle */}
                    <circle
                      r={node.radius}
                      fill={isSelected ? "#1e1b4b" : colors.fill}
                      stroke={isSelected ? "#818cf8" : colors.stroke}
                      strokeWidth={isSelected ? 3 : 2}
                      className="transition-all hover:scale-110"
                    />

                    {/* Node Icon / Count */}
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#ffffff"
                      fontSize={node.radius > 16 ? "11" : "9"}
                      fontWeight="bold"
                      fontFamily="monospace"
                      className="pointer-events-none"
                    >
                      {node.count && node.count > 1 ? node.count : sev[0]}
                    </text>

                    {/* Node Text Label (Truncated Log Line) */}
                    <text
                      textAnchor="middle"
                      dy={node.radius + 14}
                      fill={isSelected ? "#818cf8" : isError || isCritical ? "#fca5a5" : "#e2e8f0"}
                      fontSize="10"
                      fontWeight={isError || isCritical ? "bold" : "normal"}
                      fontFamily="monospace"
                      className="pointer-events-none"
                    >
                      {node.name.length > 28 ? node.name.slice(0, 26) + "..." : node.name}
                    </text>

                    {/* Service tag pill below label */}
                    {node.service && (
                      <text
                        textAnchor="middle"
                        dy={node.radius + 26}
                        fill="#94a3b8"
                        fontSize="8"
                        fontFamily="monospace"
                        className="pointer-events-none"
                      >
                        [{node.service}]
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Quick HUD legend inside canvas */}
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-1.5 backdrop-blur-md text-[10px]">
            <span className="text-slate-400 font-semibold uppercase">Nodes:</span>
            <span className="flex items-center gap-1 text-red-300">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600 border border-red-400" />
              Critical
            </span>
            <span className="flex items-center gap-1 text-rose-300">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
              Error
            </span>
            <span className="flex items-center gap-1 text-amber-300">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Warn
            </span>
            <span className="flex items-center gap-1 text-cyan-300">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-600" />
              Info
            </span>
          </div>

          {/* Floating Hover Card */}
          {hoveredNode && !selectedNode && (
            <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-slate-900/95 border border-slate-700/80 p-3 shadow-xl backdrop-blur-md text-xs pointer-events-none">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold text-white flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      LEVEL_COLORS[hoveredNode.level || "INFO"]?.stroke ? "bg-rose-500" : "bg-cyan-500"
                    }`}
                  />
                  Service: {hoveredNode.service || "generic"}
                </span>
                <span className="font-mono text-indigo-300 font-semibold">
                  Seen {hoveredNode.count} times
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-300 truncate">
                {hoveredNode.sample_message || hoveredNode.name}
              </p>
            </div>
          )}
        </div>

        {/* Node Inspector Drawer (Shows when a node is clicked) */}
        {selectedNode ? (
          <div className="w-full lg:w-96 rounded-xl border border-indigo-500/40 bg-slate-950 p-4 space-y-4 shadow-xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                    LEVEL_COLORS[selectedNode.level || "INFO"]?.bg || "bg-slate-800"
                  } ${LEVEL_COLORS[selectedNode.level || "INFO"]?.text || "text-slate-200"}`}
                >
                  {selectedNode.level || "INFO"}
                </span>
                <span className="font-mono text-xs font-bold text-white">
                  {selectedNode.service}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Total Frequency and Times */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-900 p-2.5 border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Occurrences</span>
                <div className="font-mono text-base font-bold text-indigo-400 mt-0.5">
                  {selectedNode.count} logs
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-2.5 border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Error Count</span>
                <div className="font-mono text-base font-bold text-rose-400 mt-0.5">
                  {selectedNode.error_count || 0}
                </div>
              </div>
            </div>

            {/* Template Pattern */}
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Log Template Pattern:
              </span>
              <div className="mt-1 rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] text-cyan-300 border border-slate-800 break-words">
                {selectedNode.template_str || selectedNode.name}
              </div>
            </div>

            {/* Raw Sample Log Message */}
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                Raw Log Message Payload:
              </span>
              <pre className="mt-1.5 rounded-lg bg-black/80 p-3 font-mono text-[11px] text-slate-200 border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-44">
                {selectedNode.sample_message || selectedNode.name}
              </pre>
            </div>

            {/* Preceded By (Upstream Causes) */}
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                <ArrowRight className="h-3 w-3 text-cyan-400 rotate-180" />
                Preceded By (Upstream Triggers):
              </span>
              <div className="mt-1.5 space-y-1 text-xs">
                {nodeConnections.incoming.length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic p-1.5">
                    Initial trigger (no upstream preceding logs within window).
                  </div>
                ) : (
                  nodeConnections.incoming.map((inc, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedNode(inc.from)}
                      className="rounded bg-slate-900/80 p-2 border border-slate-800 hover:border-indigo-500 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-bold text-cyan-400">[{inc.from.service}]</span>
                        <span className="text-slate-500">~{inc.lag}s before</span>
                      </div>
                      <p className="text-[11px] text-slate-300 truncate mt-0.5">
                        {inc.from.name}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Followed By (Downstream Consequences) */}
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                <ArrowRight className="h-3 w-3 text-rose-400" />
                Followed By (Downstream Cascades):
              </span>
              <div className="mt-1.5 space-y-1 text-xs">
                {nodeConnections.outgoing.length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic p-1.5">
                    Terminal event (no logged cascade after this point).
                  </div>
                ) : (
                  nodeConnections.outgoing.map((out, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedNode(out.to)}
                      className="rounded bg-slate-900/80 p-2 border border-slate-800 hover:border-rose-500 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-bold text-rose-400">[{out.to.service}]</span>
                        <span className="text-slate-500">~{out.lag}s after</span>
                      </div>
                      <p className="text-[11px] text-slate-300 truncate mt-0.5">
                        {out.to.name}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action button */}
            {selectedNode.service && (
              <button
                onClick={() => onSelectService(selectedNode.service || null)}
                className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Filter Dashboard by {selectedNode.service}
              </button>
            )}
          </div>
        ) : (
          /* Empty Inspector Placeholder */
          <div className="hidden lg:flex w-72 rounded-xl border border-slate-800/80 bg-slate-950/40 p-6 flex-col items-center justify-center text-center text-xs text-slate-500">
            <Sparkles className="h-8 w-8 text-indigo-400/50 mb-3" />
            <span className="font-medium text-slate-400">Interactive Node Inspector</span>
            <p className="mt-1 text-[11px] text-slate-500">
              Click any log line node to view its full raw payload, upstream root triggers, and downstream cascades.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
