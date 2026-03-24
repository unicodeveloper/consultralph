"use client";

import { FileText } from "lucide-react";
import { FileIcon, defaultStyles } from "react-file-icon";

interface ExampleReport {
  id: string;
  title: string;
  description: string;
  type: string;
}

const EXAMPLE_REPORTS: ExampleReport[] = [
  {
    id: "9f6e487a-e6c8-4e8a-a7fa-edbbfb3c3969",
    title: "SpaceX Acquisition of xAI",
    description: "Deep research into SpaceX's acquisition of xAI, strategic rationale, valuation, and market implications",
    type: "Due Diligence",
  },
  {
    id: "190efe90-f58e-447b-b1f4-40ad90fe8096",
    title: "Space Data Centres",
    description: "Comprehensive analysis of the space data centre market, key players, technology feasibility, and growth drivers",
    type: "Market Analysis",
  },
];

const FILE_TYPES = [
  { ext: "pdf", styles: defaultStyles.pdf },
  { ext: "pptx", styles: defaultStyles.pptx },
  { ext: "csv", styles: { ...defaultStyles.csv, color: "#1A754C", foldColor: "#16613F", glyphColor: "rgba(255,255,255,0.4)", labelColor: "#1A754C", labelUppercase: true } },
  { ext: "docx", styles: defaultStyles.docx },
];

interface ExampleReportsProps {
  onSelectExample: (taskId: string, title: string) => void;
}

export default function ExampleReports({ onSelectExample }: ExampleReportsProps) {
  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="h-px flex-1 max-w-12 bg-border" />
        <p className="text-xs text-text-muted">
          View completed example reports
        </p>
        <div className="h-px flex-1 max-w-12 bg-border" />
      </div>
      <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2.5">
        {EXAMPLE_REPORTS.map((report) => (
          <button
            key={report.id}
            onClick={() => onSelectExample(report.id, report.title)}
            className="group flex flex-col gap-2 px-5 py-3 rounded-xl border border-border/70 bg-surface/60 backdrop-blur-sm hover:bg-surface-hover hover:border-primary/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {report.title}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-300 bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 rounded-md">
                {report.type}
              </span>
            </div>
            <div className="flex items-center gap-2 pl-6.5">
              {FILE_TYPES.map(({ ext, styles }) => (
                <div key={ext} className="w-4">
                  <FileIcon extension={ext} {...styles} />
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
