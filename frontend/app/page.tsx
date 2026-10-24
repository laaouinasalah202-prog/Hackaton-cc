"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Play,
  Loader2,
  Terminal,
  ArrowRight,
  Database,
  Layers,
  Cpu,
  Server,
  Globe,
  FileText,
  Activity,
  Zap,
  Upload,
  User,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { UploadDropzone } from "@/components/UploadDropzone";
import { getCurrentUser, GOOGLE_LOGIN_URL, loadDemoData } from "@/lib/api";
import { AuthUser } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        setIsLoadingAuth(false);
      })
      .catch(() => {
        setCurrentUser(null);
        setIsLoadingAuth(false);
      });
  }, []);

  const handleLaunchDemo = async () => {
    setIsLoadingDemo(true);
    setDemoError(null);
    try {
      const res = await loadDemoData();
      router.push(`/dashboard/${res.session_id}`);
    } catch (err: any) {
      setDemoError(err.message || "Failed to launch demo incident.");
      setIsLoadingDemo(false);
    }
  };

  const scrollToUpload = () => {
    const el = document.getElementById("upload-workspace");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      <Navbar />

      <main className="flex-1">
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-slate-800/80">
          {/* Subtle background glow effect */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-600/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            {/* Pill Tagline */}
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20 backdrop-blur-sm shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>LogLens 2.0 &bull; Format-Agnostic AI Incident Intelligence</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1]">
              Upload Any Log Format. <br />
              <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                Pinpoint Root Causes in Seconds.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto max-w-3xl text-sm sm:text-base lg:text-lg text-slate-400 leading-relaxed font-normal">
              Never write a custom log parser again. LogLens ingests unstructured telemetry across microservices,
              deterministically computes who failed first with adaptive onset detection, and uses Gemma to narrate
              evidence-backed incident runbooks with zero hallucinations.
            </p>

            {/* Interactive Call to Actions */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
              {isLoadingAuth ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                  <span>Checking session...</span>
                </div>
              ) : currentUser ? (
                <>
                  <button
                    onClick={handleLaunchDemo}
                    disabled={isLoadingDemo}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isLoadingDemo ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading Demo Incident...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-white" />
                        <span>Launch 4-Service Demo Incident</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={scrollToUpload}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <Upload className="h-4 w-4 text-indigo-400" />
                    <span>Upload Custom Logs</span>
                  </button>
                </>
              ) : (
                <>
                  <a
                    href={GOOGLE_LOGIN_URL}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold px-7 py-3.5 text-sm shadow-xl shadow-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign In with Google</span>
                  </a>

                  <button
                    onClick={scrollToUpload}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <span>Learn How It Works</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </button>
                </>
              )}
            </div>

            {demoError && (
              <div className="mx-auto max-w-md flex items-center justify-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{demoError}</span>
              </div>
            )}

            {/* Proof Badges */}
 
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PLATFORM ARCHITECTURE & CASCAING FAILURE SIMULATION PREVIEW               */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 border-b border-slate-800/80 bg-slate-950/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                How LogLens Reconstructs Cascading Outages
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                A live demonstration of how LogLens tracks failure propagation across disparate log formats—from the deepest backend leaf component to the ingress edge.
              </p>
            </div>

            {/* Simulated Live Incident Card */}
            <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#0f1523]/90 shadow-2xl backdrop-blur-xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      Cascading Service Outage: Origin in database
                      <span className="rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-semibold px-2 py-0.5 border border-rose-500/30">
                        CRITICAL SEVERITY
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Propagation: database &rarr; api-server &rarr; api-gateway &rarr; auth-worker &bull; Time to full outage: 42s
                    </p>
                  </div>
                </div>

                {currentUser ? (
                  <button
                    onClick={handleLaunchDemo}
                    disabled={isLoadingDemo}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer shrink-0"
                  >
                    <span>Replay in Live Dashboard</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <a
                    href={GOOGLE_LOGIN_URL}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer shrink-0"
                  >
                    <span>Sign In to Replay</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {/* 4 Service Onset Progression Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Database (Origin) */}
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-rose-400 font-bold flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5" />
                      database
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">14:25:31 UTC</span>
                  </div>
                  <div className="inline-block rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 border border-rose-500/40">
                    LEAF ORIGIN (99% Conf.)
                  </div>
                  <p className="text-[11px] font-mono text-slate-300 truncate" title="FATAL: remaining connection slots are reserved">
                    FATAL: connection slots reserved
                  </p>
                  <p className="text-[10px] text-slate-400">
                    PostgreSQL slow queries preceded connection pool saturation.
                  </p>
                </div>

                {/* 2. API Server */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-amber-400 font-bold flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5" />
                      api-server
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">14:25:51 (+20s)</span>
                  </div>
                  <div className="inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/40">
                    DOWNSTREAM SATURATION
                  </div>
                  <p className="text-[11px] font-mono text-slate-300 truncate">
                    HikariPool connection timeout
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Log4j Java threads blocked waiting for database response.
                  </p>
                </div>

                {/* 3. API Gateway */}
                <div className="rounded-xl border border-rose-500/30 bg-slate-900/60 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-indigo-400 font-bold flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      api-gateway
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">14:26:13 (+42s)</span>
                  </div>
                  <div className="inline-block rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300 border border-indigo-500/40">
                    DEMOTED VICTIM (146 Errors)
                  </div>
                  <p className="text-[11px] font-mono text-slate-300 truncate">
                    POST /orders &rarr; 504 Timeout
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Nginx ingress returned 504 and 502 connection refused.
                  </p>
                </div>

                {/* 4. Auth Worker */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-cyan-400 font-bold flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" />
                      auth-worker
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">14:26:31 (+60s)</span>
                  </div>
                  <div className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 border border-slate-700">
                    ASYNC JOB ABORT
                  </div>
                  <p className="text-[11px] font-mono text-slate-300 truncate">
                    Failed to verify session token
                  </p>
                  <p className="text-[10px] text-slate-400">
                    JSON lines jobs failed auth checks due to DB timeout.
                  </p>
                </div>
              </div>

              {/* Gemma Grounded Narration Preview Banner */}
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400 border border-indigo-500/20 shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                      Gemma Grounded Narration &bull; Strict Zero-Hallucination Policy
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                      &ldquo;At 14:25:31, database began failing with connection pool exhaustion <span className="font-mono text-indigo-400 underline decoration-indigo-400/50">[E1]</span>, cascading downstream to api-server <span className="font-mono text-indigo-400 underline decoration-indigo-400/50">[E2]</span> and triggering 146 user-facing 502/504 errors on api-gateway <span className="font-mono text-indigo-400 underline decoration-indigo-400/50">[E3]</span>.&rdquo;
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[11px] text-emerald-400 font-medium">
                    P1: Restart database pool
                  </span>
                  <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] text-slate-300 font-medium hidden sm:inline-block">
                    P2: Clear slow locks
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* THE THREE PILLARS OF LOGLENS                                              */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 border-b border-slate-800/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
                <Zap className="h-3.5 w-3.5" />
                <span>Engineered for 3 AM On-Call</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Code Computes the Facts. The LLM Only Narrates Them.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Most AI log tools feed raw dumps to an LLM, generating plausible hallucinations.
                LogLens flips this: mathematical code computes the onset timestamps, dependency trees, and leaf origin before the LLM generates a single sentence.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Pillar 1 */}
              <div className="rounded-2xl border border-slate-800 bg-[#0f1523]/80 p-7 space-y-4 hover:border-slate-700 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-white">100% Format-Agnostic</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Never write bespoke parsers per service. LogLens layer-detects JSON lines, Nginx, Log4j, Syslog, or raw text. Drain3 template clustering protects 3-digit status codes so <span className="text-slate-200 font-mono">200 OK</span> and <span className="text-rose-400 font-mono">504 Timeout</span> never collide into the same pattern.
                </p>
                <div className="pt-2 flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-400">
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">JSON Lines</span>
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">Log4j / Java</span>
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">Nginx / Apache</span>
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">PostgreSQL</span>
                </div>
              </div>

              {/* Pillar 2 */}
              <div className="rounded-2xl border border-slate-800 bg-[#0f1523]/80 p-7 space-y-4 hover:border-slate-700 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Activity className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Deterministic Onsets & Victim Demotion</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Calculates rolling error density buckets and fires onsets at <span className="text-slate-200 font-mono">median + 4&times;MAD</span>. Ingress proxies reporting 502/504 upstream errors are flagged with victim demotion, preventing the API Gateway from being falsely blamed as the root cause.
                </p>
                <div className="pt-2 flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-400">
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">MAD Baseline Spikes</span>
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">Leaf-Origin Scoring</span>
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">Observed Topology</span>
                </div>
              </div>

              {/* Pillar 3 */}
              <div className="rounded-2xl border border-slate-800 bg-[#0f1523]/80 p-7 space-y-4 hover:border-slate-700 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Evidence-Backed Runbooks</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Gemma turns raw statistical facts into a concise 1-paragraph incident story. Every claim is strictly backed by clickable <span className="text-indigo-400 font-mono">[E#]</span> evidence citations that open raw log lines in the evidence drawer and jump straight to the log table.
                </p>
                <div className="pt-2 flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-400">
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">[E#] Evidence Badges</span>
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">P1-P3 Prioritized Fixes</span>
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">1-Click Postmortem Export</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* HOW IT WORKS (3 WORKFLOW STEPS)                                           */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 border-b border-slate-800/80 bg-slate-950/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Three Steps to Complete Incident Resolution
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                From raw multi-service log dumps to complete incident postmortem in under 30 seconds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* Step 1 */}
              <div className="relative rounded-2xl border border-slate-800 bg-[#0f1523]/60 p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-xs text-white">
                    01
                  </div>
                  <h4 className="text-sm font-bold text-white">Ingest & Standardize</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload raw files from any service. The pipeline handles multi-line stack trace grouping, parses ISO/Nginx/Syslog timestamps with zero date skew, and masks sensitive PII (emails, tokens, passwords).
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative rounded-2xl border border-slate-800 bg-[#0f1523]/60 p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 font-bold text-xs text-white">
                    02
                  </div>
                  <h4 className="text-sm font-bold text-white">Cluster & Detect Causality</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Drain3 mines patterns into clusters, all-MiniLM-L6-v2 embeds templates, and the deterministic engine builds the service dependency tree, marking onsets and demoting victim proxies.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative rounded-2xl border border-slate-800 bg-[#0f1523]/60 p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-bold text-xs text-white">
                    03
                  </div>
                  <h4 className="text-sm font-bold text-white">Replay & Remediate</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Scrub through the interactive time slider to see microservices transition from green to amber to red. Follow Gemma&apos;s P1-P3 action items and export an instant incident report.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* INCIDENT WORKSPACE & LOG UPLOAD SECTION                                  */}
        {/* ========================================================================= */}
        <section id="upload-workspace" className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                <Terminal className="h-3.5 w-3.5" />
                <span>Incident Workspace</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {currentUser ? "Upload Log Files for Analysis" : "Ready to Analyze Your Telemetry?"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {currentUser
                  ? `Signed in as ${currentUser.name || currentUser.email}. Drop log files below or launch the pre-loaded demo.`
                  : "Sign in with Google to upload custom log files from your infrastructure, or explore the pre-loaded demo incident without signing in."}
              </p>
            </div>

            {currentUser ? (
              /* Authenticated User: Render Full Dropzone */
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-950/20 px-4 py-2.5 text-xs text-indigo-300 max-w-4xl mx-auto">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-indigo-400" />
                    <span>Active Session: <strong className="text-white">{currentUser.name || currentUser.email}</strong></span>
                  </div>
                  <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Ready for Ingestion
                  </span>
                </div>
                <UploadDropzone hideHeader={true} />
              </div>
            ) : (
              /* Unauthenticated Visitor: CTA Card */
              <div className="max-w-3xl mx-auto rounded-2xl border border-slate-800 bg-[#0f1523]/90 p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mx-auto">
                  <ShieldCheck className="h-6 w-6 text-indigo-400" />
                </div>
                <div className="space-y-2 max-w-xl mx-auto">
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Sign in to Start Analysis
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Sign in with your Google account to upload custom multi-service log files or launch the 4-service cascading failure demo incident.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-4 pt-2">
                  <a
                    href={GOOGLE_LOGIN_URL}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold px-7 py-3.5 text-sm shadow-md transition-all cursor-pointer"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign In with Google</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* FOOTER                                                                    */}
      {/* ========================================================================= */}
      <footer className="border-t border-slate-800/80 bg-[#070b12] py-8 text-center text-xs text-slate-500 space-y-2">
        <p className="font-medium text-slate-400">
          LogLens &bull; Format-Agnostic AI Incident Intelligence Platform
        </p>
        <p>
          Built with Next.js 14, Tailwind CSS, FastAPI, Google Gemma 3, Drain3, and HDBSCAN.
        </p>
      </footer>
    </div>
  );
}
