"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Building2,
  TrendingUp,
  Users,
  FileText,
  Scale,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/app/stores/auth-store";

const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "self-hosted";

interface ConsultingResearchFormProps {
  onTaskCreated: (taskId: string, title: string, researchType: string, mode?: string) => void;
  isResearching: boolean;
}

type ResearchType =
  | "mna"
  | "company"
  | "market"
  | "competitive"
  | "industry"
  | "custom";

type ResearchMode = "fast" | "standard" | "heavy" | "max";

const researchTypes = [
  {
    id: "mna" as ResearchType,
    label: "M&A Due Diligence",
    icon: Scale,
    placeholder: "e.g., Nvidia, UnitedHealth Group, Stripe",
    description: "Deep financial due diligence with SEC filings, financials, patents & insider data",
  },
  {
    id: "company" as ResearchType,
    label: "Company Due Diligence",
    icon: Building2,
    placeholder: "e.g., Stripe, Databricks, SpaceX",
    description: "Comprehensive analysis of a specific company",
  },
  {
    id: "market" as ResearchType,
    label: "Market Analysis",
    icon: TrendingUp,
    placeholder: "e.g., Electric Vehicle Market, Cloud Computing",
    description: "Market sizing, trends, and growth analysis",
  },
  {
    id: "competitive" as ResearchType,
    label: "Competitive Landscape",
    icon: Users,
    placeholder: "e.g., CRM Software, Food Delivery Apps",
    description: "Competitor mapping and positioning analysis",
  },
  {
    id: "industry" as ResearchType,
    label: "Industry Overview",
    icon: FileText,
    placeholder: "e.g., Fintech, Healthcare IT, Renewable Energy",
    description: "Industry dynamics, value chain, and key players",
  },
  {
    id: "custom" as ResearchType,
    label: "Custom Research",
    icon: Search,
    placeholder: "Describe your research topic...",
    description: "Any business research question or topic",
  },
];

const quickExamples = {
  mna: ["Nvidia", "UnitedHealth Group", "Stripe", "SpaceX"],
  company: ["Tesla", "OpenAI", "Airbnb", "Stripe"],
  market: ["AI/ML Market", "EV Charging", "Digital Payments", "EdTech"],
  competitive: ["Streaming Services", "Cloud Providers", "Ride-sharing", "BNPL"],
  industry: ["Fintech", "HealthTech", "CleanTech", "SaaS"],
  custom: [],
};

const researchModeDurations: Record<ResearchMode, string> = {
  fast: "5-10 minutes",
  standard: "10-20 minutes",
  heavy: "up to 90 minutes",
  max: "up to 180 minutes",
};

const MNA_DATA_CATEGORIES = [
  { id: "sec_filings", label: "SEC Filings (10-K, 10-Q, 8-K)" },
  { id: "financial_statements", label: "Financial Statements & Ratios" },
  { id: "insider_activity", label: "Insider Activity & Market Signals" },
  { id: "patents", label: "Patent & IP Portfolio" },
  { id: "market_intelligence", label: "Market & Competitive Intelligence" },
];

const DEPTH_OPTIONS: {
  id: ResearchMode;
  label: string;
  time: string;
  cost: string;
  highlight?: boolean;
}[] = [
  { id: "fast", label: "Fast", time: "~5 min", cost: "$0.10" },
  { id: "standard", label: "Standard", time: "10-20 min", cost: "$0.50" },
  { id: "heavy", label: "Heavy", time: "~90 min", cost: "$2.50" },
  { id: "max", label: "Max", time: "~180 min", cost: "$15", highlight: true },
];

