"use client";

import { FileText, ArrowRight } from "lucide-react";

interface ExampleReport {
  id: string;
  title: string;
  description: string;
  type: string;
}

const EXAMPLE_REPORTS: ExampleReport[] = [
  {
    id: "9a637dbb-39b9-4450-ac30-af76c333fcd1",
    title: "AI Infrastructure Market Analysis",
    description: "Deep market analysis of AI infrastructure companies, competitive landscape, and growth drivers",
    type: "Market Analysis",
  },
  {
    id: "7d497a3b-e272-4b60-bf9d-de71af0830f5",
    title: "Enterprise SaaS Due Diligence",
    description: "Comprehensive due diligence report covering financials, risks, and strategic positioning",
    type: "Due Diligence",
  },
];

interface ExampleReportsProps {
  onSelectExample: (taskId: string, title: string) => void;
}

export default function ExampleReports({ onSelectExample }: ExampleReportsProps) {
  return (
    <div className="w-full max-w-2xl mt-6">
      <p className="text-xs text-text-muted text-center mb-3">
        See what you get - view completed example reports
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EXAMPLE_REPORTS.map((report) => (
          <button
            key={report.id}
            onClick={() => onSelectExample(report.id, report.title)}
            className="group text-left p-4 rounded-lg border border-border bg-surface hover:bg-surface-hover hover:border-primary/40 transition-all"
          >
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
                    {report.type}
                  </span>
                </div>
                <h4 className="text-sm font-medium text-foreground leading-tight mb-1">
                  {report.title}
                </h4>
                <p className="text-xs text-text-muted line-clamp-2">
                  {report.description}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
