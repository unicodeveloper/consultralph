"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  TrendingUp,
  Users,
  FileText,
  Search,
  ChevronLeft,
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
  X,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { ResearchHistoryItem, getResearchHistory, removeFromHistory, clearHistory } from "@/app/lib/researchHistory";
import { useAuthStore } from "@/app/stores/auth-store";
import { useThemeStore } from "@/app/stores/theme-store";
import EnterpriseContactModal from "./EnterpriseContactModal";

const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "self-hosted";
const IS_ENTERPRISE = process.env.NEXT_PUBLIC_ENTERPRISE === "true";

interface SidebarProps {
  onSelectHistory?: (item: ResearchHistoryItem) => void;
  onNewResearch?: () => void;
  currentResearchId?: string | null;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
}

const bottomItems = [
  { icon: BookOpen, label: "Documentation", href: "https://docs.valyu.ai/guides/deepresearch-quickstart" },
  { icon: HelpCircle, label: "Join our Discord", href: "https://discord.gg/cY4RhVcwZU" },
];

export default function Sidebar({
  onSelectHistory,
  onNewResearch,
  currentResearchId,
  isCollapsed: controlledCollapsed,
  onCollapsedChange,
  mobileOpen = false,
  onMobileToggle,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(true);

  // Use controlled state if provided, otherwise use internal state
  const isCollapsed = controlledCollapsed ?? internalCollapsed;
  const setIsCollapsed = (value: boolean) => {
    setInternalCollapsed(value);
    onCollapsedChange?.(value);
  };
  const [history, setHistory] = useState<ResearchHistoryItem[]>([]);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);

  const { isAuthenticated, openSignInModal, user, signOut } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  // In Valyu mode, require auth to view history
  const isValyuMode = APP_MODE === "valyu";
  const canViewHistory = !isValyuMode || isAuthenticated;

  // Helper function to map API tasks to ResearchHistoryItem format
  const mapTasks = useCallback(
    (tasks: { deepresearch_id: string; query: string; status: string; created_at: number }[]): ResearchHistoryItem[] =>
      tasks.map((task) => ({
        id: task.deepresearch_id,
        title: task.query,
        researchType: "custom",
        createdAt: task.created_at ? task.created_at * 1000 : Date.now(),
        status: task.status as ResearchHistoryItem["status"],
      })),
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // D key for documentation
      if (
        e.key.toLowerCase() === "d" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        const target = e.target as HTMLElement;
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          !target.isContentEditable
        ) {
          e.preventDefault();
          window.open(
            "https://docs.valyu.ai/guides/deepresearch-quickstart",
            "_blank",
            "noopener,noreferrer"
          );
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch history from deepresearch list API
  useEffect(() => {
    if (!canViewHistory) return;

    const fetchListWithToken = async (token: string) => {
      const url = `/api/consulting-research/list?accessToken=${encodeURIComponent(token)}`;
      return fetch(url);
    };

    async function fetchHistory() {
      try {
        const { getAccessToken, refreshAccessToken } = useAuthStore.getState();
        const accessToken = getAccessToken() || await refreshAccessToken();

        if (!accessToken) {
          throw new Error("No access token");
        }

        let response = await fetchListWithToken(accessToken);

        // On 401, attempt one token refresh and retry
        if (response.status === 401) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            response = await fetchListWithToken(newToken);
          }
        }

        if (!response.ok) {
          throw new Error(`List API ${response.status}`);
        }

        const data = await response.json();
        if (data.tasks?.length > 0) {
          setHistory(mapTasks(data.tasks));
          return;
        }
      } catch {
        // API unavailable - fall through to localStorage
      }

      // Fall back to localStorage if API fails or returns empty
      const localHistory = getResearchHistory();
      if (localHistory.length > 0) {
        setHistory(localHistory);
      }
    }

    fetchHistory();

    // Refresh history periodically
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [canViewHistory, mapTasks]);

  const handleRemoveItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromHistory(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
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

  const handleHistorySelect = (item: ResearchHistoryItem) => {
    onSelectHistory?.(item);
    // Auto-close mobile drawer when selecting history item
    if (onMobileToggle && mobileOpen) {
      onMobileToggle();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={onMobileToggle}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-surface transition-all duration-300 h-screen sticky top-0 z-20 relative ${
          isCollapsed ? "w-16" : "w-72"
        }`}
      >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <Link href="/" onClick={() => onNewResearch?.()} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative w-9 h-9 flex-shrink-0">
              <Image
                src="/consultralph.png"
                alt="Consult Ralph"
                width={36}
                height={36}
                className="w-full h-full object-contain"
              />
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-sm">Consulting Intel</span>
            )}
          </Link>
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
                          onClick={() => handleHistorySelect(item)}
                          className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left group cursor-pointer ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-surface-hover text-foreground"
                          }`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              handleHistorySelect(item);
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
            const isDocsLink = item.label === "Documentation";
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
                  <>
                    <span className="text-sm truncate">{item.label}</span>
                    {isDocsLink && (
                      <div className="flex items-center gap-1 bg-muted border border-border px-1.5 py-0.5 rounded text-xs text-muted-foreground ml-auto">
                        <span>D</span>
                      </div>
                    )}
                  </>
                )}
              </a>
            );
          })}
          {/* Enterprise */}
          {IS_ENTERPRISE && (
            <button
              onClick={() => setShowEnterpriseModal(true)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors text-text-muted text-left"
              title={isCollapsed ? "Enterprise Solutions" : undefined}
            >
              <Building2 className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="text-sm truncate">Enterprise Solutions</span>
              )}
            </button>
          )}
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

      {/* User Profile */}
      <div className="p-2 border-t border-border">
        {isAuthenticated && user ? (
          isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-surface-hover transition-colors"
              title={user.name || user.email}
            >
              {user.picture ? (
                <Image
                  src={user.picture}
                  alt={user.name || "User"}
                  width={28}
                  height={28}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-3 p-2">
              {user.picture ? (
                <Image
                  src={user.picture}
                  alt={user.name || "User"}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                {user.name && (
                  <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                )}
                <p className="text-xs text-text-muted truncate">{user.email}</p>
              </div>
              <button
                onClick={signOut}
                className="p-1.5 rounded-lg hover:bg-error/10 transition-colors flex-shrink-0"
                title="Sign out"
              >
                <LogOut className="w-4 h-4 text-text-muted hover:text-error" />
              </button>
            </div>
          )
        ) : isValyuMode ? (
          isCollapsed ? (
            <button
              onClick={openSignInModal}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-surface-hover transition-colors"
              title="Sign in"
            >
              <UserIcon className="w-5 h-5 text-text-muted" />
            </button>
          ) : (
            <button
              onClick={openSignInModal}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors text-text-muted text-left"
            >
              <UserIcon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">Sign in</span>
            </button>
          )
        ) : null}
      </div>

      {/* Edge Toggle Handle */}
      <div
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 cursor-pointer group"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand sidebar (→)" : "Collapse sidebar (←)"}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsCollapsed(!isCollapsed);
          }
        }}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full border bg-surface group-hover:bg-surface-hover shadow-sm transition-colors">
          {isCollapsed ? (
            <span className="text-[10px] font-medium text-text-muted group-hover:text-foreground">→</span>
          ) : (
            <span className="text-[10px] font-medium text-text-muted group-hover:text-foreground">←</span>
          )}
        </div>
      </div>
    </aside>

    {/* Mobile Sidebar */}
    <aside
      className={`fixed top-0 left-0 h-screen w-72 bg-surface border-r border-border z-50 md:hidden flex flex-col transform transition-transform duration-300 ease-in-out ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <Link href="/" onClick={() => onNewResearch?.()} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative w-9 h-9 flex-shrink-0">
              <Image
                src="/consultralph.png"
                alt="Consult Ralph"
                width={36}
                height={36}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-semibold text-sm">Consulting Intel</span>
          </Link>
          <button
            onClick={onMobileToggle}
            className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>
      </div>

      {/* New Research Button */}
      {isAuthenticated && (
        <div className="p-2 border-b border-border">
          <button
            onClick={() => {
              onNewResearch?.();
              onMobileToggle?.();
            }}
            className="w-full flex items-center justify-center gap-2 p-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Research</span>
          </button>
        </div>
      )}

      {/* History Header */}
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

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col h-full">
          {!canViewHistory ? (
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
                        onClick={() => handleHistorySelect(item)}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left group cursor-pointer ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-surface-hover text-foreground"
                        }`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            handleHistorySelect(item);
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
      </div>

      {/* Bottom Items */}
      <div className="p-2 border-t border-border">
        <div className="space-y-1">
          {bottomItems.map((item, index) => {
            const Icon = item.icon;
            const isDocsLink = item.label === "Documentation";
            return (
              <a
                key={index}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors text-text-muted text-left"
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm truncate">{item.label}</span>
                {isDocsLink && (
                  <div className="flex items-center gap-1 bg-muted border border-border px-1.5 py-0.5 rounded text-xs text-muted-foreground ml-auto">
                    <span>D</span>
                  </div>
                )}
              </a>
            );
          })}
          {/* Enterprise */}
          {IS_ENTERPRISE && (
            <button
              onClick={() => {
                onMobileToggle?.();
                setShowEnterpriseModal(true);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors text-text-muted text-left"
            >
              <Building2 className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm truncate">Enterprise Solutions</span>
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors text-text-muted text-left"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Sun className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm truncate">
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </span>
          </button>
        </div>
      </div>

      {/* User Profile (Mobile) */}
      <div className="p-2 border-t border-border">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3 p-2">
            {user.picture ? (
              <Image
                src={user.picture}
                alt={user.name || "User"}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {(user.name || user.email || "U").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              {user.name && (
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              )}
              <p className="text-xs text-text-muted truncate">{user.email}</p>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 rounded-lg hover:bg-error/10 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-text-muted hover:text-error" />
            </button>
          </div>
        ) : isValyuMode ? (
          <button
            onClick={openSignInModal}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors text-text-muted text-left"
          >
            <UserIcon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Sign in</span>
          </button>
        ) : null}
      </div>
    </aside>

    {/* Enterprise Contact Modal */}
    <EnterpriseContactModal
      open={showEnterpriseModal}
      onClose={() => setShowEnterpriseModal(false)}
    />
  </>
  );
}
