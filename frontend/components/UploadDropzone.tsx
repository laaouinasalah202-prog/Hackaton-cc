"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, Sparkles, Play, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { uploadLogs, loadDemoData } from "@/lib/api";

interface FileItem {
  file: File;
  source: string;
}

export function UploadDropzone() {
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (incomingFiles: FileList | File[]) => {
    const newItems: FileItem[] = Array.from(incomingFiles).map((f) => ({
      file: f,
      source: f.name.replace(/\.[^/.]+$/, ""), // default source = filename without extension
    }));
    setFiles((prev) => [...prev, ...newItems]);
    setErrorMessage(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSource = (index: number, newSource: string) => {
    setFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, source: newSource } : item))
    );
  };

  const handleUploadSubmit = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const rawFiles = files.map((f) => f.file);
      const sources = files.map((f) => f.source);
      const res = await uploadLogs(rawFiles, sources);
      router.push(`/dashboard/${res.session_id}`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload log files.");
      setIsUploading(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    setErrorMessage(null);

    try {
      const res = await loadDemoData();
      router.push(`/dashboard/${res.session_id}`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load demo data.");
      setIsLoadingDemo(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Hero Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Format-Agnostic AI Log Intelligence</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Upload any log. <br />
          <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-300 bg-clip-text text-transparent">
            Uncover root causes instantly.
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-400">
          Upload log files in JSON lines, Log4j, Nginx, Python, or raw plain text.
          LogLens unifies them with Drain3 template mining, computes cross-service causality,
          and uses Gemma to explain root causes.
        </p>
      </div>

      {/* One-Click Demo Card */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/40 via-slate-900/80 to-slate-900 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-base font-bold text-white">
                One-Click Interactive Demo (4 Services)
              </h3>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Simulates real-world microservices under cascading failure: PostgreSQL slow queries & pool saturation &rarr; Java API thread timeouts &rarr; Nginx 502/504 gateway errors &rarr; Auth worker job aborts.
            </p>
          </div>

          <button
            onClick={handleLoadDemo}
            disabled={isLoadingDemo || isUploading}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
          >
            {isLoadingDemo ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Launching Demo...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" />
                <span>Load Demo Data</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <div className="rounded-full bg-slate-800/90 p-4 text-indigo-400 border border-slate-700/80 mb-3 shadow-inner">
          <Upload className="h-8 w-8" />
        </div>

        <h3 className="text-base font-semibold text-white">
          Drag and drop your log files here, or click to browse
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Supports .log, .txt, .json, .jsonl, .out, syslog, etc. (up to 50MB per file)
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {["JSON Lines", "Log4j Java", "Nginx / Apache", "Python Logging", "Syslog", "Custom Heuristics"].map((fmt) => (
            <span
              key={fmt}
              className="rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 border border-slate-700/50"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {/* Selected Files List with Service Name customization */}
      {files.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">
              Selected Log Files ({files.length})
            </h4>
            <span className="text-xs text-slate-400">
              Customize service names or click Start Analysis
            </span>
          </div>

          <div className="space-y-2.5">
            {files.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-md bg-indigo-500/10 p-2 text-indigo-400 shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-medium text-slate-200 truncate">
                      {item.file.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {(item.file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 shrink-0">Service label:</label>
                  <input
                    type="text"
                    value={item.source}
                    onChange={(e) => updateSource(idx, e.target.value)}
                    placeholder="e.g. backend-api"
                    className="rounded bg-slate-800 px-2.5 py-1 text-xs text-white border border-slate-700 focus:outline-none focus:border-indigo-500 w-36"
                  />
                  <button
                    onClick={() => removeFile(idx)}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setFiles([])}
              className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Clear All
            </button>
            <button
              onClick={handleUploadSubmit}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Uploading & Queuing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Start Unified Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error state alert */}
      {errorMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
