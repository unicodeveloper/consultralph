"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CheckCircle,
  XCircle,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  ExternalLink,
  Loader2,
  RefreshCw,
  Clock,
  Search,
  Brain,
  BarChart3,
  FileCheck,
  Eye,
} from "lucide-react";
import FileViewer from "./FileViewer";

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

interface ResearchResultsProps {
  result: ResearchResult | null;
  onCancel: () => void;
  onReset: () => void;
}

interface ViewerState {
  isOpen: boolean;
  url: string;
  fileType: string;
  title: string;
}

const researchSteps = [
  { icon: Search, label: "Searching business databases" },
  { icon: Brain, label: "Analyzing data and trends" },
  { icon: BarChart3, label: "Generating insights" },
  { icon: FileCheck, label: "Compiling deliverables" },
];

export default function ResearchResults({
  result,
  onCancel,
  onReset,
}: ResearchResultsProps) {
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [viewer, setViewer] = useState<ViewerState>({
    isOpen: false,
    url: "",
    fileType: "",
    title: "",
  });

  const getStatusMessage = (status: string) => {
    switch (status) {
      case "queued":
        return "Research queued, starting soon...";
      case "running":
        return "Deep research in progress...";
      case "completed":
        return "Research completed successfully!";
      case "failed":
        return "Research encountered an error";
      case "cancelled":
        return "Research was cancelled";
      default:
        return "Processing...";
    }
  };

  const getFileIcon = (format: string) => {
    switch (format.toLowerCase()) {
      case "pdf":
        return <FileText className="w-5 h-5 text-red-500" />;
      case "csv":
      case "xlsx":
        return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
      case "docx":
        return <File className="w-5 h-5 text-blue-500" />;
      case "pptx":
        return <File className="w-5 h-5 text-orange-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const getFileLabel = (format: string) => {
    switch (format.toLowerCase()) {
      case "pdf":
        return "Full Research Report";
      case "csv":
        return "Data & Comparisons";
      case "xlsx":
        return "Data Spreadsheet";
      case "docx":
        return "Executive Summary";
      case "pptx":
        return "Presentation";
      default:
        return format.toUpperCase();
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    setIsDownloading(filename);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
    } finally {
      setIsDownloading(null);
    }
  };

  const handleView = (url: string, fileType: string, title: string) => {
    setViewer({
      isOpen: true,
      url,
      fileType,
      title,
    });
  };

  const closeViewer = () => {
    setViewer({
      isOpen: false,
      url: "",
      fileType: "",
      title: "",
    });
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    await onCancel();
    setIsCancelling(false);
  };

  const isComplete = result?.status === "completed";
  const isFailed = result?.status === "failed" || result?.status === "cancelled";
  const isInProgress = result?.status === "queued" || result?.status === "running";

  const progressPercent = result?.progress
    ? Math.round((result.progress.current_step / result.progress.total_steps) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* File Viewer Modal */}
      <FileViewer
        url={viewer.url}
        fileType={viewer.fileType}
        title={viewer.title}
        isOpen={viewer.isOpen}
        onClose={closeViewer}
      />

      {/* Status Header */}
      {isInProgress && (
        <div className="card">
          <div className="flex flex-col items-center text-center">
            {/* Animated Loading Ring */}
            <div className="relative w-24 h-24 mb-4">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
              <div
                className="absolute inset-0 border-4 border-primary rounded-full pulse-ring"
                style={{
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Clock className="w-10 h-10 text-primary animate-pulse" />
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-2">
              {getStatusMessage(result?.status || "queued")}
            </h2>

            {/* Progress */}
            {result?.progress && (
              <div className="w-full max-w-md mb-4">
                <div className="flex justify-between text-sm text-text-muted mb-1">
                  <span>
                    Step {result.progress.current_step} of {result.progress.total_steps}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary progress-bar transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Research Steps */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-4">
              {researchSteps.map((step, index) => {
                const Icon = step.icon;
                const currentStep = result?.progress?.current_step || 0;
                const isActive = index + 1 === currentStep;
                const isCompleted = index + 1 < currentStep;

                return (
                  <div
                    key={index}
                    className={`flex flex-col items-center p-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : isCompleted
                        ? "bg-success/10 text-success"
                        : "bg-surface text-text-muted"
                    }`}
                  >
                    <Icon
                      className={`w-6 h-6 mb-1 ${isActive ? "animate-pulse" : ""}`}
                    />
                    <span className="text-xs text-center">{step.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Cancel Button */}
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="btn-secondary mt-6 flex items-center gap-2"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Cancel Research
                </>
              )}
            </button>

            {/* Expected Deliverables */}
            <div className="mt-6 p-4 bg-surface rounded-lg w-full max-w-md">
              <h3 className="font-medium mb-2">You&apos;ll receive:</h3>
              <ul className="text-sm text-text-muted space-y-1">
                <li>• Comprehensive PDF research report</li>
                <li>• Data spreadsheet with key metrics</li>
                <li>• Executive summary document</li>
                <li>• Cited sources and references</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Completed State */}
      {isComplete && (
        <>
          {/* Success Header */}
          <div className="card bg-success/5 border-success/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-success" />
                <div>
                  <h2 className="text-lg font-semibold">Research Complete</h2>
                  <p className="text-sm text-text-muted">
                    Your deliverables are ready to view and download
                  </p>
                </div>
              </div>
              <button onClick={onReset} className="btn-secondary flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                New Research
              </button>
            </div>
          </div>

          {/* Deliverables */}
          {(result.deliverables?.length || result.pdf_url) && (
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Deliverables
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.pdf_url && (
                  <div className="p-4 bg-surface rounded-lg border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      {getFileIcon("pdf")}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">Research Report</div>
                        <div className="text-xs text-text-muted">PDF Document</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(result.pdf_url!, "pdf", "Research Report")}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => handleDownload(result.pdf_url!, "research-report.pdf")}
                        disabled={isDownloading === "research-report.pdf"}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface-hover hover:bg-border rounded-lg transition-colors text-sm font-medium"
                      >
                        {isDownloading === "research-report.pdf" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Download
                      </button>
                    </div>
                  </div>
                )}
                {result.deliverables?.map((deliverable, index) => (
                  <div key={index} className="p-4 bg-surface rounded-lg border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      {getFileIcon(deliverable.type)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{getFileLabel(deliverable.type)}</div>
                        <div className="text-xs text-text-muted">
                          {deliverable.type.toUpperCase()} File
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(deliverable.url, deliverable.type, getFileLabel(deliverable.type))}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() =>
                          handleDownload(
                            deliverable.url,
                            `${deliverable.title}.${deliverable.type}`
                          )
                        }
                        disabled={isDownloading === `${deliverable.title}.${deliverable.type}`}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface-hover hover:bg-border rounded-lg transition-colors text-sm font-medium"
                      >
                        {isDownloading === `${deliverable.title}.${deliverable.type}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Research Output */}
          {result.output && (
            <div className="card">
              <h3 className="font-semibold mb-4">Research Findings</h3>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {children}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ),
                  }}
                >
                  {result.output}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4">Sources ({result.sources.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.sources.map((source, index) => {
                  let domain = "";
                  try {
                    domain = new URL(source.url).hostname.replace("www.", "");
                  } catch {
                    domain = source.url;
                  }
                  return (
                    <a
                      key={index}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-surface hover:bg-surface-hover rounded-lg border border-border transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                        alt=""
                        className="w-5 h-5 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {source.title || domain}
                        </div>
                        <div className="text-xs text-text-muted truncate">
                          {domain}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-text-muted flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Usage Stats */}
          {result.usage && (
            <div className="card">
              <h3 className="font-semibold mb-4">Research Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-surface rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {result.usage.search_units}
                  </div>
                  <div className="text-xs text-text-muted">Search Units</div>
                </div>
                <div className="text-center p-3 bg-surface rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {result.usage.ai_units}
                  </div>
                  <div className="text-xs text-text-muted">AI Units</div>
                </div>
                <div className="text-center p-3 bg-surface rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {result.usage.compute_units}
                  </div>
                  <div className="text-xs text-text-muted">Compute Units</div>
                </div>
                <div className="text-center p-3 bg-surface rounded-lg">
                  <div className="text-2xl font-bold text-accent">
                    ${result.usage.total_cost.toFixed(2)}
                  </div>
                  <div className="text-xs text-text-muted">Total Cost</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Failed State */}
      {isFailed && (
        <div className="card bg-error/5 border-error/30">
          <div className="flex flex-col items-center text-center py-8">
            <XCircle className="w-16 h-16 text-error mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {result?.status === "cancelled"
                ? "Research Cancelled"
                : "Research Failed"}
            </h2>
            <p className="text-text-muted mb-6">
              {result?.error || "An unexpected error occurred during research."}
            </p>
            <button onClick={onReset} className="btn-primary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
