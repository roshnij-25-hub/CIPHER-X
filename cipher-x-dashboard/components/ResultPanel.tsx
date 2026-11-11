"use client";

import { useState } from "react";
import Image from "next/image";

interface ResultPanelProps {
  title: string;
  subtitle?: string;
  imageSrc?: string; // base64 data URI or URL
  accent: "cyan" | "purple" | "green";
  badge?: string;
  children?: React.ReactNode;
}

const ACCENT_MAP = {
  cyan: { border: "border-cyan-500/25", title: "text-cyan-400", badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  purple: { border: "border-purple-500/25", title: "text-purple-400", badge: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  green: { border: "border-green-500/25", title: "text-green-400", badge: "bg-green-500/10 text-green-400 border-green-500/30" },
};

export default function ResultPanel({
  title,
  subtitle,
  imageSrc,
  accent,
  badge,
  children,
}: ResultPanelProps) {
  const styles = ACCENT_MAP[accent];
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`rounded-2xl border backdrop-blur-md overflow-hidden transition-all duration-300 hover:scale-[1.01] group ${styles.border}`}
      style={{ background: "rgba(10,16,30,0.90)" }}
    >
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-semibold tracking-wide ${styles.title}`}>{title}</h3>
          {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border tracking-widest uppercase ${styles.badge}`}>
            {badge}
          </span>
        )}
      </div>

      {/* Image area */}
      {imageSrc && !imgError ? (
        <div className="relative w-full aspect-square overflow-hidden bg-[#0a1020]">
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-cyan-500/40 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={title}
            className={`w-full h-full object-contain transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-5"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,211,238,0.15) 2px, rgba(34,211,238,0.15) 4px)",
            }}
          />
        </div>
      ) : imageSrc === undefined && children ? null : (
        !imageSrc ? (
          <div className="w-full aspect-square bg-[#0a1020] flex items-center justify-center">
            <div className="text-center text-slate-600">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-center text-slate-500">
                <span className="text-xs font-mono">N/A</span>
              </div>
              <p className="text-xs font-mono">No raster data</p>
            </div>
          </div>
        ) : (
          <div className="w-full aspect-square bg-[#0a1020] flex items-center justify-center">
            <p className="text-xs text-red-400 font-mono">Failed to load raster image</p>
          </div>
        )
      )}

      {/* Optional child content or Heatmap legend */}
      {(title.toLowerCase().includes("heatmap") || badge === "Inferno") && (
        <div className="px-3 py-2 bg-[#060a14] border-t border-white/5 flex flex-col gap-1 text-[10px]">
          <div className="flex justify-between font-mono text-slate-400 font-semibold tracking-wider">
            <span>LOW CHANGE</span>
            <span>HIGH CHANGE</span>
          </div>
          <div
            className="h-2 rounded-full w-full border border-white/10"
            style={{
              background: "linear-gradient(90deg, #000004, #3b0f70, #8c2981, #de4968, #fe9f6d, #fcfdbf)",
            }}
          />
        </div>
      )}
      {children && <div className="p-4">{children}</div>}
    </div>
  );
}
