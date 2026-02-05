"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  TrendingUp,
  Users,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  HelpCircle,
  Sun,
  Moon,
  BookOpen,
  History,
  Trash2,
  Clock,
  CheckCircle,
  Loader2,
  XCircle,
  Plus,
  Lock,
} from "lucide-react";
import {
  getResearchHistory,
  removeFromHistory,
  clearHistory,
  ResearchHistoryItem,
} from "@/app/lib/researchHistory";
import { useAuthStore } from "@/app/stores/auth-store";
import { useThemeStore } from "@/app/stores/theme-store";

const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "self-hosted";

interface SidebarProps {
  onSelectHistory?: (item: ResearchHistoryItem) => void;
  onNewResearch?: () => void;
  currentResearchId?: string | null;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const bottomItems = [
  { icon: BookOpen, label: "Documentation", href: "https://docs.valyu.ai/guides/deepresearch-quickstart" },
  { icon: HelpCircle, label: "Help & Support", href: "https://discord.gg/8TCbHsSe" },
];

export default function Sidebar({
  onSelectHistory,
  onNewResearch,
  currentResearchId,
  isCollapsed: controlledCollapsed,
  onCollapsedChange,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(true);

  // Use controlled state if provided, otherwise use internal state
  const isCollapsed = controlledCollapsed ?? internalCollapsed;
  const setIsCollapsed = (value: boolean) => {
    setInternalCollapsed(value);
    onCollapsedChange?.(value);
  };
  const [history, setHistory] = useState<ResearchHistoryItem[]>([]);

  const { isAuthenticated, openSignInModal } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  // In Valyu mode, require auth to view history
  const isValyuMode = APP_MODE === "valyu";
  const canViewHistory = !isValyuMode || isAuthenticated;

  // Load history on mount and when localStorage changes
  useEffect(() => {
    const loadHistory = () => {
      setHistory(getResearchHistory());
    };

    loadHistory();

    // Listen for storage changes (from other tabs or updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "consulting_research_history") {
        loadHistory();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Also set up an interval to check for updates from the same tab
    const interval = setInterval(loadHistory, 2000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleRemoveItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromHistory(id);
    setHistory(getResearchHistory());
  };

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear all research history?")) {
      clearHistory();
      setHistory([]);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case "processing":
      case "queued":
        return <Loader2 className="w-3 h-3 text-primary animate-spin" />;
      case "failed":
      case "cancelled":
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Clock className="w-3 h-3 text-text-muted" />;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "company":
        return Building2;
      case "market":
        return TrendingUp;
      case "competitive":
        return Users;
      case "industry":
        return FileText;
      default:
        return Search;
    }
  };

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-border bg-surface transition-all duration-300 h-screen sticky top-0 z-20 ${
        isCollapsed ? "w-16" : "w-72"
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-sm">Consulting Intel</span>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4 text-text-muted" />
            </button>
          )}
        </div>
      </div>

      {/* New Research Button */}
      {!isCollapsed && isAuthenticated && (
        <div className="p-2 border-b border-border">
          <button
            onClick={onNewResearch}
            className="w-full flex items-center justify-center gap-2 p-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Research</span>
          </button>
        </div>
      )}

      {/* History Header */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
            <History className="w-4 h-4" />
            <span>Research History</span>
            {history.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {history.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {isCollapsed ? (
          // Collapsed view - show icons only
          <nav className="p-2">
            <div className="space-y-1">
              {isAuthenticated && (
                <button
                  onClick={onNewResearch}
                  className="w-full flex items-center justify-center p-3 rounded-lg hover:bg-surface-hover transition-colors text-primary"
                  title="New Research"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => {
                  if (canViewHistory) {
                    setIsCollapsed(false);
                  } else {
                    openSignInModal();
                  }
                }}
                className="w-full flex items-center justify-center p-3 rounded-lg hover:bg-surface-hover transition-colors text-text-muted"
                title={canViewHistory ? "Research History" : "Sign in to view history"}
              >
                {canViewHistory ? (
                  <History className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </button>
            </div>
          </nav>
        ) : (
          // History view
          <div className="flex flex-col h-full">
            {!canViewHistory ? (
              // Show sign-in prompt for Valyu mode without auth
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                <Lock className="w-8 h-8 text-text-muted mb-2" />
                <p className="text-sm text-text-muted">Sign in to view history</p>
                <p className="text-xs text-text-muted mt-1">
                  Your research history will be saved when signed in
                </p>
                <button
                  onClick={openSignInModal}
                  className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Sign in
                </button>
              </div>
            ) : history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                <History className="w-8 h-8 text-text-muted mb-2" />
                <p className="text-sm text-text-muted">No research history yet</p>
                <p className="text-xs text-text-muted mt-1">
                  Your research will appear here
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-1">
                    {history.map((item) => {
                      const TypeIcon = getTypeIcon(item.researchType);
                      const isActive = currentResearchId === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => onSelectHistory?.(item)}
                          className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left group cursor-pointer ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-surface-hover text-foreground"
                          }`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              onSelectHistory?.(item);
                            }
                          }}
                        >
                          <TypeIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-text-muted" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {item.title}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusIcon(item.status)}
                              <span className="text-xs text-text-muted">
                                {formatDate(item.createdAt)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleRemoveItem(item.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-error/10 rounded transition-all"
                            title="Remove from history"
                          >
                            <Trash2 className="w-3 h-3 text-error" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="p-2 border-t border-border">
                  <button
                    onClick={handleClearHistory}
                    className="w-full flex items-center justify-center gap-2 p-2 text-sm text-text-muted hover:text-error hover:bg-error/5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear History
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Items */}
      <div className="p-2 border-t border-border">
        <div className="space-y-1">
          {bottomItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <a
                key={index}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors text-text-muted text-left"
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm truncate">{item.label}</span>
                )}
              </a>
            );
          })}
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors text-text-muted text-left"
            title={isCollapsed ? (theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode") : undefined}
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Sun className="w-5 h-5 flex-shrink-0" />
            )}
            {!isCollapsed && (
              <span className="text-sm truncate">
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="p-3 border-t border-border hover:bg-surface-hover transition-colors flex items-center justify-center"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-5 h-5 text-text-muted" />
        ) : (
          <ChevronLeft className="w-5 h-5 text-text-muted" />
        )}
      </button>
    </aside>
  );
}
