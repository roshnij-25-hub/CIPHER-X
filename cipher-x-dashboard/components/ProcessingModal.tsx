"use client";

import { CheckCircle2, Loader2, Satellite, Activity } from "lucide-react";

interface StepItem {
  id: string;
  label: string;
  detail: string;
}

const PROCESSING_STEPS: StepItem[] = [
  { id: "before_loaded", label: "Before image loaded", detail: "Spectral bands B02, B03, B04, B08 normalized" },
  { id: "after_loaded", label: "After image loaded", detail: "Temporal alignment & radiometric calibration verified" },
  { id: "temporal_init", label: "Temporal comparison initialized", detail: "Multi-band difference tensor constructed" },
  { id: "cva_calculated", label: "CVA change magnitude calculated", detail: "Euclidean spectral distance vector computed" },
  { id: "threshold_applied", label: "Change threshold applied", detail: "Adaptive 95th-percentile distribution cutoff" },
  { id: "noise_filtered", label: "Noise filtering applied", detail: "Morphological opening, closing & hole filling" },
  { id: "aois_extracted", label: "AOIs extracted", detail: "Connected component labeling & bounding boxes" },
];

interface ProcessingModalProps {
  isOpen: boolean;
  currentStepIndex: number;
  progressPercent: number;
  sceneName?: string;
}

export default function ProcessingModal({
  isOpen,
  currentStepIndex,
  progressPercent,
  sceneName = "Sentinel-2 Temporal Pair",
}: ProcessingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-3xl border border-cyan-500/30 p-6 sm:p-8 shadow-[0_0_50px_rgba(34,211,238,0.15)] relative overflow-hidden"
        style={{ background: "rgba(10, 16, 32, 0.95)" }}
      >
        {/* Glow accent */}
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Activity size={20} className="animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
              CVA Pipeline Execution
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Processing Change Detection
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-xs">{sceneName}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center text-xs font-mono mb-2">
            <span className="text-slate-400">
              {currentStepIndex >= PROCESSING_STEPS.length ? "Finalizing results..." : PROCESSING_STEPS[currentStepIndex]?.label}
            </span>
            <span className="text-cyan-400 font-bold">{Math.min(100, Math.round(progressPercent))}%</span>
          </div>
          <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, progressPercent)}%`,
                background: "linear-gradient(90deg, #06b6d4, #8b5cf6)",
                boxShadow: "0 0 12px rgba(34,211,238,0.5)",
              }}
            />
          </div>
        </div>

        {/* Steps Checklist */}
        <div className="space-y-2.5">
          {PROCESSING_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={step.id}
                className={`p-2.5 rounded-xl border transition-all flex items-center justify-between text-xs ${
                  isCompleted
                    ? "bg-cyan-950/20 border-cyan-500/30 text-slate-200"
                    : isCurrent
                    ? "bg-purple-950/30 border-purple-500/40 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                    : "bg-slate-900/30 border-white/[0.03] text-slate-500"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 size={16} className="text-cyan-400 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 bg-slate-800/50" />
                    )}
                  </div>
                  <div>
                    <span className={`font-mono font-medium block ${isCurrent ? "text-cyan-300 font-bold" : ""}`}>
                      {step.label}
                    </span>
                    <span className="text-[10px] text-slate-500 block">{step.detail}</span>
                  </div>
                </div>

                <span className="font-mono text-[10px] uppercase tracking-wider">
                  {isCompleted ? (
                    <span className="text-emerald-400 font-bold">Done</span>
                  ) : isCurrent ? (
                    <span className="text-purple-400 font-bold">Running</span>
                  ) : (
                    <span className="text-slate-600">Pending</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span className="flex items-center gap-1.5">
            <Satellite size={12} className="text-cyan-400" />
            Active CVA Kernel
          </span>
          <span>Fast Local Execution</span>
        </div>
      </div>
    </div>
  );
}
