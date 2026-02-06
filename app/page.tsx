"use client";

import { Suspense, useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import ConsultingResearchForm from "./components/ConsultingResearchForm";
import ResearchResults from "./components/ResearchResults";
import Sidebar from "./components/Sidebar";
import GitHubCorner from "./components/GitHubCorner";
import { SignInModal } from "./components/auth";
import { X } from "lucide-react";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { ResearchHistoryItem, saveToHistory, updateHistoryStatus } from "./lib/researchHistory";
import { useAuthStore } from "./stores/auth-store";

interface ResearchResult {
  status: string;
  task_id: string;
  output?: string;
  sources?: Array<{
    title: string;
    url: string;
  }>;
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
  messages?: Array<{
    role: string;
    content: string | Array<Record<string, unknown>>;
  }>;
  error?: string;
}

// Helper to update URL search params without triggering navigation
function setResearchParam(taskId: string | null) {
  const url = new URL(window.location.href);
  if (taskId) {
    url.searchParams.set("research", taskId);
  } else {
    url.searchParams.delete("research");
  }
  window.history.pushState(null, "", url.toString());
}

function HomeContent() {
  const searchParams = useSearchParams();
  const initialResearchId = searchParams.get("research");

  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
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
  const initialLoadRef = useRef(false);
  const getAccessToken = useAuthStore((state) => state.getAccessToken);
  const showSignInModal = useAuthStore((state) => state.showSignInModal);
  const openSignInModal = useAuthStore((state) => state.openSignInModal);
  const closeSignInModal = useAuthStore((state) => state.closeSignInModal);

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

        // Set title from output if we don't have one (URL-loaded research)
        if (!currentResearchTitle && data.output) {
          // Extract first line or first 60 chars as title
          const firstLine = data.output.split("\n").find((l: string) => l.trim());
          if (firstLine) {
            setCurrentResearchTitle(firstLine.replace(/^#+\s*/, "").slice(0, 60));
          }
        }

        if (
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "cancelled"
        ) {
          clearPolling();
          setIsResearching(false);
          updateHistoryStatus(taskId, data.status);
        }
      } catch (error) {
        console.error("Error polling research status:", error);
      }
    },
    [clearPolling, getAccessToken, currentResearchTitle]
  );

  // Load research from URL param on initial mount
  useEffect(() => {
    if (initialLoadRef.current || !initialResearchId) return;
    initialLoadRef.current = true;

    setCurrentTaskId(initialResearchId);
    setResearchResult({
      status: "queued",
      task_id: initialResearchId,
    });

    // Fetch current status
    pollStatus(initialResearchId);

    // Start polling in case it's still running
    pollIntervalRef.current = setInterval(() => {
      pollStatus(initialResearchId);
    }, 10000);
  }, [initialResearchId, pollStatus]);

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

      // Update URL with research ID
      setResearchParam(taskId);

      saveToHistory({
        id: taskId,
        title,
        researchType: researchType,
        status: "queued",
      });

      pollStatus(taskId);

      pollIntervalRef.current = setInterval(() => {
        pollStatus(taskId);
      }, 10000);
    },
    [pollStatus]
  );

  const handleSelectHistory = useCallback(
    (item: ResearchHistoryItem) => {
      clearPolling();
      cancelledRef.current = false;

      setCurrentTaskId(item.id);
      setCurrentResearchTitle(item.title);
      setResearchResult({
        status: item.status || "queued",
        task_id: item.id,
      });

      // Update URL with research ID
      setResearchParam(item.id);

      const isInProgress =
        item.status === "queued" || item.status === "processing";
      setIsResearching(isInProgress);

      pollStatus(item.id);

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
    setResearchParam(null);
  }, [clearPolling]);

  const handleCancel = async () => {
    if (!currentTaskId) return;

    cancelledRef.current = true;
    clearPolling();

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      const accessToken = getAccessToken();
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      await fetch("/api/consulting-research/cancel", {
        method: "POST",
        headers,
        body: JSON.stringify({ taskId: currentTaskId }),
      });
    } catch (error) {
      console.error("Error cancelling research:", error);
    }

    setIsResearching(false);
    setResearchResult(null);
    setCurrentTaskId(null);
    setResearchParam(null);
  };

  const handleReset = () => {
    clearPolling();
    setIsResearching(false);
    setResearchResult(null);
    setCurrentTaskId(null);
    setCurrentResearchTitle("");
    cancelledRef.current = false;
    setResearchParam(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

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
          await video.play();
          setTimeout(() => {
            video.muted = false;
            setIntroStarted(true);
          }, 100);
        } catch {
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

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        className="fixed top-4 left-4 z-30 md:hidden p-2 bg-surface border border-border rounded-lg shadow-lg hover:bg-surface-hover transition-all active:scale-95"
        aria-label="Toggle menu"
      >
        <Image
          src="/consultralph.png"
          alt="Menu"
          width={32}
          height={32}
          className="w-8 h-8 object-contain"
        />
      </button>

      {/* Discord Toast */}
      {showDiscordBanner && (
        <div className={`fixed top-4 left-20 z-20 bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3 max-w-xs animate-in slide-in-from-left transition-all duration-300 ${
          isSidebarCollapsed ? 'md:left-20' : 'md:left-80'
        }`}>
          <a
            href="https://discord.com/invite/BhUWrFbHRa"
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
        <main className="flex-1 min-h-screen relative">
          {/* Dotted Glow Background */}
          <DottedGlowBackground
            className="pointer-events-none"
            opacity={0.15}
            gap={16}
            radius={1.5}
            colorLightVar="--color-neutral-300"
            glowColorLightVar="--color-neutral-400"
            colorDarkVar="--color-neutral-700"
            glowColorDarkVar="--color-neutral-600"
            backgroundOpacity={0}
            speedMin={0.15}
            speedMax={0.6}
            speedScale={0.6}
          />

          {!showResults ? (
            // Homepage layout
            <div className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 py-12 sm:py-16">
              {/* Header */}
              <div className="text-center mb-6 sm:mb-8 max-w-3xl">
                <div className="flex flex-col-reverse md:flex-row items-center md:items-end justify-center gap-2 sm:gap-3 mb-4">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold md:mb-4">
                    <span className="text-foreground">ConsultRalph</span>
                  </h1>
                  <div className="relative group cursor-pointer" onClick={() => !isVideoPlaying && setIsVideoPlaying(true)}>
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
                        <rect x="2" y="2" width="196" height="196" fill="none" stroke="url(#frameGradient)" strokeWidth="16" rx="4" />
                        <rect x="10" y="10" width="180" height="180" fill="none" stroke="url(#frameGradient)" strokeWidth="3" rx="2" />
                        <circle cx="20" cy="20" r="4" fill="url(#frameHighlight)" />
                        <circle cx="180" cy="20" r="4" fill="url(#frameHighlight)" />
                        <circle cx="20" cy="180" r="4" fill="url(#frameHighlight)" />
                        <circle cx="180" cy="180" r="4" fill="url(#frameHighlight)" />
                        <circle cx="100" cy="10" r="3" fill="url(#frameHighlight)" />
                        <circle cx="100" cy="190" r="3" fill="url(#frameHighlight)" />
                        <circle cx="10" cy="100" r="3" fill="url(#frameHighlight)" />
                        <circle cx="190" cy="100" r="3" fill="url(#frameHighlight)" />
                        <rect x="18" y="18" width="164" height="164" fill="none" stroke="#00000020" strokeWidth="1" rx="2" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-base sm:text-lg text-text-muted max-w-2xl mx-auto px-2 leading-relaxed">
                  AI-powered deep research for consultants.
                  <br className="hidden sm:block" />
                  Generate comprehensive reports in 5-10 minutes with PowerPoint decks, Excel spreadsheets, and Word documents.
                  <br className="hidden sm:block" />
                  <span className="block mt-2">
                    Powered by Valyu, the Search API for AI knowledge work.
                  </span>
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
              <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-5xl w-full px-2">
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
                <div className="card text-center">
                  <div className="text-3xl sm:text-4xl mb-2">⚔️</div>
                  <h3 className="font-semibold text-sm sm:text-base mb-1">Competitive Intel</h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    Competitor mapping, SWOT analysis, and strategic positioning
                  </p>
                </div>
                <div className="card text-center">
                  <div className="text-3xl sm:text-4xl mb-2">📑</div>
                  <h3 className="font-semibold text-sm sm:text-base mb-1">Client-Ready Deliverables</h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    PowerPoint decks, Excel spreadsheets, Word docs, and PDF reports
                  </p>
                </div>
              </div>

              {/* Footer */}
              <footer className="mt-8 sm:mt-12 text-center text-xs sm:text-sm text-text-muted px-2">
                <p>
                  Deepresearch powered by{" "}
                  <a
                    href="https://valyu.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Valyu
                  </a>
                  , the Search API for AI knowledge work
                </p>
              </footer>
            </div>
          ) : (
            // Results layout
            <div className="p-4 sm:p-6 md:p-8">
              {/* Compact Header */}
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="relative w-10 h-10 sm:w-12 sm:h-12">
                    <Image
                      src="/consultralph.png"
                      alt="Ralph"
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold">
                      <span className="gradient-text">ConsultRalph</span>
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

      {/* Sign In Modal */}
      <SignInModal
        open={showSignInModal}
        onOpenChange={(open) => open ? openSignInModal() : closeSignInModal()}
      />
    </div>
  );
}

// Wrap in Suspense for useSearchParams (Next.js 15 requirement)
export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
