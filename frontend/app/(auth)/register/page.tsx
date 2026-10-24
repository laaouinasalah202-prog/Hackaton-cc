"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
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
  Layers,
  Check,
  Github,
} from "lucide-react";

export default function RegisterPage() {
  const [redirectTarget, setRedirectTarget] = useState("/");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      if (redirect && redirect.startsWith("/")) {
        setRedirectTarget(redirect);
      }
    }
  }, []);

  // Compute password strength
  const getPasswordStrength = () => {
    if (!password) return { score: 0, label: "", color: "bg-slate-700" };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 25, label: "Weak", color: "bg-rose-500" };
    if (score === 2) return { score: 50, label: "Fair", color: "bg-amber-500" };
    if (score === 3) return { score: 75, label: "Good", color: "bg-cyan-500" };
    return { score: 100, label: "Strong", color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name || !email || !password || !confirmPassword) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (!agreeTerms) {
      setErrorMessage("Please agree to the Terms of Service to proceed.");
      return;
    }

    setIsLoading(true);

    try {
      // Simulate client registration
      await new Promise((resolve) => setTimeout(resolve, 600));

      if (typeof window !== "undefined") {
        document.cookie = "loglens_auth=true; path=/; max-age=2592000; SameSite=Lax";
        localStorage.setItem(
          "loglens_user",
          JSON.stringify({
            name,
            email,
            organization: organization || "Independent Engineer",
            registeredAt: new Date().toISOString(),
          })
        );
      }

      setSuccessMessage("Account created successfully! Directing to workspace...");
      setTimeout(() => {
        window.location.href = redirectTarget;
      }, 500);
    } catch {
      setErrorMessage("Registration failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Register Form */}
        <div className="lg:col-span-7">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0f1523]/90 p-7 sm:p-9 shadow-2xl backdrop-blur-xl">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-600" />

            <div className="mb-6 space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Format-Agnostic Log Intelligence</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Create your account
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Join engineering teams pinpointing root causes and microservice cascades in seconds.
              </p>
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
              {/* Name & Org Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Mercer"
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Organization <span className="text-slate-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Layers className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="Acme Cloud Labs"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Work Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Work Email <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Password & Confirm Password Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Password <span className="text-rose-400">*</span>
                  </label>
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

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Confirm Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Password strength meter */}
              {password && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Password strength:</span>
                    <span className="font-semibold text-slate-200">{strength.label}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${strength.color} transition-all duration-300`}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Terms Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-offset-slate-900 cursor-pointer accent-indigo-600"
                  />
                  <span className="text-xs text-slate-400 leading-relaxed">
                    I agree to the{" "}
                    <Link href="/" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                      Privacy Policy
                    </Link>
                    .
                  </span>
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
                    <span>Creating your account...</span>
                  </>
                ) : (
                  <>
                    <span>Create LogLens Account</span>
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
                Or sign up using
              </span>
            </div>

            {/* Social Logins */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setName("GitHub Developer");
                  setEmail("github-dev@loglens.dev");
                  setPassword("GitHubSecToken2026!");
                  setConfirmPassword("GitHubSecToken2026!");
                  setAgreeTerms(true);
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:bg-slate-900 hover:text-white transition-all cursor-pointer"
              >
                <Github className="h-4 w-4 text-slate-300" />
                <span>GitHub</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setName("Google Engineer");
                  setEmail("google-eng@loglens.dev");
                  setPassword("GoogleSecToken2026!");
                  setConfirmPassword("GoogleSecToken2026!");
                  setAgreeTerms(true);
                }}
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

            {/* Switch to Login */}
            <div className="mt-7 text-center text-xs text-slate-400">
              Already have an account?{" "}
              <Link
                href={`/login${redirectTarget !== "/" ? `?redirect=${encodeURIComponent(redirectTarget)}` : ""}`}
                className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Sign in here &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Platform Capability Highlights */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: What is LogLens */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900/90 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                Observability Elevated
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              LogLens strips away the complexity of traditional SIEMs. Drop any log format into our engine and receive instant root cause diagnosis backed by causal graphs.
            </p>

            {/* Microservice checklist */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <div className="rounded-full bg-emerald-500/20 p-1 text-emerald-400">
                  <Check className="h-3 w-3" />
                </div>
                <span>Zero custom regex configuration required</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <div className="rounded-full bg-emerald-500/20 p-1 text-emerald-400">
                  <Check className="h-3 w-3" />
                </div>
                <span>Gemma 3 generative incident reports & prevention steps</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <div className="rounded-full bg-emerald-500/20 p-1 text-emerald-400">
                  <Check className="h-3 w-3" />
                </div>
                <span>Interactive cross-service causality directed graph</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <div className="rounded-full bg-emerald-500/20 p-1 text-emerald-400">
                  <Check className="h-3 w-3" />
                </div>
                <span>Real-time natural language copilot chat</span>
              </div>
            </div>
          </div>

          {/* Card 2: AI Incident Analysis Metric Callout */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold text-white">Production-Ready Reliability</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Designed for multi-cloud and hybrid architectures: analyze incidents spanning databases, microservices, proxies, and async background workers seamlessly.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700">
                JSON Lines
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700">
                Log4j
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700">
                Nginx
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700">
                Python Tracebacks
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
