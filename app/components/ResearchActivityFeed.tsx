"use client";

import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Wrench,
  CornerDownRight,
  User,
  ExternalLink,
  ArrowDown,
} from "lucide-react";

// --- Types ---

interface TextContent {
  type: "text";
  text: string;
}

interface ToolCall {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

interface ToolResult {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: unknown;
}

type MessageContent = TextContent | ToolCall | ToolResult;

interface Message {
  role: string;
  content: string | MessageContent[] | Array<Record<string, unknown>>;
}

type TimelineItem =
  | { type: "text"; text: string; index: number }
  | { type: "user"; text: string; index: number }
  | {
      type: "tool";
      toolCallId: string;
      call: ToolCall;
      result?: ToolResult;
      index: number;
    };

interface ResearchActivityFeedProps {
  messages?: Message[];
  isRunning: boolean;
}

// --- Helpers ---

function getMessageSignature(messages: Message[] | undefined): string {
  if (!messages || messages.length === 0) return "0-none-0";
  const length = messages.length;
  const lastRole = messages[length - 1]?.role || "unknown";
  let contentSize = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      contentSize += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      contentSize += msg.content.length;
    }
  }
  return `${length}-${lastRole}-${contentSize}`;
}

function extractSources(output: unknown): Array<{ title: string; url: string }> {
  if (!output || typeof output !== "object") return [];
  let obj = output as Record<string, unknown>;

  // Unwrap nested { type: "json", value: { sources: [...] } } format from Valyu API
  if (obj.type === "json" && obj.value && typeof obj.value === "object") {
    obj = obj.value as Record<string, unknown>;
  }

  // Check for sources array
  if (Array.isArray(obj.sources)) {
    return obj.sources
      .filter((s: unknown) => s && typeof s === "object" && (s as Record<string, unknown>).url)
      .map((s: unknown) => {
        const source = s as Record<string, string>;
        return { title: source.title || source.url, url: source.url };
      });
  }

  // Check for results array (common in search tool outputs)
  if (Array.isArray(obj.results)) {
    return obj.results
      .filter((r: unknown) => r && typeof r === "object" && (r as Record<string, unknown>).url)
      .map((r: unknown) => {
        const result = r as Record<string, string>;
        return { title: result.title || result.url, url: result.url };
      });
  }

  return [];
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function getToolQuery(input: Record<string, unknown>): string | null {
  const queryKeys = ["query", "objective", "search_query", "q", "input", "question"];
  for (const key of queryKeys) {
    if (typeof input[key] === "string") return input[key] as string;
  }
  return null;
}

// --- Memoized Sub-Components ---

const ReasoningItem = React.memo(
  function ReasoningItem({ text }: { text: string }) {
    return (
      <div className="activity-item-enter rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-medium text-blue-400">Reasoning</span>
        </div>
        <div className="prose prose-sm max-w-none prose-invert text-sm text-text-muted leading-relaxed overflow-hidden break-words min-w-0" style={{ overflowWrap: "anywhere" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      </div>
    );
  },
  (prev, next) => prev.text === next.text
);

const UserMessageItem = React.memo(
  function UserMessageItem({ text }: { text: string }) {
    const isFollowUp = text.includes("FOLLOW-UP INSTRUCTION:");
    const cleanText = text
      .replace(/\*?\*?FOLLOW-UP INSTRUCTION:\*?\*?/g, "")
      .trim();

    return (
      <div className="activity-item-enter rounded-lg border border-neutral-500/20 bg-neutral-500/5 p-3 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-xs font-medium text-neutral-400">
            {isFollowUp ? "Follow-up Instruction" : "User Message"}
          </span>
        </div>
        <p className="text-sm text-text-muted">{cleanText}</p>
      </div>
    );
  },
  (prev, next) => prev.text === next.text
);

const ToolCallItem = React.memo(
  function ToolCallItem({
    call,
    result,
  }: {
    toolCallId: string;
    call: ToolCall;
    result?: ToolResult;
  }) {
    const hasResult = !!result;
    const sources = hasResult ? extractSources(result.output) : [];
    const query = getToolQuery(call.input);

    return (
      <div
        className={`activity-item-enter rounded-lg border p-3 min-w-0 overflow-hidden ${
          hasResult
            ? "border-green-500/20 bg-green-500/5"
            : "border-yellow-500/20 bg-yellow-500/5"
        }`}
      >
        {/* Tool header */}
        <div className="flex items-center gap-2 min-w-0">
          <Wrench className={`w-3.5 h-3.5 flex-shrink-0 ${hasResult ? "text-green-400" : "text-yellow-400 animate-pulse"}`} />
          <span className={`text-xs font-medium ${hasResult ? "text-green-400" : "text-yellow-400"}`}>
            {formatToolName(call.toolName)}
          </span>
          {!hasResult && (
            <span className="text-xs text-yellow-400/60">Running...</span>
          )}
        </div>

        {/* Query */}
        {query && (
          <p className="text-xs text-text-muted mt-1.5 truncate min-w-0">
            &quot;{query}&quot;
          </p>
        )}

        {/* Sources inline (like platform) */}
        {hasResult && sources.length > 0 && (
          <div className="flex gap-2.5 pl-1 mt-2 min-w-0">
            <div className="flex items-start">
              <CornerDownRight className="h-4 w-4 text-green-400/40 flex-shrink-0" />
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="text-[10px] font-medium text-green-400 uppercase tracking-wide">
                {sources.length} {sources.length === 1 ? "Source" : "Sources"} Found
              </div>
              {sources.map((source, i) => {
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
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-surface hover:bg-surface-hover border border-border/60 hover:border-primary/40 group transition-all min-w-0"
                    onClick={(e) => e.stopPropagation()}
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
                    <span className="text-xs text-text-muted flex-1 group-hover:text-primary transition-colors truncate min-w-0">
                      {source.title || domain}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-primary" />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.toolCallId === next.toolCallId &&
    prev.call.toolName === next.call.toolName &&
    !!prev.result === !!next.result
);

// --- Main Component ---

export default function ResearchActivityFeed({
  messages,
  isRunning,
}: ResearchActivityFeedProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Parse messages into timeline using signature-based memoization
  const messageSignature = getMessageSignature(messages);

  const timeline = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const toolCallMap = new Map<
      string,
      { call: ToolCall; result?: ToolResult; index: number }
    >();
    const textBlocks: Array<{ text: string; index: number }> = [];
    const userMessages: Array<{ text: string; index: number }> = [];
    let messageIndex = 0;
    let hasSeenAssistantMessage = false;

    // First pass: collect content
    for (const message of messages) {
      if (message.role === "assistant") {
        hasSeenAssistantMessage = true;
        if (Array.isArray(message.content)) {
          for (const item of message.content as MessageContent[]) {
            if (item.type === "text" || item.type === "reasoning" as string) {
              textBlocks.push({ text: (item as TextContent).text, index: messageIndex++ });
            } else if (item.type === "tool-call") {
              toolCallMap.set(item.toolCallId, {
                call: item as ToolCall,
                index: messageIndex++,
              });
            }
          }
        } else if (typeof message.content === "string") {
          textBlocks.push({ text: message.content, index: messageIndex++ });
        }
      } else if (message.role === "user" && hasSeenAssistantMessage) {
        if (Array.isArray(message.content)) {
          for (const item of message.content as MessageContent[]) {
            if (item.type === "text") {
              userMessages.push({ text: item.text, index: messageIndex++ });
            }
          }
        } else if (typeof message.content === "string") {
          userMessages.push({ text: message.content, index: messageIndex++ });
        }
      } else {
        messageIndex++;
      }
    }

    // Second pass: attach tool results
    for (const message of messages) {
      if (message.role === "tool" && Array.isArray(message.content)) {
        for (const item of message.content as MessageContent[]) {
          if (item.type === "tool-result") {
            const existing = toolCallMap.get((item as ToolResult).toolCallId);
            if (existing) {
              existing.result = item as ToolResult;
            }
          }
        }
      }
    }

    // Build timeline
    const items: TimelineItem[] = [
      ...userMessages.map((block) => ({ type: "user" as const, ...block })),
      ...textBlocks.map((block) => ({ type: "text" as const, ...block })),
      ...Array.from(toolCallMap.entries()).map(([toolCallId, toolData]) => ({
        type: "tool" as const,
        toolCallId,
        call: toolData.call,
        result: toolData.result,
        index: toolData.index,
      })),
    ];

    items.sort((a, b) => a.index - b.index);
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageSignature]);

  // Count stats for collapsed summary
  const stats = useMemo(() => {
    let steps = 0;
    let sources = 0;
    for (const item of timeline) {
      steps++;
      if (item.type === "tool" && item.result) {
        sources += extractSources(item.result.output).length;
      }
    }
    return { steps, sources };
  }, [timeline]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isExpanded && isRunning && !userScrolledUp && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [timeline.length, isExpanded, isRunning, userScrolledUp]);

  // Detect user scrolling up
  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
    setUserScrolledUp(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
      setUserScrolledUp(false);
    }
  }, []);

  if (timeline.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-4 min-w-0 overflow-hidden" style={{ contain: "inline-size" }}>
      {/* Collapsed header / toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-surface border border-border hover:bg-surface-hover transition-colors text-left min-w-0 overflow-hidden"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Activity Feed</span>
          <span className="text-xs text-text-muted">
            {stats.steps} step{stats.steps !== 1 ? "s" : ""}
            {stats.sources > 0 && `, ${stats.sources} source${stats.sources !== 1 ? "s" : ""}`}
          </span>
          {isRunning && (
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400">Live</span>
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {/* Expanded feed */}
      {isExpanded && (
        <div className="relative mt-2 min-w-0 overflow-hidden">
          <div
            ref={feedRef}
            onScroll={handleScroll}
            className="max-h-[400px] overflow-y-auto overflow-x-hidden space-y-3 pr-1 activity-feed-scroll min-w-0"
          >
            {timeline.map((item) => {
              if (item.type === "user") {
                return (
                  <UserMessageItem
                    key={`user-${item.index}`}
                    text={item.text}
                  />
                );
              } else if (item.type === "text") {
                return (
                  <ReasoningItem
                    key={`text-${item.index}`}
                    text={item.text}
                  />
                );
              } else {
                return (
                  <ToolCallItem
                    key={`tool-${item.toolCallId}`}
                    toolCallId={item.toolCallId}
                    call={item.call}
                    result={item.result}
                  />
                );
              }
            })}
            <div ref={bottomRef} />
          </div>

          {/* Scroll to bottom button */}
          {userScrolledUp && isRunning && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-2 right-4 flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-medium shadow-lg hover:bg-primary/90 transition-colors"
            >
              <ArrowDown className="w-3 h-3" />
              Latest
            </button>
          )}
        </div>
      )}
    </div>
  );
}
