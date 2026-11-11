"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import HeroBackground from "@/components/HeroBackground";
import UploadCard from "@/components/UploadCard";
import MetricCard from "@/components/MetricCard";
import ResultPanel from "@/components/ResultPanel";
import AOITable from "@/components/AOITable";
import PipelineDiagram from "@/components/PipelineDiagram";
import FineResolutionSection, { HighResResult } from "@/components/HighResSection";
import ProcessingModal from "@/components/ProcessingModal";
import { DetectionResult, SampleScene, SamplePreview, AOI } from "@/types";
import {
  Satellite,
  Zap,
  AlertCircle,
  Loader2,
  BarChart3,
  Layers,
  ArrowRight,
  Sliders,
  Download,
  Eye,
  Crosshair,
  Search,
  FileText,
  Compass,
  ZoomIn,
  ZoomOut,
  Navigation,
  ChevronRight,
  Check,
  Info
} from "lucide-react";

// Dynamically import LeafletMap with SSR disabled
const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[360px] rounded-2xl bg-[#0a1020] border border-cyan-500/20 flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-2">
      <Loader2 size={24} className="animate-spin text-cyan-400" />
      <span>Loading Global Geospatial Intelligence Map...</span>
    </div>
  ),
});

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type NavigationSection = "home" | "cva" | "spacenet" | "reports";

