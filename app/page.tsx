"use client";

import { Suspense, useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import ConsultingResearchForm from "./components/ConsultingResearchForm";
import ResearchResults from "./components/ResearchResults";
import Sidebar from "./components/Sidebar";
import { SignInModal } from "./components/auth";
import { Building2, TrendingUp, Users, FileText } from "lucide-react";
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
  researchType?: string;
  researchMode?: string;
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

function getPollingInterval(mode?: string): number {
  switch (mode) {
    case "max": return 30000;
    case "heavy": return 15000;
    case "standard": return 10000;
    default: return 5000;
  }
}

function HomeContent() {
  const searchParams = useSearchParams();
  const initialResearchId = searchParams.get("research");

  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentResearchTitle, setCurrentResearchTitle] = useState<string>("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const cancelledRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeTaskRef = useRef<string | null>(null);
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

        // Ignore result if this task is no longer active
        if (activeTaskRef.current !== taskId) return;

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to fetch status");
        }

        const data = await response.json();
        setResearchResult((prev) => ({
          ...prev,
          ...data,
          // Preserve client-side fields that the API doesn't return
          researchType: prev?.researchType,
          researchMode: prev?.researchMode,
        }));

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

    activeTaskRef.current = initialResearchId;
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
    (taskId: string, title: string, researchType: string, mode?: string) => {
      clearPolling();
      activeTaskRef.current = taskId;
      setCurrentTaskId(taskId);
      setCurrentResearchTitle(title);
      setIsResearching(true);
      cancelledRef.current = false;
      setResearchResult({
        status: "queued",
        task_id: taskId,
        researchType,
        researchMode: mode,
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

      const interval = getPollingInterval(mode);
      pollIntervalRef.current = setInterval(() => {
        pollStatus(taskId);
      }, interval);
    },
    [clearPolling, pollStatus]
  );

  const handleSelectHistory = useCallback(
    (item: ResearchHistoryItem) => {
      clearPolling();
      activeTaskRef.current = item.id;
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
    activeTaskRef.current = null;
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
    activeTaskRef.current = null;
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
    activeTaskRef.current = null;
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  const showResults = isResearching || researchResult;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        className="fixed top-4 left-4 z-30 md:hidden p-2 bg-surface border border-border rounded-lg shadow-lg hover:bg-surface-hover transition-all active:scale-95"
        aria-label="Toggle menu"
      >
        <Image
          src="/icon.png"
          alt="Menu"
          width={32}
          height={32}
          className="w-8 h-8 object-contain"
        />
      </button>

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
                    <span className="text-foreground">ConsultR</span>
                  </h1>
                  <div className="relative group cursor-pointer" onClick={() => !isVideoPlaying && setIsVideoPlaying(true)}>
                    <div className="relative">
                      <Image
                          src="/icon.png"
                          alt="ConsultR"
                          width={80}
                          height={80}
                          className="object-contain transition-transform"
                          priority
                        />
                    </div>
                  </div>
                </div>
                <p className="text-base sm:text-lg text-text-muted max-w-2xl mx-auto px-2 leading-relaxed">
                  AI-powered deep research for consultants.
                  <br className="hidden sm:block" />
                  Generate comprehensive reports with PowerPoint decks, Excel spreadsheets, and Word documents.
                  <br className="hidden sm:block" />
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
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold text-sm sm:text-base mb-1">Due Diligence</h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    Comprehensive company research with financials, risks, and
                    competitive positioning
                  </p>
                </div>
                <div className="card text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold text-sm sm:text-base mb-1">Market Analysis</h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    TAM/SAM/SOM sizing, industry trends, growth drivers, and key
                    players
                  </p>
                </div>
                <div className="card text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold text-sm sm:text-base mb-1">Competitive Intel</h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    Competitor mapping, SWOT analysis, and strategic positioning
                  </p>
                </div>
                <div className="card text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold text-sm sm:text-base mb-1">Client-Ready Deliverables</h3>
                  <p className="text-xs sm:text-sm text-text-muted">
                    PowerPoint decks, Excel spreadsheets, Word docs, and PDF reports
                  </p>
                </div>
              </div>

              {/* Footer */}
              <footer className="mt-8 sm:mt-12 text-center text-xs sm:text-sm text-text-muted px-2">
                <p>
                  Deep research for Verra Mobility, powered by AI. Built by Mohi K.
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
                      src="/icon.png"
                      alt="Ralph"
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold">
                      <span className="gradient-text">ConsultR</span>
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

