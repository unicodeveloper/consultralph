"use client";

import React, { useMemo, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { Favicon } from "@/app/components/ui/Favicon";

interface MarkdownRendererProps {
  content: string;
  inlineCitations?: boolean;
  className?: string;
}

interface CitationLink {
  text: string;
  link: string;
}

const isValidUrl = (str: string) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

const extractSourceName = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const parts = hostname.replace(/^www\./, "").split(".");
    if (parts.length >= 2) {
      const domain = parts[parts.length - 2];
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
    return hostname;
  } catch {
    return url;
  }
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  inlineCitations = false,
  className = "",
}) => {
  const citationLinks = useMemo<CitationLink[]>(() => {
    if (!inlineCitations) return [];
    if (!content || typeof content !== "string") return [];

    const links = new Set<string>();
    const linkMatches = Array.from(
      content.matchAll(/\[(\[[^\]]*\]|[^\]]*)\]\(([^)]+)\)/g)
    );

    return linkMatches
      .map(([, text, link]) => ({ text, link }))
      .filter((item) => {
        if (links.has(item.link)) return false;
        if (!isValidUrl(item.link)) return false;
        links.add(item.link);
        return true;
      });
  }, [content, inlineCitations]);

  const renderInlineCitation = useCallback((href: string, linkText?: React.ReactNode) => {
    const sourceName = extractSourceName(href);
    const stableKey = `citation-${href.replace(/[^a-zA-Z0-9]/g, "")}`;

    const textContent = typeof linkText === "string" ? linkText :
      (Array.isArray(linkText) ? linkText.join("") : String(linkText || ""));
    const citationMatch = textContent.match(/^\[?\[?(\d+)\]?\]?$/);
    const citationNumber = citationMatch ? citationMatch[1] : null;

    return (
      <Link
        key={stableKey}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="not-prose inline-flex items-center gap-1 text-[11px] font-medium text-foreground h-[20px] px-2 bg-gray-100 dark:bg-gray-800 border border-border rounded-full no-underline hover:bg-accent transition-colors whitespace-nowrap"
        style={{ verticalAlign: "baseline" }}
      >
        <Favicon url={href} size={14} className="w-3.5 h-3.5" />
        <span>{sourceName}</span>
        {citationNumber && (
          <span className="text-[10px] text-muted-foreground ml-0.5">[{citationNumber}]</span>
        )}
      </Link>
    );
  }, []);

  const processedContent = useMemo(() => {
    if (!content) return "";
    const stringContent = typeof content === "string" ? content : String(content);

    let processed = stringContent;
    if (processed.startsWith("Content: ")) {
      processed = processed.substring("Content: ".length);
    }

    // Ensure blank lines between consecutive citations for proper markdown rendering
    const lines = processed.split(/\r?\n/);
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isCitation =
        /^\[\d+\]/.test(line.trim()) || /^\[Report\s+\d+\]:/.test(line.trim());

      if (isCitation && i > 0) {
        let prevNonEmptyIndex = i - 1;
        while (prevNonEmptyIndex >= 0 && lines[prevNonEmptyIndex].trim() === "") {
          prevNonEmptyIndex--;
        }

        if (prevNonEmptyIndex >= 0) {
          const prevNonEmptyLine = lines[prevNonEmptyIndex];
          const prevIsCitation =
            /^\[\d+\]/.test(prevNonEmptyLine.trim()) ||
            /^\[Report\s+\d+\]:/.test(prevNonEmptyLine.trim());
          const blankLinesBetween = i - prevNonEmptyIndex - 1;

          if (prevIsCitation && blankLinesBetween === 0) {
            processedLines.push("");
          }
        }
      }

      processedLines.push(line);
    }

    return processedLines.join("\n");
  }, [content]);

  const customComponents = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseComponents: any = {
      a: (props: { href?: string; children?: React.ReactNode }) => {
        const href = props.href || "#";
        const children = props.children;

        if (inlineCitations && isValidUrl(href)) {
          const isCitation = citationLinks.some((link) => link.link === href);
          if (isCitation) {
            return renderInlineCitation(href, children);
          }
        }

        return (
          <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 no-underline hover:underline break-words"
          >
            {children}
          </Link>
        );
      },
      table: (props: { children?: React.ReactNode }) => (
        <div className="overflow-x-auto">
          <table className="w-full">{props.children}</table>
        </div>
      ),
      pre: (props: { children?: React.ReactNode }) => (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words">
          {props.children}
        </pre>
      ),
    };

    return baseComponents;
  }, [inlineCitations, citationLinks, renderInlineCitation]);

  return (
    <div
      className={`markdown-content prose prose-sm dark:prose-invert max-w-none overflow-hidden ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={customComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default memo(MarkdownRenderer, (prevProps, nextProps) => {
  return (
    prevProps.content === nextProps.content &&
    prevProps.inlineCitations === nextProps.inlineCitations &&
    prevProps.className === nextProps.className
  );
});
