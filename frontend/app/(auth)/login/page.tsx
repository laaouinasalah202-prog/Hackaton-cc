"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  Activity,
  Github,
} from "lucide-react";
import { GOOGLE_LOGIN_URL } from "@/lib/api";

export default function LoginPage() {
  const [redirectTarget, setRedirectTarget] = useState("/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      if (redirect && redirect.startsWith("/")) {
        setRedirectTarget(redirect);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setErrorMessage("Email and password login is not enabled. Continue with Google.");
  };

  const fillDemoAccount = () => {
    setEmail("operator@loglens.dev");
    setPassword("EnterpriseLogAI2026!");
    setErrorMessage(null);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSent(true);
    setTimeout(() => {
      setForgotModal(false);
      setForgotSent(false);
      setForgotEmail("");
      setSuccessMessage("Password reset instructions dispatched to your email.");
    }, 1500);
  };

  return (
    <div className="mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Login Card */}
        <div className="lg:col-span-7">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0f1523]/90 p-7 sm:p-9 shadow-2xl backdrop-blur-xl">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-600" />

            <div className="mb-6 space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Security & Observability Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Sign in to <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-300 bg-clip-text text-transparent">LogLens</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Access your cross-service anomaly clusters, Granger causality topology, and Gemma AI incident reports.
              </p>
            </div>

            {/* Quick Demo Fill Banner */}
            <div className="mb-6 flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-950/30 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-indigo-300">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Exploring the platform?</span>
              </div>
              <button
                type="button"
                onClick={fillDemoAccount}
                className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2 cursor-pointer"
              >
                Auto-fill Demo Credentials
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Work Email</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@company.com"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotModal(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-offset-slate-900 cursor-pointer accent-indigo-600"
                  />
                  <span className="text-xs text-slate-400">Remember this device for 30 days</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-cyan-500 active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative bg-[#0f1523] px-3 text-xs uppercase tracking-wider text-slate-500">
                Or authenticate with
              </span>
            </div>

            {/* Social Logins */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setEmail("github-user@loglens.dev");
                  setPassword("github-oauth-token");
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:bg-slate-900 hover:text-white transition-all cursor-pointer"
              >
                <Github className="h-4 w-4 text-slate-300" />
                <span>GitHub</span>
              </button>

              <button
                type="button"
                onClick={() => { window.location.href = GOOGLE_LOGIN_URL; }}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:bg-slate-900 hover:text-white transition-all cursor-pointer"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.8l3.7-2.9c-.2-.7-.4-1.5-.4-2.3z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 17c1.8 3.7 5.6 6.5 10.1 6.5z"
                  />
                </svg>
                <span>Google</span>
              </button>
            </div>

            {/* Switch to Register */}
            <div className="mt-7 text-center text-xs text-slate-400">
              Don&apos;t have an account yet?{" "}
              <Link
                href={`/register${redirectTarget !== "/" ? `?redirect=${encodeURIComponent(redirectTarget)}` : ""}`}
                className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Create an account &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Platform Features & Live Log Simulation */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Live Engine Telemetry Simulation */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900/90 p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-mono font-semibold text-slate-200">
                  Drain3 + Gemma AI Pipeline
                </span>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE
              </span>
            </div>

            {/* Mock log feed */}
            <div className="space-y-2 font-mono text-[11px] text-slate-300 bg-slate-950/80 rounded-xl p-3 border border-slate-800">
              <div className="flex items-start gap-2 text-rose-400">
                <span className="text-slate-500 shrink-0">12:04:19</span>
                <span className="bg-rose-500/20 px-1 rounded text-[9px] font-bold">ERR</span>
                <span className="truncate">postgres: pool saturated (100/100)</span>
              </div>
              <div className="flex items-start gap-2 text-amber-400">
                <span className="text-slate-500 shrink-0">12:04:22</span>
                <span className="bg-amber-500/20 px-1 rounded text-[9px] font-bold">WARN</span>
                <span className="truncate">java-api: connection wait &gt; 5000ms</span>
              </div>
              <div className="flex items-start gap-2 text-rose-400">
                <span className="text-slate-500 shrink-0">12:04:26</span>
                <span className="bg-rose-500/20 px-1 rounded text-[9px] font-bold">504</span>
                <span className="truncate">nginx: gateway upstream timeout</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-cyan-300 text-[10px]">
                <Sparkles className="h-3 w-3 text-cyan-400 shrink-0" />
                <span>Gemma identified root cause: postgres max_connections</span>
              </div>
            </div>
          </div>

          {/* Feature List */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5">
              <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Format-Agnostic Parser</h4>
                <p className="text-[11px] text-slate-400">
                  Drain3 parses arbitrary JSON lines, Log4j, Syslog, or raw unstructured text with zero manual regexes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5">
              <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400 border border-cyan-500/20 shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Precedence & Causality Graph</h4>
                <p className="text-[11px] text-slate-400">
                  Computes directed dependencies and timestamp-burst precedence across microservice layers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0f1523] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Reset Password</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter your work email address and we will dispatch password recovery instructions.
            </p>
            {forgotSent ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Recovery instructions sent! Check your inbox.</span>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="operator@company.com"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotModal(false)}
                    className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:from-indigo-500 hover:to-cyan-500 transition-all"
                  >
                    Send Recovery Email
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
