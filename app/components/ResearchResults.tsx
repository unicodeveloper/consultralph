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
  Eye,
} from "lucide-react";
import FileViewer from "./FileViewer";
import ResearchActivityFeed from "./ResearchActivityFeed";

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
  messages?: Array<{
    role: string;
    content: string | Array<Record<string, unknown>>;
  }>;
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

  // If completed but no data yet, treat as loading
  const isLoadingData = isComplete && !result.deliverables && !result.pdf_url && !result.output;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* File Viewer Modal */}
      <FileViewer
        url={viewer.url}
        fileType={viewer.fileType}
        title={viewer.title}
        isOpen={viewer.isOpen}
        onClose={closeViewer}
      />

      {/* Status Header */}
      {(isInProgress || isLoadingData) && (
        <div className="card">
          <div className="flex flex-col items-center text-center">
            {/* Status + Progress Bar */}
            <div className="flex items-center gap-3 mb-4 w-full max-w-lg">
              <Clock className="w-5 h-5 text-primary animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm sm:text-base font-semibold">
                    {getStatusMessage(result?.status || "queued")}
                  </h2>
                  {result?.progress && (
                    <span className="text-xs text-text-muted">
                      Step {result.progress.current_step}/{result.progress.total_steps}
                    </span>
                  )}
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary progress-bar transition-all duration-700 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="w-full">
              <ResearchActivityFeed
                messages={result?.messages}
                isRunning={isInProgress && !isLoadingData}
              />
            </div>

            {/* Cancel Button */}
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="btn-secondary mt-6 flex items-center gap-2 min-h-[44px]"
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
          </div>
        </div>
      )}

      {/* Completed State */}
      {isComplete && (
        <>
          {/* Success Header */}
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

          {/* Deliverables */}
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
                        <div className="font-medium text-sm sm:text-base">{getFileLabel(deliverable.type)}</div>
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
                          handleDownload(
                            deliverable.url,
                            `${deliverable.title}.${deliverable.type}`
                          )
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

          {/* Research Output */}
          {result.output && (
            <div className="card">
              <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Research Findings</h3>
              <div className="prose prose-sm sm:prose-base max-w-none">
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
              <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Sources ({result.sources.length})</h3>
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

          {/* Usage Stats */}
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

      {/* Failed State */}
      {isFailed && (
        <div className="card bg-error/5 border-error/30">
          <div className="flex flex-col items-center text-center py-6 sm:py-8 px-4">
            <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-error mb-4" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">
              {result?.status === "cancelled"
                ? "Research Cancelled"
                : "Research Failed"}
            </h2>
            <p className="text-sm sm:text-base text-text-muted mb-6 max-w-md">
              {result?.error || "An unexpected error occurred during research."}
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
