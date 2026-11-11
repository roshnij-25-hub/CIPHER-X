"use client";

import { Satellite, Cpu, Activity, MapPin, Building2, Layers } from "lucide-react";

const PIPELINE_STEPS = [
  {
    stage: "01 BROAD-AREA",
    label: "Sentinel-2 Multi-Band\nTemporal Ingestion",
    icon: Satellite,
    color: "#22d3ee",
    status: "ready",
    description: "B02, B03, B04, B08 10m/px spectral pairs",
  },
  {
    stage: "01 PREPROCESS",
    label: "Percentile Normalization\n& Registration",
    icon: Cpu,
    color: "#38bdf8",
    status: "ready",
    description: "Multi-temporal radiometric calibration",
  },
  {
    stage: "01 DETECTION",
    label: "Change Vector Analysis\n(CVA Engine)",
    icon: Activity,
    color: "#a855f7",
    status: "active",
    description: "Euclidean spectral distance computation",
  },
  {
    stage: "02 LOCALIZATION",
    label: "Morphological Filtering\n& AOI Extraction",
    icon: MapPin,
    color: "#22c55e",
    status: "ready",
    description: "Connected regions & bounding box extraction",
  },
  {
    stage: "03 EXTENDED",
    label: "Fine-Resolution Ingestion\n(SpaceNet / LISS-4)",
    icon: Building2,
    color: "#f59e0b",
    status: "extended",
    description: "Sub-meter optical imagery ingestion",
  },
  {
    stage: "03 EXTENDED",
    label: "Human Activity Classification\n(Building / Earthwork)",
    icon: Layers,
    color: "#94a3b8",
    status: "extended",
    description: "Structural semantic interpretation",
  },
];

export default function PipelineDiagram() {
  return (
    <div
      className="rounded-2xl border border-cyan-500/20 p-6 overflow-x-auto shadow-2xl backdrop-blur-md"
      style={{ background: "rgba(10,16,30,0.92)" }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">
            End-to-End Coarse-to-Fine Pipeline Architecture
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational CVA coarse detection pipeline and extended fine-resolution integration stage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 tracking-widest">
            STAGE 01 &amp; 02 OPERATIONAL
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 min-w-max mx-auto justify-center py-2">
        {PIPELINE_STEPS.map((step, i) => {
          const IconComponent = step.icon;
          const isExtended = step.status === "extended";
          const isActive = step.status === "active";

          return (
            <div key={i} className="flex items-center gap-3">
              {/* Step Block */}
              <div
                className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border min-w-[130px] transition-all duration-300 ${
                  isExtended
                    ? "border-slate-700/50 bg-slate-900/40 opacity-70"
                    : isActive
                    ? "border-purple-500/50 bg-purple-950/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                    : "border-cyan-500/25 bg-slate-900/70 hover:border-cyan-400/40"
                }`}
              >
                {/* Stage tag */}
                <span className="text-[9px] font-mono font-bold tracking-widest text-slate-500 uppercase">
                  {step.stage}
                </span>

                {/* Extended Pipeline Badge */}
                {isExtended && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 tracking-widest whitespace-nowrap">
                    EXTENDED PIPELINE
                  </span>
                )}

                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center border"
                  style={{
                    backgroundColor: isExtended ? "rgba(30,41,59,0.5)" : `${step.color}15`,
                    borderColor: isExtended ? "rgba(71,85,105,0.4)" : `${step.color}40`,
                    color: isExtended ? "#94a3b8" : step.color,
                  }}
                >
                  <IconComponent size={18} />
                </div>

                <p
                  className="text-[10px] font-semibold text-center leading-tight whitespace-pre-line tracking-wide font-sans"
                  style={{ color: isExtended ? "#94a3b8" : "#f1f5f9" }}
                >
                  {step.label}
                </p>

                <p className="text-[9px] text-slate-500 text-center leading-tight max-w-[110px]">
                  {step.description}
                </p>
              </div>

              {/* Arrow connector */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="flex flex-col items-center">
                  <div
                    className="w-6 h-0.5"
                    style={{
                      background:
                        i < 3
                          ? "linear-gradient(90deg, #22d3ee, #a855f7)"
                          : "linear-gradient(90deg, #475569, #334155)",
                      opacity: i >= 3 ? 0.4 : 1,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-6 justify-center text-[10px] font-mono text-slate-400 border-t border-white/5 pt-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Stage 01: Broad-Area CVA (Operational)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          Stage 02: AOI Extraction (Operational)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          Stage 03: Fine Analysis (Extended Pipeline)
        </span>
      </div>
    </div>
  );
}

