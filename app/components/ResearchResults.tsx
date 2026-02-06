"use client";

import React, { useState, useMemo } from "react";
import { marked } from "marked";
import {
  CheckCircle,
  XCircle,
  FileText,
  FileSpreadsheet,
  File,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Globe,
  BookOpen,
  Eye,
  ChevronDown,
  ChevronUp,
  Presentation,
} from "lucide-react";
import FileViewer from "./FileViewer";
import ResearchActivityFeed from "./ResearchActivityFeed";

interface ResearchResultsProps {
  result: {
    status: string;
    task_id: string;
    output?: string;
    sources?: Array<{ title: string; url: string }>;
    usage?: {
      search_units: number;
      ai_units: number;
      compute_units: number;
      total_cost: number;
    };
    pdf_url?: string;
    deliverables?: Array<{ type: string; title: string; url: string }>;
    progress?: { current_step: number; total_steps: number };
    messages?: Array<{ role: string; content: string | Array<Record<string, unknown>> }>;
    error?: string;
  } | null;
  onCancel: () => void;
  onReset: () => void;
}

interface ViewerState {
  isOpen: boolean;
  url: string;
  fileType: string;
  title: string;
}

function getFileIcon(format: string) {
  switch (format.toLowerCase()) {
    case "pdf":
      return <FileText className="w-5 h-5 text-red-500" />;
    case "csv":
    case "xlsx":
      return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    case "docx":
      return <File className="w-5 h-5 text-blue-500" />;
    case "pptx":
      return <Presentation className="w-5 h-5 text-orange-500" />;
    default:
      return <File className="w-5 h-5 text-gray-500" />;
  }
}

function getFileLabel(format: string) {
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
}