export default function CIPHERXApp() {
  // Navigation State — MUST START ON HOME FIRST
  const [activeSection, setActiveSection] = useState<NavigationSection>("home");

  // Geospatial Search State (Home)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  // ----------------------------------------------------
  // CVA CHANGE DETECTION STATE (Preserved across views)
  // ----------------------------------------------------
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [percentile, setPercentile] = useState<number>(95);
  
  // OSCD Dataset Scene State
  const [useDemoScene, setUseDemoScene] = useState<boolean>(true);
  const [scenes, setScenes] = useState<SampleScene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("train_000");
  const [scenePreview, setScenePreview] = useState<SamplePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Processing & Results State
  const [processing, setProcessing] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [cvaResult, setCvaResult] = useState<DetectionResult | null>(null);
  const [cvaError, setCvaError] = useState<string | null>(null);
  const [selectedAoi, setSelectedAoi] = useState<AOI | null>(null);

  // ----------------------------------------------------
  // SPACENET / FINE RESOLUTION STATE (Shared for Reports)
  // ----------------------------------------------------
  const [fineResult, setFineResult] = useState<HighResResult | null>(null);

  const cvaWorkspaceRef = useRef<HTMLDivElement>(null);
  const cvaResultsRef = useRef<HTMLDivElement>(null);

  // Fetch available OSCD dataset scenes from backend
  const fetchScenes = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/samples`);
      if (res.ok) {
        const data = await res.json();
        if (data.samples && data.samples.length > 0) {
          setScenes(data.samples);
        }
      }
    } catch {
      // Backend loading
    }
  }, []);

  // Fetch quick preview for a selected scene
  const fetchScenePreview = useCallback(async (sceneId: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/sample/${sceneId}/preview`);
      if (res.ok) {
        const data: SamplePreview = await res.json();
        setScenePreview(data);
      }
    } catch {
      // Preview failed
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchScenes();
    fetchScenePreview("train_000");
  }, [fetchScenes, fetchScenePreview]);

  // When scene selection changes
  const handleSceneChange = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    fetchScenePreview(sceneId);
  };

  // Run the step-by-step progress animation
  const animateProcessing = () => {
    setCurrentStepIndex(0);
    setProgressPercent(10);
    setProcessing(true);

    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        const next = prev + 1;
        setProgressPercent(Math.min(95, Math.round((next / 7) * 100)));
        if (next >= 6) {
          clearInterval(stepInterval);
        }
        return next;
      });
    }, 450);

    return stepInterval;
  };

  // Execute CVA Detection (Custom uploads or Demo scene)
  const handleRunDetection = async () => {
    setCvaError(null);
    const progressTimer = animateProcessing();

    try {
      let res: Response;

      if (useDemoScene) {
        // Run on the selected real OSCD scene
        res = await fetch(
          `${BACKEND_URL}/detect/sample/${selectedSceneId}?percentile=${percentile}`,
          { method: "POST" }
        );
      } else {
        // Run on uploaded files
        if (!beforeFile || !afterFile) {
          clearInterval(progressTimer);
          setProcessing(false);
          setCvaError("Please upload both Before and After image raster files.");
          return;
        }

        const fd = new FormData();
        fd.append("before_image", beforeFile);
        fd.append("after_image", afterFile);

        res = await fetch(`${BACKEND_URL}/detect?percentile=${percentile}`, {
          method: "POST",
          body: fd,
        });
      }

      clearInterval(progressTimer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}: Backend computation failed`);
      }

      const data: DetectionResult = await res.json();
      setCurrentStepIndex(7);
      setProgressPercent(100);

      setTimeout(() => {
        setCvaResult(data);
        setSelectedAoi(null);
        setProcessing(false);
        setTimeout(() => {
          cvaResultsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }, 500);

    } catch (e: unknown) {
      clearInterval(progressTimer);
      setProcessing(false);
      const msg = e instanceof Error ? e.message : "Unknown pipeline error";
      setCvaError(`Change Detection failed: ${msg}. Ensure FastAPI backend is running.`);
    }
  };

  // Download CVA JSON Report
  const handleDownloadCVAJSON = () => {
    if (!cvaResult) return;
    const blob = new Blob([JSON.stringify(cvaResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CIPHER-X_CVA_${selectedSceneId || "change"}_report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Geospatial search handler on Home
  const handleLocationSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchStatus(`Target locked on "${searchQuery.trim()}". Candidate imagery frames referenced.`);
    setTimeout(() => setSearchStatus(null), 5000);
  };

  return (
    <div className="relative min-h-screen bg-[#060913] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 flex">
      {/* Background Animated Canvas */}
      <HeroBackground />

      {/* Global Noise Texture Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "100px",
        }}
      />

      {/* Processing Modal Overlay */}
      <ProcessingModal
        isOpen={processing}
        currentStepIndex={currentStepIndex}
        progressPercent={progressPercent}
        sceneName={useDemoScene ? `OSCD Scene: ${selectedSceneId}` : `${beforeFile?.name} vs ${afterFile?.name}`}
      />

      {/* ========================================================================= */}
      {/* FIXED LEFT SIDEBAR NAVIGATION                                             */}
      {/* ========================================================================= */}
      <aside className="fixed top-0 left-0 bottom-0 w-64 md:w-72 bg-[#090D1A]/95 border-r border-cyan-500/20 backdrop-blur-2xl z-40 flex flex-col justify-between p-5 shadow-2xl">
        
        {/* Branding & Subtitle */}
        <div>
          <div className="flex items-center gap-3 pb-5 border-b border-white/10">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30 transition-transform hover:scale-105 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)" }}
            >
              <Satellite size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-black text-white tracking-tight text-xl leading-none">
                CIPHER<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">-X</span>
              </h1>
              <p className="text-[10px] font-mono text-cyan-400/90 tracking-wider uppercase mt-1">
                Coarse-to-Fine Satellite Change Intelligence
              </p>
            </div>
          </div>

          {/* System Status Pill */}
          <div className="mt-4 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>CVA Kernel Active</span>
            </div>
            <span className="text-slate-500 text-[10px]">v2.4 PRO</span>
          </div>

          {/* SIDEBAR NAVIGATION ITEMS */}
          <nav className="mt-6 space-y-2 font-mono">
            
            {/* 1. HOME */}
            <button
              onClick={() => setActiveSection("home")}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left group ${
                activeSection === "home"
                  ? "bg-gradient-to-r from-cyan-500/25 via-teal-500/15 to-purple-500/10 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">🏠</span>
                <span className="tracking-wide">HOME</span>
              </div>
              <ChevronRight
                size={14}
                className={`transition-transform ${
                  activeSection === "home" ? "translate-x-0 text-cyan-400 opacity-100" : "opacity-0 group-hover:opacity-60"
                }`}
              />
            </button>

            {/* 2. CVA CHANGE DETECTION */}
            <button
              onClick={() => setActiveSection("cva")}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left group ${
                activeSection === "cva"
                  ? "bg-gradient-to-r from-cyan-500/25 via-teal-500/15 to-purple-500/10 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">🛰️</span>
                <span className="tracking-wide">CVA CHANGE DETECTION</span>
              </div>
              {cvaResult && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              )}
            </button>

            {/* 3. SPACENET / FINE ANALYSIS */}
            <button
              onClick={() => setActiveSection("spacenet")}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left group ${
                activeSection === "spacenet"
                  ? "bg-gradient-to-r from-cyan-500/25 via-teal-500/15 to-purple-500/10 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">🔍</span>
                <span className="tracking-wide">SPACENET / FINE ANALYSIS</span>
              </div>
              {fineResult && (
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
              )}
            </button>

            {/* 4. REPORTS */}
            <button
              onClick={() => setActiveSection("reports")}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left group ${
                activeSection === "reports"
                  ? "bg-gradient-to-r from-cyan-500/25 via-teal-500/15 to-purple-500/10 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">📊</span>
                <span className="tracking-wide">REPORTS</span>
              </div>
              <ChevronRight
                size={14}
                className={`transition-transform ${
                  activeSection === "reports" ? "translate-x-0 text-cyan-400 opacity-100" : "opacity-0 group-hover:opacity-60"
                }`}
              />
            </button>

          </nav>
        </div>

        {/* Sidebar Footer: Architecture Provenance */}
        <div className="pt-4 border-t border-white/10 text-[11px] font-mono text-slate-500 space-y-2">
          <div className="flex items-center justify-between">
            <span>Sensor Mode</span>
            <span className="text-cyan-400 font-bold">Sentinel-2 (10m)</span>
          </div>
          <div className="flex items-center justify-between">
            <span>High-Res Stage</span>
            <span className="text-amber-400 font-bold">SpaceNet / LEVIR</span>
          </div>
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[10px] text-slate-400 leading-snug">
            Deterministic physical CVA pipeline &middot; Non-synthetic metrics
          </div>
        </div>

      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT WORKSPACE (RIGHT OF SIDEBAR)                                 */}
      {/* ========================================================================= */}
      <div className="flex-1 ml-64 md:ml-72 min-h-screen relative z-10 flex flex-col">
        
        {/* Top Mini Header Bar */}
        <header className="sticky top-0 z-30 border-b border-white/10 backdrop-blur-xl bg-[#060913]/85 px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="text-cyan-400 font-bold">CIPHER-X</span>
            <span>/</span>
            <span className="text-white uppercase font-bold tracking-wider">
              {activeSection === "home" && "Geospatial Mission Control"}
              {activeSection === "cva" && "Coarse Change Detection (Sentinel-2)"}
              {activeSection === "spacenet" && "Fine-Resolution Investigation (SpaceNet)"}
              {activeSection === "reports" && "Change Intelligence Reports"}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            {cvaResult && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                <Check size={12} className="text-cyan-400" />
                <span>CVA: {cvaResult.changed_pixels} px changed</span>
              </span>
            )}
            <div className="text-[11px] text-slate-400 font-mono">
              <span className="text-slate-600">Observation Mode:</span> Active
            </div>
          </div>
        </header>

        {/* Main Dynamic View Area */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          
          {/* ===================================================================== */}
          {/* SECTION 1: HOME (FIRST SCREEN ON LOAD)                                */}
          {/* ===================================================================== */}
          {activeSection === "home" && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Home Header & Branding */}
              <div className="text-center max-w-3xl mx-auto pt-4 pb-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-mono font-semibold tracking-widest uppercase mb-4 shadow-lg shadow-cyan-500/10">
                  <Satellite size={14} className="text-cyan-400" />
                  <span>Sentinel-2 Earth Observation &middot; Physical Change Intelligence</span>
                </div>

                <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-2">
                  CIPHER<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400">‑X</span>
                </h1>

                <h2 className="text-lg sm:text-xl font-bold text-slate-200 mb-3 tracking-tight">
                  Coarse-to-Fine Satellite Change Intelligence
                </h2>

                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal max-w-2xl mx-auto">
                  Detect broad-area temporal change using Sentinel-2 and investigate candidate regions using higher-resolution imagery.
                </p>
              </div>

              {/* SEARCH LOCATION & MAP CONTROLS BAR */}
              <div className="p-5 rounded-3xl border border-cyan-500/30 bg-[#0a1020]/95 backdrop-blur-xl shadow-2xl space-y-4">
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  
                  {/* Search Bar Form */}
                  <form onSubmit={handleLocationSearch} className="flex items-center gap-2 flex-1 max-w-xl">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search place or coordinates (e.g. 48.8566, 2.3522 or Paris, France)"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-400 transition-all shadow-inner"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white text-xs font-mono font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Search size={13} />
                      <span>SEARCH</span>
                    </button>
                  </form>

                  {/* Map Quick Controls */}
                  <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest hidden md:inline">Map Controls:</span>
                    <button
                      onClick={() => setSearchStatus("Zoomed in on geospatial reference frame.")}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all"
                      title="Zoom In"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      onClick={() => setSearchStatus("Zoomed out to global monitoring overview.")}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all"
                      title="Zoom Out"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <button
                      onClick={() => setSearchStatus("Recentered coordinate grid to active Sentinel-2 scenes.")}
                      className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-cyan-300 hover:text-white transition-all flex items-center gap-1 text-[11px]"
                      title="Locate / Zoom"
                    >
                      <Navigation size={12} className="text-cyan-400" />
                      <span>Locate / Zoom</span>
                    </button>
                  </div>

                </div>

                {searchStatus && (
                  <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-2">
                    <Info size={14} className="text-cyan-400 flex-shrink-0" />
                    <span>{searchStatus}</span>
                  </div>
                )}

                {/* Satellite Geospatial Map Visualization */}
                <div className="relative rounded-2xl overflow-hidden border border-cyan-500/20">
                  <LeafletMap />
                  
                  {/* Overlay Prompt */}
                  <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
                    <div className="bg-[#090e1ecc]/90 backdrop-blur-md border border-cyan-500/30 rounded-xl px-4 py-2.5 text-center text-xs font-mono text-cyan-300 shadow-xl max-w-lg mx-auto pointer-events-auto flex items-center justify-center gap-2">
                      <Compass size={14} className="text-cyan-400 animate-spin" />
                      <span>Select a location to begin change investigation</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* QUICK LAUNCH WORKFLOW ACTION CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Launch Card 1: CVA */}
                <div
                  onClick={() => setActiveSection("cva")}
                  className="p-6 rounded-3xl border border-cyan-500/30 bg-[#0a1020]/90 backdrop-blur-md hover:border-cyan-400/60 transition-all cursor-pointer group shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono font-bold px-3 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        STAGE 01 &middot; COARSE DETECTION
                      </span>
                      <span className="text-base">🛰️</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 tracking-tight group-hover:text-cyan-300 transition-colors">
                      Coarse Change Detection (Sentinel-2)
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      Compute Euclidean spectral vector distance across multi-spectral bitemporal bands (B02, B03, B04, B08) at 10m resolution and extract candidate AOIs.
                    </p>
                  </div>
                  <button className="w-full py-3 rounded-xl font-bold text-xs font-mono bg-gradient-to-r from-cyan-500 to-teal-600 text-white group-hover:from-cyan-400 group-hover:to-teal-500 transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2">
                    <span>LAUNCH CVA CHANGE DETECTION</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                {/* Launch Card 2: SpaceNet */}
                <div
                  onClick={() => setActiveSection("spacenet")}
                  className="p-6 rounded-3xl border border-purple-500/30 bg-[#0a1020]/90 backdrop-blur-md hover:border-purple-400/60 transition-all cursor-pointer group shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono font-bold px-3 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
                        STAGE 02 &middot; FINE INVESTIGATION
                      </span>
                      <span className="text-base">🔍</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 tracking-tight group-hover:text-purple-300 transition-colors">
                      SpaceNet / Fine-Resolution Analysis
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      Investigate candidate change regions using sub-meter high-resolution optical imagery and deep learning building footprint segmentation.
                    </p>
                  </div>
                  <button className="w-full py-3 rounded-xl font-bold text-xs font-mono bg-gradient-to-r from-purple-600 to-indigo-600 text-white group-hover:from-purple-500 group-hover:to-indigo-500 transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2">
                    <span>LAUNCH FINE ANALYSIS</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

              </div>

              {/* Conceptual Pipeline Diagram */}
              <div className="pt-2">
                <PipelineDiagram />
              </div>

            </div>
          )}

          {/* ===================================================================== */}
          {/* SECTION 2: CVA CHANGE DETECTION (COARSE SENTINEL-2 ANALYSIS)          */}
          {/* ===================================================================== */}
          {activeSection === "cva" && (
            <div ref={cvaWorkspaceRef} className="space-y-8 animate-fadeIn">
              
              {/* Section Header */}
              <div className="border-b border-white/10 pb-6">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">🛰️</span>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase tracking-widest">
                    STAGE 01 &middot; SENTINEL-2
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Coarse Change Detection
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Sentinel-2 temporal change analysis
                </p>
              </div>

              {/* Input Mode Selector */}
              <div className="p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 inline-flex items-center gap-2 font-mono">
                <button
                  onClick={() => setUseDemoScene(true)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    useDemoScene
                      ? "bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Satellite size={14} />
                  <span>Choose Dataset Image (OSCD)</span>
                </button>
                <button
                  onClick={() => setUseDemoScene(false)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    !useDemoScene
                      ? "bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <UploadCard label="Before" onFile={() => {}} file={null} accent="cyan" />
                  <span>Upload From Computer</span>
                </button>
              </div>

              {/* MODE A: DATASET SCENE SELECTOR */}
              {useDemoScene && (
                <div className="p-6 rounded-3xl border border-cyan-500/30 bg-[#0a1020]/95 backdrop-blur-xl shadow-2xl space-y-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <Satellite size={16} className="text-cyan-400" />
                        <h3 className="text-base font-bold text-white">OSCD Sentinel-2 Dataset Scene</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Select a pre-aligned bitemporal Sentinel-2 scene from the real OSCD benchmark dataset.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <select
                        value={selectedSceneId}
                        onChange={(e) => handleSceneChange(e.target.value)}
                        className="w-full md:w-80 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 text-xs font-mono font-bold focus:outline-none focus:border-cyan-400 cursor-pointer shadow-inner"
                      >
                        {scenes.length > 0 ? (
                          scenes.map((s) => (
                            <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                              {s.name}
                            </option>
                          ))
                        ) : (
                          <option value="train_000">train_000 (20150801 -&gt; 20170801)</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Selected Scene Previews: BEFORE IMAGE & AFTER IMAGE */}
                  {scenePreview && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      {/* BEFORE IMAGE */}
                      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                        <div className="flex items-center justify-between mb-3 text-xs font-mono">
                          <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            BEFORE IMAGE: {scenePreview.date_1}
                          </span>
                          <span className="text-slate-500">T₁ (4 Bands)</span>
                        </div>
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center">
                          {previewLoading ? (
                            <Loader2 size={24} className="animate-spin text-cyan-400" />
                          ) : scenePreview.before_preview ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={scenePreview.before_preview}
                              alt="Before preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-slate-500 font-mono">Loading raster preview...</span>
                          )}
                        </div>
                        <div className="mt-2 text-[11px] font-mono text-slate-400 flex justify-between">
                          <span>Bands: B02, B03, B04, B08</span>
                          <span>{scenePreview.dimensions[0]} &times; {scenePreview.dimensions[1]} px</span>
                        </div>
                      </div>

                      {/* AFTER IMAGE */}
                      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                        <div className="flex items-center justify-between mb-3 text-xs font-mono">
                          <span className="text-purple-400 font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-400" />
                            AFTER IMAGE: {scenePreview.date_2}
                          </span>
                          <span className="text-slate-500">T₂ (4 Bands)</span>
                        </div>
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center">
                          {previewLoading ? (
                            <Loader2 size={24} className="animate-spin text-purple-400" />
                          ) : scenePreview.after_preview ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={scenePreview.after_preview}
                              alt="After preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-slate-500 font-mono">Loading raster preview...</span>
                          )}
                        </div>
                        <div className="mt-2 text-[11px] font-mono text-slate-400 flex justify-between">
                          <span>Bands: B02, B03, B04, B08</span>
                          <span>{scenePreview.dimensions[0]} &times; {scenePreview.dimensions[1]} px</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODE B: UPLOAD CUSTOM FILES */}
              {!useDemoScene && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <UploadCard
                      label="Before"
                      onFile={setBeforeFile}
                      file={beforeFile}
                      accent="cyan"
                    />
                    <UploadCard
                      label="After"
                      onFile={setAfterFile}
                      file={afterFile}
                      accent="purple"
                    />
                  </div>

                  {(beforeFile || afterFile) && (
                    <div className="p-4 rounded-2xl bg-[#0a1020] border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs font-mono text-slate-300 gap-2">
                      <div>
                        <span>Selected: </span>
                        <span className="text-cyan-300 font-bold">{beforeFile ? beforeFile.name : "None"}</span>
                        <span className="text-slate-500 mx-2">&rarr;</span>
                        <span className="text-purple-300 font-bold">{afterFile ? afterFile.name : "None"}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Ready for CVA Euclidean distance computation</span>
                    </div>
                  )}
                </div>
              )}

              {/* CVA Threshold Sensitivity Slider */}
              <div className="p-5 rounded-2xl border border-white/5 bg-[#0a1020]/90 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders size={14} className="text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      CVA Change Cutoff Percentile Threshold
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Controls adaptive percentile cutoff on the smoothed spectral magnitude surface.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input
                    type="range"
                    min="80"
                    max="99"
                    step="1"
                    value={percentile}
                    onChange={(e) => setPercentile(Number(e.target.value))}
                    className="w-full sm:w-44 accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 min-w-[56px] text-center">
                    {percentile}th %
                  </span>
                </div>
              </div>

              {/* Error banner */}
              {cvaError && (
                <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-200 leading-relaxed font-mono">{cvaError}</p>
                </div>
              )}

              {/* RUN CHANGE ANALYSIS PRIMARY BUTTON */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button
                  onClick={handleRunDetection}
                  disabled={processing || (!useDemoScene && (!beforeFile || !afterFile))}
                  className="w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-sm tracking-wider uppercase bg-gradient-to-r from-cyan-500 via-teal-500 to-purple-600 text-white hover:from-cyan-400 hover:to-purple-500 transition-all shadow-[0_0_40px_rgba(34,211,238,0.35)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 group font-mono"
                >
                  {processing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>EXECUTING CVA PIPELINE...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={18} className="text-cyan-200 group-hover:scale-110 transition-transform" />
                      <span>RUN CHANGE ANALYSIS</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              {/* ================================================================= */}
              {/* CVA RESULTS SECTION (Four-Panel Layout & Real Metrics)             */}
              {/* ================================================================= */}
              {cvaResult && (
                <div ref={cvaResultsRef} className="space-y-8 pt-8 border-t border-white/10">
                  
                  {/* Results Header */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">
                          CVA ANALYSIS COMPLETE &middot; FOUR-PANEL VISUALIZATION
                        </span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Spectral Change Intelligence
                      </h3>
                      <p className="text-xs font-mono text-slate-400 mt-1">
                        Observation: <span className="text-cyan-300 font-semibold">{cvaResult.dates[0]}</span> &rarr; <span className="text-purple-300 font-semibold">{cvaResult.dates[1]}</span> &middot; Cutoff: <span className="text-amber-300 font-semibold">{cvaResult.threshold} ({percentile}th percentile)</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleDownloadCVAJSON}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-400 hover:to-teal-400 transition-all text-xs font-mono font-bold flex items-center gap-2 shadow-md shadow-cyan-500/20"
                      >
                        <Download size={14} />
                        <span>DOWNLOAD CVA REPORT</span>
                      </button>
                      <button
                        onClick={() => setActiveSection("spacenet")}
                        className="px-4 py-2.5 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-all text-xs font-mono font-bold flex items-center gap-2"
                      >
                        <span>INVESTIGATE IN SPACENET</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* FOUR-PANEL SYNCHRONIZED COMPARISON */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye size={16} className="text-cyan-400" />
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                          Four-Panel Synchronized Change Visuals
                        </h4>
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        Dimensions: {cvaResult.image_size ? `${cvaResult.image_size[0]} &times; ${cvaResult.image_size[1]} px` : "256 &times; 256 px"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* 1. BEFORE */}
                      <ResultPanel
                        title="BEFORE"
                        subtitle={`Sentinel-2 T₁ &middot; ${cvaResult.dates[0]}`}
                        imageSrc={cvaResult.panel_images?.before}
                        accent="cyan"
                        badge="T₁ Before"
                      />

                      {/* 2. AFTER */}
                      <ResultPanel
                        title="AFTER"
                        subtitle={`Sentinel-2 T₂ &middot; ${cvaResult.dates[1]}`}
                        imageSrc={cvaResult.panel_images?.after}
                        accent="purple"
                        badge="T₂ After"
                      />

                      {/* 3. CVA CHANGE MAP */}
                      <ResultPanel
                        title="CVA CHANGE MAP"
                        subtitle="Spectral distance surface"
                        imageSrc={cvaResult.panel_images?.cva_heatmap}
                        accent="purple"
                        badge="Inferno Heatmap"
                      />

                      {/* 4. CHANGE MASK / AOI */}
                      <ResultPanel
                        title="CHANGE MASK / AOI"
                        subtitle={`${cvaResult.aoi_count} regions localized`}
                        imageSrc={cvaResult.panel_images?.aoi_overlay}
                        accent="green"
                        badge={`${cvaResult.changed_area_percent}% Changed`}
                      />
                    </div>
                  </div>

                  {/* REAL METRICS ROW */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      label="Changed Pixels"
                      value={cvaResult.changed_pixels}
                      unit="px"
                      decimals={0}
                      icon={<Layers size={18} />}
                      accent="purple"
                    />
                    <MetricCard
                      label="Changed Area"
                      value={cvaResult.changed_area_percent}
                      unit="%"
                      decimals={2}
                      icon={<BarChart3 size={18} />}
                      accent="green"
                    />
                    <MetricCard
                      label="AOIs Detected"
                      value={cvaResult.aoi_count}
                      decimals={0}
                      icon={<Crosshair size={18} />}
                      accent="cyan"
                    />
                    <MetricCard
                      label="CVA Threshold"
                      value={cvaResult.threshold}
                      decimals={4}
                      icon={<Zap size={18} />}
                      accent="orange"
                    />
                  </div>

                  {/* AOI Bounding Box Table */}
                  <div className="space-y-4">
                    <AOITable
                      aois={cvaResult.aois}
                      selectedAoiId={selectedAoi?.id}
                      onSelectAoi={setSelectedAoi}
                    />
                  </div>

                  {/* Bottom Action: Download & Proceed */}
                  <div className="p-6 rounded-3xl border border-cyan-500/30 bg-[#0a1020]/90 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
                        CVA Analysis Finished
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Download the report or continue directly to the fine-resolution stage.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={handleDownloadCVAJSON}
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold text-xs font-mono flex items-center gap-2 hover:from-cyan-400 hover:to-teal-400 transition-all shadow-lg shadow-cyan-500/20"
                      >
                        <Download size={14} />
                        <span>DOWNLOAD CVA REPORT</span>
                      </button>
                      <button
                        onClick={() => setActiveSection("spacenet")}
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs font-mono flex items-center gap-2 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-500/20"
                      >
                        <span>PROCEED TO FINE ANALYSIS</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* ===================================================================== */}
          {/* SECTION 3: SPACENET / FINE-RESOLUTION ANALYSIS                        */}
          {/* ===================================================================== */}
          {activeSection === "spacenet" && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Section Header */}
              <div className="border-b border-white/10 pb-6">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">🔍</span>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-widest">
                    STAGE 02 &middot; HIGH-RESOLUTION
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Fine-Resolution Investigation
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Investigate detected changes using higher-resolution imagery.
                </p>
              </div>

              {/* Reusable Fine-Resolution Stage Component */}
              <FineResolutionSection
                aois={cvaResult?.aois || []}
                changedPixels={cvaResult?.changed_pixels}
                changedAreaPercent={cvaResult?.changed_area_percent}
                detectionResult={cvaResult}
              />

            </div>
          )}

          {/* ===================================================================== */}
          {/* SECTION 4: REPORTS DASHBOARD                                          */}
          {/* ===================================================================== */}
          {activeSection === "reports" && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Section Header */}
              <div className="border-b border-white/10 pb-6">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">📊</span>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase tracking-widest">
                    INTELLIGENCE SUMMARY
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Intelligence Reports Dashboard
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Comprehensive audit logs and exportable intelligence packages from both pipeline stages.
                </p>
              </div>

              {/* TWO DEDICATED REPORT CARDS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* --------------------------------------------------------------- */}
                {/* REPORT CARD 1: CVA ANALYSIS REPORT                              */}
                {/* --------------------------------------------------------------- */}
                <div className="p-6 sm:p-8 rounded-3xl border border-cyan-500/30 bg-[#0a1020]/95 backdrop-blur-xl shadow-2xl flex flex-col justify-between space-y-6">
                  
                  <div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">🛰️</span>
                        <div>
                          <h3 className="text-lg font-bold text-white tracking-tight">
                            CVA ANALYSIS REPORT
                          </h3>
                          <span className="text-[10px] font-mono text-cyan-400 uppercase">
                            Sentinel-2 Coarse Detection
                          </span>
                        </div>
                      </div>
                      
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase border ${
                        cvaResult
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}>
                        {cvaResult ? "Report Available" : "Awaiting Analysis"}
                      </span>
                    </div>

                    {/* Card Fields */}
                    <div className="space-y-3 font-mono text-xs">
                      
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                        <span className="text-slate-500">Status:</span>
                        <span className={`font-bold ${cvaResult ? "text-emerald-400" : "text-slate-400"}`}>
                          {cvaResult ? "Analysis Complete" : "Available after CVA analysis"}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                        <span className="text-slate-500">Changed Area:</span>
                        <span className="text-white font-bold">
                          {cvaResult ? `${cvaResult.changed_pixels} px (${cvaResult.changed_area_percent}%)` : "No report generated yet."}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                        <span className="text-slate-500">AOIs Detected:</span>
                        <span className="text-cyan-300 font-bold">
                          {cvaResult ? `${cvaResult.aoi_count} region(s) localized` : "No report generated yet."}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                        <span className="text-slate-500">Confidence:</span>
                        <span className="text-slate-300 font-bold">
                          {cvaResult ? "Not estimated (Direct CVA magnitude)" : "N/A"}
                        </span>
                      </div>

                      {cvaResult && (
                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                          <span className="text-slate-500">Observation Period:</span>
                          <span className="text-purple-300 font-bold">
                            {cvaResult.dates[0]} &rarr; {cvaResult.dates[1]}
                          </span>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-white/10 font-mono text-xs">
                    <button
                      onClick={() => setActiveSection("cva")}
                      className="flex-1 py-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all font-bold flex items-center justify-center gap-2"
                    >
                      <Eye size={14} />
                      <span>VIEW REPORT</span>
                    </button>
                    <button
                      onClick={handleDownloadCVAJSON}
                      disabled={!cvaResult}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-400 hover:to-teal-400 transition-all font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20"
                    >
                      <Download size={14} />
                      <span>DOWNLOAD REPORT</span>
                    </button>
                  </div>

                </div>

                {/* --------------------------------------------------------------- */}
                {/* REPORT CARD 2: FINE-RESOLUTION REPORT                           */}
                {/* --------------------------------------------------------------- */}
                <div className="p-6 sm:p-8 rounded-3xl border border-amber-500/30 bg-[#0a1020]/95 backdrop-blur-xl shadow-2xl flex flex-col justify-between space-y-6">
                  
                  <div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">🔍</span>
                        <div>
                          <h3 className="text-lg font-bold text-white tracking-tight">
                            FINE-RESOLUTION REPORT
                          </h3>
                          <span className="text-[10px] font-mono text-amber-400 uppercase">
                            SpaceNet / LEVIR Investigation
                          </span>
                        </div>
                      </div>
                      
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase border bg-slate-800 text-slate-400 border-slate-700">
                        SpaceNet Stage
                      </span>
                    </div>

                    {/* Card Fields */}
                    <div className="space-y-3 font-mono text-xs">
                      
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                        <span className="text-slate-500">Status:</span>
                        <span className="text-slate-400 font-bold">
                          Available after SpaceNet analysis
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                        <span className="text-slate-500">Detection:</span>
                        <span className="text-emerald-400 font-bold">
                          Building footprint analysis ready
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                        <span className="text-slate-500">Confidence:</span>
                        <span className="text-amber-300 font-bold">
                          Confidence unavailable from model
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                        <span className="text-slate-500">Spatial Resolution:</span>
                        <span className="text-cyan-300 font-bold">
                          0.5m GSD (Sub-meter optical)
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                        <span className="text-slate-500">Model:</span>
                        <span className="text-slate-300 font-bold">
                          ChangeFormer V6 / LEVIR-CD
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-white/10 font-mono text-xs">
                    <button
                      onClick={() => setActiveSection("spacenet")}
                      className="flex-1 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all font-bold flex items-center justify-center gap-2"
                    >
                      <Eye size={14} />
                      <span>VIEW REPORT</span>
                    </button>
                    <button
                      onClick={() => setActiveSection("spacenet")}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white hover:from-amber-400 hover:to-red-400 transition-all font-bold flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
                    >
                      <Download size={14} />
                      <span>DOWNLOAD REPORT</span>
                    </button>
                  </div>

                </div>

              </div>

              {/* No Report Generated Notice if nothing has run */}
              {!cvaResult && (
                <div className="p-6 rounded-3xl border border-white/10 bg-[#0a1020]/60 backdrop-blur-md text-center space-y-3 font-mono">
                  <FileText size={32} className="mx-auto text-slate-500" />
                  <p className="text-sm font-bold text-slate-300">
                    No report generated yet.
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Execute change detection on the Sentinel-2 CVA tab or investigate high-resolution building footprints to populate verified reports.
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      onClick={() => setActiveSection("cva")}
                      className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold hover:bg-cyan-500/20 transition-all"
                    >
                      Go to CVA Detection &rarr;
                    </button>
                    <button
                      onClick={() => setActiveSection("spacenet")}
                      className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold hover:bg-purple-500/20 transition-all"
                    >
                      Go to SpaceNet Analysis &rarr;
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </main>

        {/* Global Footer */}
        <footer className="border-t border-white/5 px-8 py-5 bg-[#04070d] text-xs text-slate-600 font-mono flex flex-col sm:flex-row items-center justify-between gap-2 mt-auto">
          <div className="flex items-center gap-2">
            <Satellite size={14} className="text-cyan-400" />
            <span>CIPHER-X &middot; Coarse-to-Fine Satellite Change Intelligence</span>
          </div>
          <span>Sentinel-2 CVA &middot; SpaceNet / LEVIR-CD High-Res Verification</span>
        </footer>

      </div>
    </div>
  );
}
