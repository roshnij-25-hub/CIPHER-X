"use client";

import { useEffect, useRef, useState } from "react";

interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  icon: React.ReactNode;
  accent: "cyan" | "purple" | "green" | "orange";
  decimals?: number;
  animated?: boolean;
}

const ACCENT_STYLES = {
  cyan: {
    border: "border-cyan-500/25",
    glow: "shadow-[0_0_25px_rgba(34,211,238,0.12)]",
    text: "text-cyan-400",
    bg: "bg-cyan-500/8",
    dot: "#22d3ee",
  },
  purple: {
    border: "border-purple-500/25",
    glow: "shadow-[0_0_25px_rgba(168,85,247,0.12)]",
    text: "text-purple-400",
    bg: "bg-purple-500/8",
    dot: "#c084fc",
  },
  green: {
    border: "border-green-500/25",
    glow: "shadow-[0_0_25px_rgba(34,197,94,0.12)]",
    text: "text-green-400",
    bg: "bg-green-500/8",
    dot: "#4ade80",
  },
  orange: {
    border: "border-orange-500/25",
    glow: "shadow-[0_0_25px_rgba(249,115,22,0.12)]",
    text: "text-orange-400",
    bg: "bg-orange-500/8",
    dot: "#fb923c",
  },
};

export default function MetricCard({
  label,
  value,
  unit = "",
  icon,
  accent,
  decimals = 0,
  animated = true,
}: MetricCardProps) {
  const styles = ACCENT_STYLES[accent];
  const [displayVal, setDisplayVal] = useState<string>("0");
  const hasRun = useRef(false);

  useEffect(() => {
    const isNumeric = typeof value === "number";
    if (!animated || !isNumeric) {
      setDisplayVal(isNumeric ? value.toFixed(decimals) : String(value));
      return;
    }

    const target = value as number;
    const duration = 1200;
    const startTime = performance.now();
    hasRun.current = true;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = target * ease;
      setDisplayVal(current.toFixed(decimals));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [value, animated, decimals]);

  return (
    <div
      className={`relative rounded-2xl border backdrop-blur-md p-5 transition-all duration-300 hover:scale-[1.02] ${styles.border} ${styles.glow}`}
      style={{ background: "rgba(10,16,30,0.9)" }}
    >
      {/* Subtle corner glow */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${styles.dot}, transparent 70%)`,
          transform: "translate(30%, -30%)",
        }}
      />

      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${styles.bg}`}>
        <span style={{ color: styles.dot }}>{icon}</span>
      </div>

      {/* Value */}
      <div className="flex items-end gap-1 mb-1">
        <span className={`text-3xl font-bold font-mono tracking-tight ${styles.text}`}>
          {displayVal}
        </span>
        {unit && (
          <span className={`text-sm font-medium mb-0.5 ${styles.text} opacity-70`}>{unit}</span>
        )}
      </div>

      {/* Label */}
      <p className="text-xs font-medium text-slate-500 tracking-widest uppercase">{label}</p>

      {/* Bottom pulse bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden">
        <div
          className="h-full opacity-50"
          style={{ background: `linear-gradient(90deg, transparent, ${styles.dot}, transparent)` }}
        />
      </div>
    </div>
  );
}
