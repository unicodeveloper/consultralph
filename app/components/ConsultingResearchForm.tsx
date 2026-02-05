"use client";

import { useState } from "react";
import {
  Search,
  Building2,
  TrendingUp,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/app/stores/auth-store";

interface ConsultingResearchFormProps {
  onTaskCreated: (taskId: string, title: string, researchType: string) => void;
  isResearching: boolean;
}

type ResearchType =
  | "company"
  | "market"
  | "competitive"
  | "industry"
  | "custom";

const researchTypes = [
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
  company: ["Tesla", "OpenAI", "Airbnb", "Stripe"],
  market: ["AI/ML Market", "EV Charging", "Digital Payments", "EdTech"],
  competitive: ["Streaming Services", "Cloud Providers", "Ride-sharing", "BNPL"],
  industry: ["Fintech", "HealthTech", "CleanTech", "SaaS"],
  custom: [],
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useAuthStore((state) => state.getAccessToken);
  const openSignInModal = useAuthStore((state) => state.openSignInModal);

  const selectedType = researchTypes.find((t) => t.id === researchType)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!researchSubject.trim()) {
      setError("Please enter a research subject");
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
      onTaskCreated(data.deepresearch_id, researchSubject.trim(), researchType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSelect = (example: string) => {
    setResearchSubject(example);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Research Type Selection */}
      <div>
        <label className="block text-sm font-medium mb-3">Research Type</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
                className={`p-3 rounded-lg border text-left transition-all ${
                  researchType === type.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50 hover:bg-surface"
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium block truncate">
                  {type.label.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-text-muted mt-2">{selectedType.description}</p>
      </div>

      {/* Research Subject Input */}
      <div>
        <label htmlFor="researchSubject" className="block text-sm font-medium mb-2">
          {researchType === "company"
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
          className="input-field"
          required
          disabled={isSubmitting || isResearching}
        />

        {/* Quick Examples */}
        {quickExamples[researchType].length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {quickExamples[researchType].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => handleQuickSelect(example)}
                className="px-3 py-1 text-xs bg-surface hover:bg-surface-hover border border-border rounded-full transition-colors"
                disabled={isSubmitting || isResearching}
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Research Focus */}
      <div>
        <label htmlFor="researchFocus" className="block text-sm font-medium mb-2">
          Research Focus{" "}
          <span className="text-text-muted font-normal">(Optional)</span>
        </label>
        <textarea
          id="researchFocus"
          value={researchFocus}
          onChange={(e) => setResearchFocus(e.target.value)}
          placeholder="Specify particular aspects to focus on, e.g., 'Focus on their AI capabilities and recent acquisitions' or 'Emphasize regulatory landscape and barriers to entry'"
          className="input-field resize-none h-20"
          disabled={isSubmitting || isResearching}
        />
      </div>

      {/* Advanced Options */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Advanced Options
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 p-4 bg-surface rounded-lg border border-border">
            <div>
              <label
                htmlFor="clientContext"
                className="block text-sm font-medium mb-2"
              >
                Client Context
              </label>
              <textarea
                id="clientContext"
                value={clientContext}
                onChange={(e) => setClientContext(e.target.value)}
                placeholder="e.g., 'Client is a PE firm evaluating acquisition' or 'Fortune 500 company exploring market entry'"
                className="input-field resize-none h-16"
                disabled={isSubmitting || isResearching}
              />
            </div>

            <div>
              <label
                htmlFor="specificQuestions"
                className="block text-sm font-medium mb-2"
              >
                Specific Questions to Answer
              </label>
              <textarea
                id="specificQuestions"
                value={specificQuestions}
                onChange={(e) => setSpecificQuestions(e.target.value)}
                placeholder="List specific questions you need answered, one per line..."
                className="input-field resize-none h-20"
                disabled={isSubmitting || isResearching}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || isResearching || !researchSubject.trim()}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Starting Research...
          </>
        ) : (
          <>
            <Search className="w-5 h-5" />
            Start Deep Research
          </>
        )}
      </button>

      {/* Info Text */}
      <p className="text-xs text-text-muted text-center">
        Research typically takes 5-10 minutes. You&apos;ll receive a comprehensive
        PDF report, data spreadsheet, and executive summary. You can also run multiple research all at once.
      </p>
    </form>
  );
}
