"use client";

import { useState, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  X,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  Download,
  FileText,
  Presentation,
} from "lucide-react";

interface FileViewerProps {
  url: string;
  fileType: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SheetData {
  name: string;
  data: unknown[][];
}

export default function FileViewer({
  url,
  fileType,
  title,
  isOpen,
  onClose,
}: FileViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<unknown[][] | null>(null);
  const [xlsxData, setXlsxData] = useState<SheetData[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  const normalizedType = fileType.toLowerCase();
  const isPdf = normalizedType === "pdf";
  const isOfficeFile = ["docx", "pptx", "doc", "ppt"].includes(normalizedType);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    setCsvData(null);
    setXlsxData(null);
    setActiveSheet(0);
    setPdfBlobUrl(null);

    let createdBlobUrl: string | null = null;

    const loadFile = async () => {
      try {
        if (isPdf) {
          // Fetch PDF as blob for native browser rendering
          // Office Online Viewer can't handle pre-signed S3 URLs
          const response = await fetch(url);
          if (!response.ok) throw new Error("Failed to fetch PDF file");
          const blob = await response.blob();
          createdBlobUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(createdBlobUrl);
          setLoading(false);
        } else if (normalizedType === "csv") {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Failed to fetch CSV file");
          const text = await response.text();

          Papa.parse(text, {
            complete: (results) => {
              setCsvData(results.data as unknown[][]);
              setLoading(false);
            },
            error: (err: Error) => {
              setError(err.message);
              setLoading(false);
            },
            skipEmptyLines: true,
          });
        } else if (["xlsx", "xls"].includes(normalizedType)) {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Failed to fetch Excel file");
          const arrayBuffer = await response.arrayBuffer();

          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          const sheets: SheetData[] = workbook.SheetNames.map((name) => ({
            name,
            data: XLSX.utils.sheet_to_json(workbook.Sheets[name], {
              header: 1,
            }) as unknown[][],
          }));

          setXlsxData(sheets);
          setLoading(false);
        } else if (isOfficeFile) {
          // DOCX, PPTX loaded via Microsoft Office Online Viewer
          setLoading(false);
        } else {
          setError(`Unsupported file type: ${fileType}`);
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file");
        setLoading(false);
      }
    };

    loadFile();

    return () => {
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [isOpen, url, normalizedType, fileType, isPdf, isOfficeFile]);

  if (!isOpen) return null;

  const getOfficeViewerUrl = () => {
    const encodedUrl = encodeURIComponent(url);
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = title || "deliverable";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const getFileIcon = () => {
    switch (normalizedType) {
      case "xlsx":
      case "xls":
      case "csv":
        return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
      case "pptx":
      case "ppt":
        return <Presentation className="w-5 h-5 text-orange-600" />;
      case "docx":
      case "doc":
        return <FileText className="w-5 h-5 text-blue-600" />;
      case "pdf":
        return <FileText className="w-5 h-5 text-red-600" />;
      default:
        return <FileText className="w-5 h-5 text-primary" />;
    }
  };

  const renderSpreadsheetTable = (data: unknown[][]) => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-text-muted">
          No data available
        </div>
      );
    }

    const headers = data[0] || [];
    const rows = data.slice(1);
    const displayRows = rows.slice(0, 100); // Limit to 100 rows for performance
    const hasMore = rows.length > 100;

    return (
      <div className="w-full h-full overflow-auto bg-background">
        {hasMore && (
          <div className="p-3 text-sm text-text-muted bg-surface border-b border-border">
            Showing first 100 rows of {rows.length} total rows
          </div>
        )}
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface z-10">
            <tr>
              {(headers as unknown[]).map((header, i) => (
                <th
                  key={i}
                  className="border border-border px-3 py-2 text-left font-semibold bg-surface whitespace-nowrap"
                >
                  {String(header ?? "") || `Column ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-surface/50">
                {(row as unknown[]).map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border border-border px-3 py-2 whitespace-nowrap"
                  >
                    {String(cell ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-text-muted">Loading file...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <AlertCircle className="w-12 h-12 text-error" />
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Failed to Load</h3>
            <p className="text-sm text-text-muted max-w-md">{error}</p>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download File Instead
          </button>
        </div>
      );
    }

    // PDF - Use native browser PDF viewer via blob URL
    if (isPdf && pdfBlobUrl) {
      return (
        <iframe
          src={pdfBlobUrl}
          className="w-full h-full border-0 rounded-lg"
          title={title || "PDF Preview"}
        />
      );
    }

    // DOCX, PPTX - Use Microsoft Office Online Viewer
    if (isOfficeFile) {
      return (
        <iframe
          src={getOfficeViewerUrl()}
          className="w-full h-full border-0 rounded-lg"
          title={title || "Document Preview"}
          allowFullScreen
        />
      );
    }

    // CSV viewer
    if (normalizedType === "csv" && csvData) {
      return renderSpreadsheetTable(csvData);
    }

    // Excel viewer with sheet tabs
    if (xlsxData) {
      return (
        <div className="flex flex-col h-full">
          {/* Sheet tabs */}
          {xlsxData.length > 1 && (
            <div className="flex gap-1 px-4 pt-3 pb-2 border-b border-border bg-surface overflow-x-auto">
              {xlsxData.map((sheet, index) => (
                <button
                  key={sheet.name}
                  onClick={() => setActiveSheet(index)}
                  className={`px-3 py-1.5 text-sm rounded whitespace-nowrap transition-colors ${
                    activeSheet === index
                      ? "bg-primary text-white font-medium"
                      : "bg-surface-hover text-text-muted hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
          )}
          {/* Sheet content */}
          <div className="flex-1 overflow-auto">
            {renderSpreadsheetTable(xlsxData[activeSheet]?.data || [])}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        Unable to preview this file type
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - 95vw x 90vh as recommended */}
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-[95vw] max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            {getFileIcon()}
            <h2 className="font-semibold truncate max-w-md">{title}</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded uppercase">
              {fileType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-surface hover:bg-surface-hover rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface rounded-lg transition-colors"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">{renderContent()}</div>
      </div>
    </div>
  );
}