export default function ConsultingResearchForm({
  onTaskCreated,
  isResearching,
}: ConsultingResearchFormProps) {
  const [researchType, setResearchType] = useState<ResearchType>("company");
  const [researchSubject, setResearchSubject] = useState("");
  const [researchFocus, setResearchFocus] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clientContext, setClientContext] = useState("");
  const [specificQuestions, setSpecificQuestions] = useState("");
  const [researchMode, setResearchMode] = useState<ResearchMode>("fast");
  const [dataCategories, setDataCategories] = useState<string[]>([
    "sec_filings",
    "financial_statements",
    "insider_activity",
    "patents",
    "market_intelligence",
  ]);
  const [dealContext, setDealContext] = useState("");
  const [showCostConfirm, setShowCostConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useAuthStore((state) => state.getAccessToken);
  const openSignInModal = useAuthStore((state) => state.openSignInModal);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const selectedType = researchTypes.find((t) => t.id === researchType)!;
  const selectedModeDuration = researchModeDurations[researchMode];
  const isValyuMode = APP_MODE !== "self-hosted";

  // Restore form data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("consultralph_pending_research");
    if (savedData && isAuthenticated) {
      try {
        const data = JSON.parse(savedData);
        setResearchType(data.researchType);
        setResearchSubject(data.researchSubject);
        setResearchFocus(data.researchFocus);
        setClientContext(data.clientContext);
        setSpecificQuestions(data.specificQuestions);
        if (data.researchMode === "fast" || data.researchMode === "standard" || data.researchMode === "heavy" || data.researchMode === "max") {
          setResearchMode(data.researchMode);
        }
        if (data.dataCategories) setDataCategories(data.dataCategories);
        if (data.dealContext) setDealContext(data.dealContext);
        // Clear the saved data after restoring
        localStorage.removeItem("consultralph_pending_research");
      } catch (e) {
        console.error("Failed to restore form data:", e);
      }
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!researchSubject.trim()) {
      setError("Please enter a research subject");
      return;
    }

    if (researchType === "mna" && dataCategories.length === 0) {
      setError("Please select at least one data category");
      return;
    }

    // Cost confirmation gate for max mode
    if (researchMode === "max" && !showCostConfirm) {
      setShowCostConfirm(true);
      return;
    }
    setShowCostConfirm(false);

    // If in Valyu mode and not authenticated, save form data and open sign-in modal
    if (isValyuMode && !isAuthenticated) {
      // Save form data to localStorage
      const formData = {
        researchType,
        researchSubject: researchSubject.trim(),
        researchFocus: researchFocus.trim(),
        clientContext: clientContext.trim(),
        specificQuestions: specificQuestions.trim(),
        researchMode,
        ...(researchType === "mna" && {
          dataCategories,
          dealContext: dealContext.trim(),
        }),
      };
      localStorage.setItem("consultralph_pending_research", JSON.stringify(formData));
      openSignInModal();
      return;
    }

    setIsSubmitting(true);

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

      const response = await fetch("/api/consulting-research", {
        method: "POST",
        headers,
        body: JSON.stringify({
          researchType,
          researchSubject: researchSubject.trim(),
          researchFocus: researchFocus.trim(),
          clientContext: clientContext.trim(),
          specificQuestions: specificQuestions.trim(),
          researchMode,
          ...(researchType === "mna" && {
            dataCategories,
            dealContext: dealContext.trim(),
          }),
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to start research";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Response wasn't JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }

        // If 401, open sign-in modal
        if (response.status === 401) {
          openSignInModal();
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Clear any pending research data after successful submission
      localStorage.removeItem("consultralph_pending_research");

      onTaskCreated(data.deepresearch_id, researchSubject.trim(), researchType, researchMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSelect = (example: string) => {
    setResearchSubject(example);
    // Clear pending research when user starts selecting new examples
    localStorage.removeItem("consultralph_pending_research");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
      {/* Research Type Selection */}
      <div>
        <label className="block text-sm sm:text-base font-medium mb-3">Research Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
          {researchTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setResearchType(type.id);
                  setResearchSubject("");
                }}
                className={`p-3 sm:p-4 rounded-lg border text-left transition-all min-h-[60px] sm:min-h-[70px] active:scale-95 ${
                  researchType === type.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50 hover:bg-surface"
                }`}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 mb-1" />
                <span className="text-xs sm:text-sm font-medium block truncate">
                  {type.label.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs sm:text-sm text-text-muted mt-2">{selectedType.description}</p>
      </div>

      {/* Research Subject Input */}
      <div>
        <label htmlFor="researchSubject" className="block text-sm sm:text-base font-medium mb-2">
          {researchType === "mna"
            ? "Target Company"
            : researchType === "company"
            ? "Company Name"
            : researchType === "market"
            ? "Market / Segment"
            : researchType === "competitive"
            ? "Industry / Category"
            : researchType === "industry"
            ? "Industry"
            : "Research Topic"}
        </label>
        <input
          type="text"
          id="researchSubject"
          value={researchSubject}
          onChange={(e) => setResearchSubject(e.target.value)}
          placeholder={selectedType.placeholder}
          className="input-field text-base"
          required
          disabled={isSubmitting || isResearching}
        />

        {/* Quick Examples */}
        {quickExamples[researchType].length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
            {quickExamples[researchType].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => handleQuickSelect(example)}
                className="px-3 py-1.5 text-xs sm:text-sm bg-surface hover:bg-surface-hover border border-border rounded-full transition-all active:scale-95 min-h-[32px]"
                disabled={isSubmitting || isResearching}
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* M&A Data Categories */}
      {researchType === "mna" && (
        <div>
          <label className="block text-sm sm:text-base font-medium mb-3">
            Data Categories
          </label>
          <div className="space-y-2">
            {MNA_DATA_CATEGORIES.map((cat) => (
              <label
                key={cat.id}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={dataCategories.includes(cat.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDataCategories((prev) => [...prev, cat.id]);
                    } else {
                      setDataCategories((prev) =>
                        prev.filter((c) => c !== cat.id)
                      );
                    }
                  }}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  disabled={isSubmitting || isResearching}
                />
                <span className="text-sm sm:text-base">{cat.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* M&A Deal Context */}
      {researchType === "mna" && (
        <div>
          <label htmlFor="dealContext" className="block text-sm sm:text-base font-medium mb-2">
            Deal Context{" "}
            <span className="text-text-muted font-normal">(Optional)</span>
          </label>
          <textarea
            id="dealContext"
            value={dealContext}
            onChange={(e) => setDealContext(e.target.value)}
            placeholder="e.g., 'Evaluating as acquisition target for $2B+ deal...'"
            className="input-field resize-none h-20 sm:h-24 text-base"
            disabled={isSubmitting || isResearching}
          />
        </div>
      )}

      {/* Research Focus */}
      <div>
        <label htmlFor="researchFocus" className="block text-sm sm:text-base font-medium mb-2">
          Research Focus{" "}
          <span className="text-text-muted font-normal">(Optional)</span>
        </label>
        <textarea
          id="researchFocus"
          value={researchFocus}
          onChange={(e) => setResearchFocus(e.target.value)}
          placeholder="Specify particular aspects to focus on, e.g., 'Focus on their AI capabilities and recent acquisitions' or 'Emphasize regulatory landscape and barriers to entry'"
          className="input-field resize-none h-20 sm:h-24 text-base"
          disabled={isSubmitting || isResearching}
        />
      </div>

      {/* Research Depth */}
      <div>
        <label className="block text-sm sm:text-base font-medium mb-3">
          Research Depth
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {DEPTH_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setResearchMode(opt.id);
                setShowCostConfirm(false);
              }}
              disabled={isSubmitting || isResearching}
              className={`p-3 sm:p-4 rounded-lg border text-left transition-all ${
                researchMode === opt.id
                  ? opt.highlight
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                    : "border-primary bg-primary/5 text-primary"
                  : opt.highlight
                  ? "border-border hover:border-primary/50 hover:bg-surface bg-surface/50"
                  : "border-border hover:border-primary/50 hover:bg-surface"
              }`}
            >
              <span className="text-sm sm:text-base font-semibold block">
                {opt.label}
              </span>
              <span className="text-xs text-text-muted block mt-1">
                {opt.time} &middot; {opt.cost}
              </span>
            </button>
          ))}
        </div>
        {researchMode === "max" && (
          <p className="text-xs sm:text-sm text-text-muted mt-2">
            Max mode runs an exhaustive multi-pass analysis with the deepest data coverage.
          </p>
        )}
      </div>

      {/* Advanced Options */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm sm:text-base text-text-muted hover:text-foreground transition-colors min-h-[44px] -ml-2 pl-2"
        >
          {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          Advanced Options
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 p-3 sm:p-4 bg-surface rounded-lg border border-border">
            <div>
              <label
                htmlFor="clientContext"
                className="block text-sm sm:text-base font-medium mb-2"
              >
                Client Context
              </label>
              <textarea
                id="clientContext"
                value={clientContext}
                onChange={(e) => setClientContext(e.target.value)}
                placeholder="e.g., 'Client is a PE firm evaluating acquisition' or 'Fortune 500 company exploring market entry'"
                className="input-field resize-none h-16 sm:h-20 text-base"
                disabled={isSubmitting || isResearching}
              />
            </div>

            <div>
              <label
                htmlFor="specificQuestions"
                className="block text-sm sm:text-base font-medium mb-2"
              >
                Specific Questions to Answer
              </label>
              <textarea
                id="specificQuestions"
                value={specificQuestions}
                onChange={(e) => setSpecificQuestions(e.target.value)}
                placeholder="List specific questions you need answered, one per line..."
                className="input-field resize-none h-20 sm:h-24 text-base"
                disabled={isSubmitting || isResearching}
              />
            </div>

          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 sm:p-4 bg-error/10 border border-error/30 rounded-lg text-error text-sm sm:text-base">
          {error}
        </div>
      )}

      {/* Cost Confirmation for Max Mode */}
      {showCostConfirm && researchMode === "max" && (
        <div className="p-4 bg-surface border border-primary/30 rounded-lg space-y-3">
          <p className="text-sm sm:text-base font-medium">
            Max mode will cost approximately <strong>$15</strong> and take up to 180 minutes. Are you sure?
          </p>
          <div className="flex gap-3">
            <button
              type="submit"
              className="btn-primary px-4 py-2 text-sm sm:text-base min-h-[40px]"
              disabled={isSubmitting || isResearching}
            >
              Confirm &amp; Start
            </button>
            <button
              type="button"
              onClick={() => setShowCostConfirm(false)}
              className="px-4 py-2 text-sm sm:text-base border border-border rounded-lg hover:bg-surface-hover transition-colors min-h-[40px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || isResearching || !researchSubject.trim()}
        className="btn-primary w-full flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[52px] text-base sm:text-lg"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
            <span>Starting Research...</span>
          </>
        ) : (
          <>
            <Search className="w-5 h-5 sm:w-6 sm:h-6" />
            <span>Start Deep Research</span>
          </>
        )}
      </button>

      {/* Info Text */}
      <p className="text-xs sm:text-sm text-text-muted text-center px-2">
        Takes <strong>{selectedModeDuration}</strong>. You&apos;ll receive PowerPoint slides, Excel spreadsheet, Word document, and PDF report.{" "}
        <strong>Run multiple research projects at once.</strong>
      </p>
    </form>
  );
}
