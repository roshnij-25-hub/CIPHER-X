"use client";

import { useEffect, useRef, useState } from "react";
import { UploadCloud, FileImage, CheckCircle, X } from "lucide-react";

interface UploadCardProps {
  label: "Before" | "After";
  onFile: (file: File | null) => void;
  file: File | null;
  accent?: "cyan" | "purple";
}

export default function UploadCard({ label, onFile, file, accent = "cyan" }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accentColor = accent === "cyan" ? "#22d3ee" : "#c084fc";
  const accentGlow = accent === "cyan"
    ? "rgba(34,211,238,0.18)"
    : "rgba(192,132,252,0.18)";
  const borderClass = accent === "cyan"
    ? "border-cyan-500/30 hover:border-cyan-400/60"
    : "border-purple-500/30 hover:border-purple-400/60";
  const glowClass = accent === "cyan"
    ? "shadow-[0_0_20px_rgba(34,211,238,0.08)]"
    : "shadow-[0_0_20px_rgba(168,85,247,0.08)]";
  const badgeClass = accent === "cyan"
    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
    : "bg-purple-500/10 text-purple-400 border-purple-500/30";

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0] ?? null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div
      className={`relative rounded-2xl border-2 transition-all duration-300 cursor-pointer group ${borderClass} ${glowClass} ${dragging ? "scale-[1.02] border-opacity-80" : ""}`}
      style={{
        background: dragging
          ? `linear-gradient(135deg, rgba(14,22,38,0.95), ${accentGlow})`
          : "rgba(10,16,30,0.85)",
      }}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Header Badge */}
      <div className="absolute top-3 left-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border tracking-widest uppercase ${badgeClass}`}>
          {label === "Before" ? "T₁" : "T₂"} {label}
        </span>
      </div>

      {/* Remove button */}
      {file && (
        <button
          className="absolute top-3 right-3 z-10 text-slate-500 hover:text-red-400 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onFile(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          <X size={16} />
        </button>
      )}

      <div className="p-6 pt-12 flex flex-col items-center gap-3 min-h-[180px] justify-center">
        {file ? (
          <>
            <CheckCircle size={36} style={{ color: accentColor }} />
            <div className="text-center">
              <p className="font-semibold text-sm text-slate-100 truncate max-w-[180px]">{file.name}</p>
              <p className="text-xs text-slate-500 mt-1">{formatSize(file.size)}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded border" style={{
              color: accentColor, borderColor: accentColor, background: `${accentGlow}`
            }}>
              Ready
            </span>
          </>
        ) : (
          <>
            {dragging ? (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: accentGlow }}
              >
                <UploadCloud size={26} style={{ color: accentColor }} />
              </div>
            ) : (
              <FileImage size={32} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                {dragging ? "Drop to upload" : "Drag & Drop"}
              </p>
              <p className="text-xs text-slate-600 mt-1">or click to browse</p>
            </div>
            <div className="flex gap-1.5 mt-1 flex-wrap justify-center">
              {["TIFF", "JP2", "PNG", "JPG"].map((ext) => (
                <span key={ext} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-500 font-mono border border-slate-700/50">
                  .{ext.toLowerCase()}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".tif,.tiff,.jp2,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