export default function ResearchResults({ result, onCancel, onReset }: ResearchResultsProps) {
  const [showReport, setShowReport] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [viewer, setViewer] = useState<ViewerState>({
    isOpen: false,
    url: "",
    fileType: "",
    title: "",
  });

  // Parse markdown to HTML string once with marked (fast, no React element tree)
  const reportHtml = useMemo(() => {
    if (!result?.output) return "";
    return marked(result.output, { gfm: true, breaks: true }) as string;
  }, [result?.output]);

  if (!result) return null;

  const isComplete = result.status === "completed";
  const isInProgress = result.status === "queued" || result.status === "running";
  const isFailed = result.status === "failed" || result.status === "cancelled";

  const progressPercent = result.progress
    ? Math.round((result.progress.current_step / result.progress.total_steps) * 100)
    : isComplete
      ? 100
      : 0;

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
      window.open(url, "_blank");
    } finally {
      setIsDownloading(null);
    }
  };

  const handleView = (url: string, fileType: string, title: string) => {
    setViewer({ isOpen: true, url, fileType, title });
  };

  const closeViewer = () => {
    setViewer({ isOpen: false, url: "", fileType: "", title: "" });
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    await onCancel();
    setIsCancelling(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* File Viewer Modal */}
      <FileViewer
        url={viewer.url}
        fileType={viewer.fileType}
        title={viewer.title}
        isOpen={viewer.isOpen}
        onClose={closeViewer}
      />

      {/* Progress bar */}
      {(isInProgress || isComplete) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {isInProgress && (
                <>
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-text-muted">
                    {result.progress
                      ? `Step ${result.progress.current_step} of ${result.progress.total_steps}`
                      : "Starting research..."}
                  </span>
                </>
              )}
              {isComplete && (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-green-500 font-medium">Research Complete</span>
                </>
              )}
            </div>
            <span className="text-xs text-text-muted">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-border/40">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isComplete ? "bg-green-500" : "bg-primary"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Activity feed */}
      {result.messages && result.messages.length > 0 && (
        <ResearchActivityFeed
          messages={result.messages}
          isRunning={isInProgress}
        />
      )}

      {/* Cancel button during running */}
      {isInProgress && (
        <button
          onClick={handleCancel}
          disabled={isCancelling}
          className="btn-secondary flex items-center gap-2 min-h-[44px]"
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
      )}

      {/* Completed results */}
      {isComplete && (
        <>
          {/* Success header */}
          <div className="card bg-success/5 border-success/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-success flex-shrink-0" />
                <div>
                  <h2 className="text-base sm:text-lg font-semibold">Research Complete</h2>
                  <p className="text-xs sm:text-sm text-text-muted">
                    Your deliverables are ready to view and download
                  </p>
                </div>
              </div>
              <button onClick={onReset} className="btn-secondary flex items-center gap-2 w-full sm:w-auto min-h-[44px]">
                <RefreshCw className="w-4 h-4" />
                <span>New Research</span>
              </button>
            </div>
          </div>

          {/* Deliverables with View/Download */}
          {(result.deliverables?.length || result.pdf_url) && (
            <div className="card">
              <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                Deliverables
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {result.pdf_url && (
                  <div className="p-3 sm:p-4 bg-surface rounded-lg border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      {getFileIcon("pdf")}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm sm:text-base">Research Report</div>
                        <div className="text-xs text-text-muted">PDF Document</div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleView(result.pdf_url!, "pdf", "Research Report")}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all active:scale-95 text-sm font-medium min-h-[44px]"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => handleDownload(result.pdf_url!, "research-report.pdf")}
                        disabled={isDownloading === "research-report.pdf"}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-hover hover:bg-border rounded-lg transition-all active:scale-95 text-sm font-medium min-h-[44px]"
                      >
                        {isDownloading === "research-report.pdf" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                )}
                {result.deliverables?.map((deliverable, index) => (
                  <div key={index} className="p-3 sm:p-4 bg-surface rounded-lg border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      {getFileIcon(deliverable.type)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm sm:text-base truncate">{getFileLabel(deliverable.type)}</div>
                        <div className="text-xs text-text-muted">
                          {deliverable.type.toUpperCase()} File
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleView(deliverable.url, deliverable.type, getFileLabel(deliverable.type))}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all active:scale-95 text-sm font-medium min-h-[44px]"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() =>
                          handleDownload(deliverable.url, `${deliverable.title}.${deliverable.type}`)
                        }
                        disabled={isDownloading === `${deliverable.title}.${deliverable.type}`}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-hover hover:bg-border rounded-lg transition-all active:scale-95 text-sm font-medium min-h-[44px]"
                      >
                        {isDownloading === `${deliverable.title}.${deliverable.type}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">
                Sources ({result.sources.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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

          {/* Research Output - uses marked for fast HTML rendering (not ReactMarkdown) */}
          {result.output && (
            <div className="card">
              <button
                onClick={() => setShowReport(!showReport)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                  Research Findings
                </h3>
                {showReport ? (
                  <ChevronUp className="w-5 h-5 text-text-muted" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-text-muted" />
                )}
              </button>
              {showReport && (
                <div
                  className="mt-4 prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-text-muted prose-a:text-primary prose-strong:text-foreground"
                  dangerouslySetInnerHTML={{ __html: reportHtml }}
                />
              )}
            </div>
          )}

          {/* Usage stats */}
          {result.usage && (
            <div className="card">
              <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Research Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center p-3 bg-surface rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-primary">
                    {result.usage.search_units}
                  </div>
                  <div className="text-[10px] sm:text-xs text-text-muted">Search Units</div>
                </div>
                <div className="text-center p-3 bg-surface rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-primary">
                    {result.usage.ai_units}
                  </div>
                  <div className="text-[10px] sm:text-xs text-text-muted">AI Units</div>
                </div>
                <div className="text-center p-3 bg-surface rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-primary">
                    {result.usage.compute_units}
                  </div>
                  <div className="text-[10px] sm:text-xs text-text-muted">Compute Units</div>
                </div>
                <div className="text-center p-3 bg-surface rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-accent">
                    ${result.usage.total_cost.toFixed(2)}
                  </div>
                  <div className="text-[10px] sm:text-xs text-text-muted">Total Cost</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="card bg-error/5 border-error/30">
          <div className="flex flex-col items-center text-center py-6 sm:py-8 px-4">
            <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-error mb-4" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">
              {result.status === "cancelled" ? "Research Cancelled" : "Research Failed"}
            </h2>
            <p className="text-sm sm:text-base text-text-muted mb-6 max-w-md">
              {result.error || "An unexpected error occurred during research."}
            </p>
            <button onClick={onReset} className="btn-primary flex items-center gap-2 min-h-[44px]">
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
