"use client";

import { AOI } from "@/types";
import { Crosshair, Layers, MapPin } from "lucide-react";

interface AOITableProps {
  aois: AOI[];
  selectedAoiId?: number | null;
  onSelectAoi?: (aoi: AOI | null) => void;
}

export default function AOITable({ aois, selectedAoiId, onSelectAoi }: AOITableProps) {
  const topAOIs = aois.slice(0, 30);

  return (
    <div
      className="rounded-2xl border border-cyan-500/20 overflow-hidden shadow-2xl backdrop-blur-md"
      style={{ background: "rgba(10,16,30,0.92)" }}
    >
      {/* Table header */}
      <div className="px-5 py-4 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair size={15} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Candidate Areas of Interest (AOIs)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Connected components derived from CVA magnitude thresholding (Image pixel coordinates)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider hidden sm:inline">
            Confidence: <span className="text-slate-300">Not estimated</span>
          </span>
          <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 tracking-widest">
            {aois.length} AOIS DETECTED
          </span>
        </div>
      </div>

      {/* Scrollable table body */}
      <div className="overflow-auto max-h-72">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10" style={{ background: "rgba(8,12,24,0.98)" }}>
            <tr className="border-b border-white/10 text-slate-400">
              <th className="text-left px-4 py-2.5 font-mono uppercase tracking-wider font-semibold">AOI ID</th>
              <th className="text-left px-4 py-2.5 font-mono uppercase tracking-wider font-semibold">Changed Pixels</th>
              <th className="text-left px-4 py-2.5 font-mono uppercase tracking-wider font-semibold">Relative Area</th>
              <th className="text-left px-4 py-2.5 font-mono uppercase tracking-wider font-semibold">Center (X, Y)</th>
              <th className="text-left px-4 py-2.5 font-mono uppercase tracking-wider font-semibold">Bounding Box [Xmin, Ymin &rarr; Xmax, Ymax]</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {topAOIs.map((aoi, idx) => {
              const rank = aoi.rank ?? idx + 1;
              const isSelected = selectedAoiId === aoi.id;
              const isMajor = aoi.pixels > 300;
              const isModerate = aoi.pixels > 50;

              return (
                <tr
                  key={aoi.id}
                  onClick={() => onSelectAoi?.(isSelected ? null : aoi)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500/15 border-l-2 border-cyan-400"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono">
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isMajor ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]" : isModerate ? "bg-amber-400" : "bg-cyan-400"
                        }`}
                      />
                      <span className="font-bold text-slate-200">AOI #{rank}</span>
                    </span>
                  </td>

                  <td className="px-4 py-2.5 font-mono">
                    <span className={`font-bold ${isMajor ? "text-red-300" : isModerate ? "text-amber-300" : "text-cyan-300"}`}>
                      {aoi.pixels.toLocaleString()} px
                    </span>
                  </td>

                  <td className="px-4 py-2.5 font-mono text-slate-300">
                    {aoi.relative_area_percent !== undefined
                      ? `${aoi.relative_area_percent.toFixed(3)}%`
                      : `${((aoi.pixels / (256 * 256)) * 100).toFixed(3)}%`}
                  </td>

                  <td className="px-4 py-2.5 font-mono text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-slate-500" />
                      ({aoi.center_x.toFixed(1)}, {aoi.center_y.toFixed(1)})
                    </span>
                  </td>

                  <td className="px-4 py-2.5 font-mono text-slate-400 text-[11px]">
                    [{aoi.x_min}, {aoi.y_min}] &rarr; [{aoi.x_max}, {aoi.y_max}]
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {aois.length === 0 && (
          <div className="py-12 text-center text-slate-500 text-xs">
            <Layers size={24} className="mx-auto mb-2 opacity-40 text-slate-400" />
            No candidate AOIs detected above threshold in this scene.
          </div>
        )}
      </div>

      <div className="px-5 py-2.5 bg-[#070b16] border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <span>Click any AOI row to highlight or inspect region parameters</span>
        <span className="font-mono text-slate-400">Total detected change pixels: {aois.reduce((sum, a) => sum + a.pixels, 0).toLocaleString()} px</span>
      </div>
    </div>
  );
}

