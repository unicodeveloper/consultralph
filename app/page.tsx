"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import ConsultingResearchForm from "./components/ConsultingResearchForm";
import ResearchResults from "./components/ResearchResults";
import Sidebar from "./components/Sidebar";
import GitHubCorner from "./components/GitHubCorner";
import { SignInPanel } from "./components/auth";
import { Briefcase, X, Menu } from "lucide-react";
import {
  saveToHistory,
  updateHistoryStatus,
  ResearchHistoryItem,
} from "./lib/researchHistory";
import { useAuthStore } from "./stores/auth-store";

interface ResearchResult {
  status: string;
  task_id: string;
  output?: string;
  sources?: Array<{
    title: string;
    url: string;
  }>;
  usage?: {
    search_units: number;
    ai_units: number;
    compute_units: number;
    total_cost: number;
  };
  pdf_url?: string;
  deliverables?: Array<{
    type: string;
    title: string;
    url: string;
  }>;
  progress?: {
    current_step: number;
    total_steps: number;
  };
  error?: string;
}

export default function Home() {
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(
    null
  );
  const [isResearching, setIsResearching] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentResearchTitle, setCurrentResearchTitle] = useState<string>("");
  const [showDiscordBanner, setShowDiscordBanner] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [introStarted, setIntroStarted] = useState(false);

  const cancelledRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const introVideoRef = useRef<HTMLVideoElement>(null);
  const getAccessToken = useAuthStore((state) => state.getAccessToken);

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (taskId: string) => {
      if (cancelledRef.current) {
        clearPolling();
        return;
      }

      try {
        const accessToken = getAccessToken();
        const statusUrl = accessToken
          ? `/api/consulting-research/status?taskId=${taskId}&accessToken=${encodeURIComponent(accessToken)}`
          : `/api/consulting-research/status?taskId=${taskId}`;
        const response = await fetch(statusUrl);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to fetch status");
        }

        const data = await response.json();
        setResearchResult(data);

        // Update history status
        if (data.status) {
          updateHistoryStatus(taskId, data.status);
        }

        if (
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "cancelled"
        ) {
          clearPolling();
          if (data.status !== "completed") {
            setIsResearching(false);
          }
        }
      } catch (error) {
        console.error("Error polling status:", error);
      }
    },
    [clearPolling, getAccessToken]
  );

  const handleTaskCreated = useCallback(
    (taskId: string, title: string, researchType: string) => {
      setCurrentTaskId(taskId);
      setCurrentResearchTitle(title);
      setIsResearching(true);
      cancelledRef.current = false;
      setResearchResult({
        status: "queued",
        task_id: taskId,
      });

      // Save to history
      saveToHistory({
        id: taskId,
        title: title,
        researchType: researchType,
        status: "queued",
      });

      // Start polling immediately
      pollStatus(taskId);

      // Then poll every 10 seconds
      pollIntervalRef.current = setInterval(() => {
        pollStatus(taskId);
      }, 10000);
    },
    [pollStatus]
  );

  const handleSelectHistory = useCallback(
    (item: ResearchHistoryItem) => {
      // Clear any existing polling
      clearPolling();
      cancelledRef.current = false;

      setCurrentTaskId(item.id);
      setCurrentResearchTitle(item.title);
      setResearchResult({
        status: item.status || "queued",
        task_id: item.id,
      });

      // Check if research is still in progress
      const isInProgress =
        item.status === "queued" || item.status === "processing";
      setIsResearching(isInProgress);

      // Fetch latest status from Valyu
      pollStatus(item.id);

      // If still in progress, start polling
      if (isInProgress) {
        pollIntervalRef.current = setInterval(() => {
          pollStatus(item.id);
        }, 10000);
      }
    },
    [clearPolling, pollStatus]
  );

  const handleNewResearch = useCallback(() => {
    clearPolling();
    setIsResearching(false);
    setResearchResult(null);
    setCurrentTaskId(null);
    setCurrentResearchTitle("");
    cancelledRef.current = false;
  }, [clearPolling]);

  const handleCancel = async () => {
    if (!currentTaskId) return;

    cancelledRef.current = true;
    clearPolling();

    try {
      // Build headers with optional auth token
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      // Add authorization header if user is authenticated
      const accessToken = getAccessToken();
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      await fetch("/api/consulting-research/cancel", {
        method: "POST",
        headers,
        body: JSON.stringify({ taskId: currentTaskId }),
      });

      // Update history status
      updateHistoryStatus(currentTaskId, "cancelled");
    } catch (error) {
      console.error("Error cancelling research:", error);
    }

    setIsResearching(false);
    setResearchResult(null);
    setCurrentTaskId(null);
  };

  const handleReset = () => {
    clearPolling();
    setIsResearching(false);
    setResearchResult(null);
    setCurrentTaskId(null);
    setCurrentResearchTitle("");
    cancelledRef.current = false;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Left/Right arrow keys to collapse/expand sidebar (desktop only)
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIsSidebarCollapsed(true);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIsSidebarCollapsed(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Check if first visit
  useEffect(() => {
    const hasSeenIntro = localStorage.getItem("consultralph_intro_seen");
    if (!hasSeenIntro) {
      setShowIntro(true);
    }
  }, []);

  // Try to enable audio after video starts playing
  useEffect(() => {
    if (showIntro && introVideoRef.current) {
      const video = introVideoRef.current;

      const tryUnmute = async () => {
        try {
          // Start playing muted
          await video.play();
          // Wait a tiny bit then try to unmute
          setTimeout(() => {
            video.muted = false;
            setIntroStarted(true);
          }, 100);
        } catch (error) {
          console.log('Autoplay with sound blocked, showing play button');
        }
      };

      tryUnmute();
    }
  }, [showIntro]);

  const handleIntroStart = () => {
    setIntroStarted(true);
    if (introVideoRef.current) {
      introVideoRef.current.muted = false;
      introVideoRef.current.play();
    }
  };

  const handleIntroEnd = () => {
    localStorage.setItem("consultralph_intro_seen", "true");
    setShowIntro(false);
    setIntroStarted(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  const showResults = isResearching || researchResult;

  return (
    <div className="min-h-screen bg-background">
      {/* First-time intro video */}
      {showIntro && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center pb-24 md:pb-32">
            <video
              ref={introVideoRef}
              src="/ralph.mp4"
              playsInline
              muted
              className="max-w-full max-h-full object-contain"
              onEnded={handleIntroEnd}
            />
            {/* Play button overlay */}
            {!introStarted && (
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <button
                  onClick={handleIntroStart}
                  className="bg-white/90 hover:bg-white active:bg-white text-black px-6 py-3 md:px-8 md:py-4 rounded-full text-lg md:text-xl font-semibold shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 md:gap-3"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play with sound
                </button>
              </div>
            )}
            {/* Subtitles - only show when playing */}
            {introStarted && (
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center px-6 max-w-4xl">
                <p className="text-white text-2xl md:text-4xl font-semibold mb-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  Hello everyone! Do you need any help?
                </p>
                <p className="text-white text-2xl md:text-4xl font-semibold mb-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  Just consult Ralph.....
                </p>
                <p className="text-white/70 text-sm md:text-base italic drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  Powered by Valyu DeepResearch API
                </p>
              </div>
            )}
            {/* Skip button */}
            <button
              onClick={handleIntroEnd}
              className="absolute top-8 right-8 text-white/80 hover:text-white transition-colors text-sm md:text-base px-4 py-2 border border-white/30 rounded-lg hover:bg-white/10"
            >
              Skip intro
            </button>
          </div>
        </div>
      )}

      <GitHubCorner />
      <SignInPanel sidebarCollapsed={isSidebarCollapsed} />

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        className="fixed top-4 left-4 z-30 md:hidden p-3 bg-surface border border-border rounded-lg shadow-lg hover:bg-surface-hover transition-all active:scale-95"
        aria-label="Toggle menu"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Discord Toast */}
      {showDiscordBanner && (
        <div className={`fixed top-4 left-20 z-20 bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3 max-w-xs animate-in slide-in-from-left transition-all duration-300 ${
          isSidebarCollapsed ? 'md:left-20' : 'md:left-80'
        }`}>
          <a
            href="https://discord.gg/8TCbHsSe"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground hover:text-primary transition-colors"
          >
            🎮 Join our Discord community
          </a>
          <button
            onClick={() => setShowDiscordBanner(false)}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <Sidebar
          onSelectHistory={handleSelectHistory}
          onNewResearch={handleNewResearch}
          currentResearchId={currentTaskId}
          isCollapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
          mobileOpen={isMobileSidebarOpen}
          onMobileToggle={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          {!showResults ? (
            // Homepage layout
            <div className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 py-12 sm:py-16">
              {/* Header */}
              <div className="text-center mb-6 sm:mb-8 max-w-3xl">
                <div className="flex flex-col-reverse md:flex-row items-center md:items-end justify-center gap-2 sm:gap-3 mb-4">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold md:mb-4">
                    <span className="text-foreground">Consult Ralph</span>
                  </h1>
                  <div className="relative group cursor-pointer" onClick={() => !isVideoPlaying && setIsVideoPlaying(true)}>
                    {/* Ralph image/video */}
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-44 md:h-44">
                      {isVideoPlaying ? (
                        <video
                          src="/ralph.mp4"
                          autoPlay
                          playsInline
                          className="w-full h-full object-contain"
                          onEnded={() => setIsVideoPlaying(false)}
                        />
                      ) : (
                        <Image
                          src="/consultralph.png"
                          alt="Consult Ralph"
                          width={176}
                          height={176}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                          priority
                        />
                      )}
                    </div>
                    {/* Ornate picture frame overlay - only shows when video is playing */}
                    {isVideoPlaying && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox="0 0 200 200"
                        style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}
                      >
                        <defs>
                          <linearGradient id="frameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#d4a574', stopOpacity: 1 }} />
                            <stop offset="50%" style={{ stopColor: '#c19a6b', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#a67c52', stopOpacity: 1 }} />
                          </linearGradient>
                          <linearGradient id="frameHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#f4e4d4', stopOpacity: 0.8 }} />
                            <stop offset="100%" style={{ stopColor: '#c19a6b', stopOpacity: 0.2 }} />
                          </linearGradient>
                        </defs>

                        {/* Outer frame border */}
                        <rect x="2" y="2" width="196" height="196" fill="none" stroke="url(#frameGradient)" strokeWidth="16" rx="4" />

                        {/* Inner decorative border */}
                        <rect x="10" y="10" width="180" height="180" fill="none" stroke="url(#frameGradient)" strokeWidth="3" rx="2" />

                        {/* Corner ornaments */}
                        <circle cx="20" cy="20" r="4" fill="url(#frameHighlight)" />
                        <circle cx="180" cy="20" r="4" fill="url(#frameHighlight)" />
                        <circle cx="20" cy="180" r="4" fill="url(#frameHighlight)" />
                        <circle cx="180" cy="180" r="4" fill="url(#frameHighlight)" />

                        {/* Side ornaments */}
                        <circle cx="100" cy="10" r="3" fill="url(#frameHighlight)" />
                        <circle cx="100" cy="190" r="3" fill="url(#frameHighlight)" />
                        <circle cx="10" cy="100" r="3" fill="url(#frameHighlight)" />
                        <circle cx="190" cy="100" r="3" fill="url(#frameHighlight)" />

                        {/* Inner shadow effect */}
                        <rect x="18" y="18" width="164" height="164" fill="none" stroke="#00000020" strokeWidth="1" rx="2" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-base sm:text-lg text-text-muted max-w-2xl mx-auto px-2">
                  Free AI-powered deep research for consultants. Generate
                  comprehensive due diligence reports, market analyses,
                  competitive landscapes, and strategic insights in minutes.
                  Powered by Valyu - the Search API for AI knowledge work.
                </p>
              </div>

              {/* Research Form */}
              <div className="w-full max-w-2xl px-2">
                <ConsultingResearchForm
                  onTaskCreated={handleTaskCreated}
                  isResearching={isResearching}
                />
              </div>

              {/* Features */}
              <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl w-full px-2">
                <div className="card text-center">
                  <div className="text-3xl sm:text-4xl mb-2">📊</div>
                  <h3 className="font-semibold text-sm sm:text-base mb-1">Due Diligence</h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    Comprehensive company research with financials, risks, and
                    competitive positioning
                  </p>
                </div>
                <div className="card text-center">
                  <div className="text-3xl sm:text-4xl mb-2">🎯</div>
                  <h3 className="font-semibold text-sm sm:text-base mb-1">Market Analysis</h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    TAM/SAM/SOM sizing, industry trends, growth drivers, and key
                    players
                  </p>
                </div>
                <div className="card text-center sm:col-span-2 md:col-span-1">
                  <div className="text-3xl sm:text-4xl mb-2">⚔️</div>
                  <h3 className="font-semibold text-sm sm:text-base mb-1">Competitive Intel</h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    Competitor mapping, SWOT analysis, and strategic positioning
                  </p>
                </div>
              </div>

              {/* Footer */}
              <footer className="mt-8 sm:mt-12 text-center text-xs sm:text-sm text-text-muted px-2 space-y-1">
                <p>
                  <span className="font-medium text-foreground">Free</span> deep research powered by{" "}
                  <a
                    href="https://valyu.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Valyu
                  </a>
                </p>
                <p className="text-xs">
                  Valyu - the Search API for AI knowledge work
                </p>
              </footer>
            </div>
          ) : (
            // Results layout
            <div className="p-4 sm:p-6 md:p-8">
              {/* Compact Header */}
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold">
                      <span className="gradient-text">Consulting Research</span>
                    </h1>
                    {currentResearchTitle && (
                      <p className="text-xs sm:text-sm text-text-muted">
                        {currentResearchTitle}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Results */}
              <ResearchResults
                result={researchResult}
                onCancel={handleCancel}
                onReset={handleReset}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
