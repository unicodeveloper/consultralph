"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { marked } from "marked";
import {
  CheckCircle,
  XCircle,
  FileText,
  FileSpreadsheet,
  File,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Globe,
  BookOpen,
  Eye,
  Presentation,
  Maximize2,
  X,
} from "lucide-react";
import ResearchActivityFeed from "./ResearchActivityFeed";

// Lazy-load FileViewer to avoid bundling papaparse + xlsx eagerly
const FileViewer = dynamic(() => import("./FileViewer"), { ssr: false });

interface ViewerState {
  isOpen: boolean;
  url: string;
  fileType: string;
  title: string;
}

interface ResearchResultsProps {
  result: {
    status: string;
    task_id: string;
    output?: string;
    sources?: Array<{ title: string; url: string }>;
    pdf_url?: string;
    deliverables?: Array<{ type: string; title: string; url: string }>;
    progress?: { current_step: number; total_steps: number };
    messages?: Array<{ role: string; content: string | Array<Record<string, unknown>> }>;
    error?: string;
  } | null;
  onCancel: () => void;
  onReset: () => void;
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
  const [showReport, setShowReport] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [reportFullscreen, setReportFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerState>({
    isOpen: false,
    url: "",
    fileType: "",
    title: "",
  });

  // Only compute HTML when report is expanded - avoids work on initial render
  const reportHtml = useMemo(() => {
    if (!showReport || !result?.output) return "";
    return marked(result.output, { gfm: true, breaks: true }) as string;
  }, [showReport, result?.output]);

  if (!result) return null;

  const isComplete = result.status === "completed";
  const isInProgress = result.status === "queued" || result.status === "running";
  const isFailed = result.status === "failed" || result.status === "cancelled";

  const progressPercent = isComplete
    ? 100
    : result.progress
      ? Math.round((result.progress.current_step / result.progress.total_steps) * 100)
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

  return (
    <div className="space-y-4 min-w-0">
      {/* File Viewer Modal */}
      <FileViewer
        url={viewer.url}
        fileType={viewer.fileType}
        title={viewer.title}
        isOpen={viewer.isOpen}
        onClose={closeViewer}
      />

      {/* Research intro - shown while in progress */}
      {isInProgress && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
          <span className="text-sm font-medium text-foreground">Agent researching your topic</span>
          <p className="text-sm text-text-muted">
            Generating report and deliverables (PowerPoint, Excel, Word). Expected around 5-10 minutes.
          </p>
        </div>
      )}

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
          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden border border-border/40">
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
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-hover transition-colors text-text-muted"
        >
          Cancel Research
        </button>
      )}

      {/* Completed results */}
      {isComplete && (
        <div className="space-y-4">
          {/* Deliverables with View/Download */}
          {(result.deliverables?.length || result.pdf_url) && (() => {
            const allDeliverables = [
              ...(result.pdf_url
                ? [{ type: "pdf", title: "research-report", url: result.pdf_url }]
                : []),
              ...(result.deliverables ?? []),
            ];
            return (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Deliverables
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allDeliverables.map((deliverable, index) => {
                    const filename = `${deliverable.title}.${deliverable.type}`;
                    return (
                      <div key={index} className="p-3 sm:p-4 bg-surface rounded-lg border border-border">
                        <div className="flex items-center gap-3 mb-3">
                          {getFileIcon(deliverable.type)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{getFileLabel(deliverable.type)}</div>
                            <div className="text-xs text-text-muted">
                              {deliverable.type.toUpperCase()} File
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleView(deliverable.url, deliverable.type, getFileLabel(deliverable.type))}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all text-sm font-medium min-h-[44px]"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          <button
                            onClick={() => handleDownload(deliverable.url, filename)}
                            disabled={isDownloading === filename}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-surface-hover hover:bg-border rounded-lg transition-all text-sm font-medium min-h-[44px]"
                          >
                            {isDownloading === filename ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            Download
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Full Report (collapsible, with CSS containment + scroll constraint) */}
          {result.output && (
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowReport(!showReport)}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Full Report</span>
                  {showReport ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showReport && (
                  <button
                    onClick={() => setReportFullscreen(true)}
                    className="p-1 rounded hover:bg-surface-hover transition-colors text-text-muted hover:text-foreground"
                    title="Full screen"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {showReport && (
                <div
                  className="mt-3 rounded-lg border border-border bg-surface max-h-[70vh] overflow-y-auto overflow-x-hidden"
                  style={{ contain: "layout" }}
                >
                  <div
                    className="p-4 sm:p-6 prose prose-sm max-w-none dark:prose-invert break-words"
                    style={{ overflowWrap: "anywhere" }}
                    dangerouslySetInnerHTML={{ __html: reportHtml }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Full-screen report modal */}
          {reportFullscreen && reportHtml && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setReportFullscreen(false)}
              />
              <div className="relative bg-background border border-border rounded-xl shadow-2xl w-[95vw] max-w-5xl h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold">Full Report</h2>
                  </div>
                  <button
                    onClick={() => setReportFullscreen(false)}
                    className="p-2 hover:bg-surface rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  <div
                    className="p-6 sm:p-8 prose prose-sm max-w-none dark:prose-invert break-words"
                    style={{ overflowWrap: "anywhere" }}
                    dangerouslySetInnerHTML={{ __html: reportHtml }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sources (collapsible) */}
          {result.sources && result.sources.length > 0 && (
            <div>
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>{result.sources.length} Sources</span>
                {showSources ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {showSources && (
                <div className="mt-2 space-y-1.5">
                  {result.sources.map((source, i) => {
                    let domain = "";
                    try {
                      domain = new URL(source.url).hostname.replace("www.", "");
                    } catch {
                      domain = source.url;
                    }
                    return (
                      <a
                        key={i}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-surface hover:bg-surface-hover border border-border/60 hover:border-primary/40 group transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                          alt=""
                          className="w-4 h-4 rounded-sm flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <span className="text-sm text-text-muted group-hover:text-primary transition-colors truncate flex-1">
                          {source.title || domain}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-primary" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              New Research
            </button>
          </div>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-medium text-red-500">Research Failed</h3>
          </div>
          <p className="text-sm text-text-muted">{result.error || "An unknown error occurred"}</p>
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
