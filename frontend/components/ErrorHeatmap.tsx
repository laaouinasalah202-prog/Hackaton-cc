"use client";

import { TimelineBucket } from "@/lib/types";
import { Grid, Flame } from "lucide-react";

interface Props {
  timeline: TimelineBucket[];
  services: string[];
  onSelectService?: (service: string | null) => void;
  selectedService?: string | null;
}

export function ErrorHeatmap({ timeline, services, onSelectService, selectedService }: Props) {
  if (!timeline || timeline.length === 0 || !services || services.length === 0) {
    return null;
  }

  // Find maximum errors for scaling intensity
  let maxErrors = 1;
  services.forEach((svc) => {
    timeline.forEach((bucket) => {
      // Calculate error count for this service
      const svcErrors = bucket.by_service[svc]
        ? Math.round(bucket.error_count * (bucket.by_service[svc] / Math.max(1, bucket.total)))
        : 0;
      if (svcErrors > maxErrors) maxErrors = svcErrors;
    });
  });

  const getIntensityColor = (count: number) => {
    if (count === 0) return "bg-slate-800/40 hover:bg-slate-700/60";
    const ratio = count / maxErrors;
    if (ratio < 0.2) return "bg-amber-950/60 border border-amber-800/40 text-amber-300";
    if (ratio < 0.5) return "bg-amber-600/70 text-white";
    if (ratio < 0.8) return "bg-rose-600/80 text-white";
    return "bg-rose-500 text-white font-bold animate-pulse";
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Grid className="h-4 w-4 text-rose-400" />
            Service Error Density Heatmap
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized service fault intensity over chronological time windows.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>0 err</span>
          <span className="h-2.5 w-4 rounded-sm bg-slate-800 border border-slate-700/60" />
          <span className="h-2.5 w-4 rounded-sm bg-amber-900" />
          <span className="h-2.5 w-4 rounded-sm bg-amber-600" />
          <span className="h-2.5 w-4 rounded-sm bg-rose-600" />
          <span className="h-2.5 w-4 rounded-sm bg-rose-500" />
          <span>High err</span>
        </div>
      </div>

      <div className="space-y-2 overflow-x-auto pb-2">
        {services.map((svc) => {
          const isSelected = selectedService === svc;
          return (
            <div
              key={svc}
              className={`flex items-center gap-3 transition-opacity ${
                selectedService && !isSelected ? "opacity-30" : "opacity-100"
              }`}
            >
              <button
                onClick={() => onSelectService && onSelectService(isSelected ? null : svc)}
                className="w-28 shrink-0 truncate text-left text-xs font-mono font-medium text-slate-300 hover:text-indigo-400"
                title={svc}
              >
                {svc}
              </button>

              <div className="flex flex-1 gap-1">
                {timeline.map((bucket, idx) => {
                  const svcTotal = bucket.by_service[svc] || 0;
                  const estimatedErrors = svcTotal > 0
                    ? Math.round(bucket.error_count * (svcTotal / Math.max(1, bucket.total)))
                    : 0;

                  const timeStr = new Date(bucket.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <div
                      key={idx}
                      title={`${svc} @ ${timeStr}: ${estimatedErrors} error(s), ${svcTotal} total logs`}
                      className={`h-7 flex-1 min-w-[12px] rounded-sm transition-all cursor-pointer flex items-center justify-center text-[9px] ${getIntensityColor(
                        estimatedErrors
                      )}`}
                    >
                      {estimatedErrors > 0 && timeline.length <= 25 ? estimatedErrors : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
