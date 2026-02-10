import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const TOKEN_STORAGE_KEY = "valyu_oauth_tokens";
const USER_STORAGE_KEY = "valyu_user";

export interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
  email_verified?: boolean;
}

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialized: boolean;
  showSignInModal: boolean;
  signIn: (user: User, tokens: { accessToken: string; refreshToken?: string; expiresIn?: number }) => void;
  signOut: () => void;
  initialize: () => void;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  openSignInModal: () => void;
  closeSignInModal: () => void;
}

function saveTokens(tokens: TokenData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

function loadTokens(): TokenData | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function saveUser(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function loadUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function clearUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_STORAGE_KEY);
}

// Check if token is expired (with 30s buffer)
function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt - 30000;
}

// Load initial tokens from localStorage
// Returns tokens even if expired, as long as refresh token exists (will be refreshed)
function loadInitialTokens(): { user: User | null; tokens: TokenData | null; needsRefresh: boolean } {
  if (typeof window === "undefined") {
    return { user: null, tokens: null, needsRefresh: false };
  }
  const user = loadUser();
  const tokens = loadTokens();
  if (user && tokens) {
    if (!isTokenExpired(tokens.expiresAt)) {
      return { user, tokens, needsRefresh: false };
    }
    // Token expired but refresh token available - keep the session alive
    if (tokens.refreshToken) {
      return { user, tokens, needsRefresh: true };
    }
  }
  return { user: null, tokens: null, needsRefresh: false };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      isAuthenticated: false,
      isLoading: true,
      initialized: false,
      showSignInModal: false,

      initialize: () => {
        // Check if already authenticated (e.g., from client-side navigation after sign-in)
        const currentState = get();
        if (currentState.isAuthenticated && currentState.accessToken) {
          set({ initialized: true, isLoading: false });
          return;
        }

        if (currentState.initialized) {
          set({ isLoading: false });
          return;
        }

        set({ initialized: true });

        // Load tokens from localStorage
        const { user, tokens, needsRefresh } = loadInitialTokens();
        if (user && tokens) {
          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken || null,
            tokenExpiresAt: tokens.expiresAt,
            isAuthenticated: true,
            isLoading: false,
          });
          // Auto-refresh expired token in background
          if (needsRefresh) {
            get().refreshAccessToken();
          }
          return;
        }

        // No valid tokens found
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      signIn: (user, tokens) => {
        // Default to 7 days if no expiresIn provided
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const expiresAt = tokens.expiresIn
          ? Date.now() + tokens.expiresIn * 1000
          : Date.now() + SEVEN_DAYS_MS;

        // Save to localStorage
        saveUser(user);
        saveTokens({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt,
        });

        // Update state
        set({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || null,
          tokenExpiresAt: expiresAt,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      signOut: () => {
        clearUser();
        clearTokens();

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      getAccessToken: () => {
        const state = get();

        // First try to get from state
        if (state.accessToken) {
          if (state.tokenExpiresAt && isTokenExpired(state.tokenExpiresAt)) {
            return null;
          }
          return state.accessToken;
        }

        // Fallback: try to load directly from localStorage
        // This handles race conditions where state hasn't been updated yet
        const tokens = loadTokens();
        if (tokens && tokens.accessToken && !isTokenExpired(tokens.expiresAt)) {
          // Also update state for future calls
          const user = loadUser();
          if (user) {
            set({
              user,
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken || null,
              tokenExpiresAt: tokens.expiresAt,
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
          }
          return tokens.accessToken;
        }

        return null;
      },

      refreshAccessToken: async () => {
        const state = get();
        const refreshToken = state.refreshToken || loadTokens()?.refreshToken;
        if (!refreshToken) {
          // No refresh token - sign out so user sees sign-in prompt
          get().signOut();
          return null;
        }

        try {
          const response = await fetch("/api/oauth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) {
            // Refresh failed - sign out so user sees sign-in prompt
            get().signOut();
            return null;
          }

          const { access_token, refresh_token, expires_in } = await response.json();
          const expiresAt = Date.now() + (expires_in || 3600) * 1000;

          saveTokens({ accessToken: access_token, refreshToken: refresh_token, expiresAt });

          set({
            accessToken: access_token,
            refreshToken: refresh_token || refreshToken,
            tokenExpiresAt: expiresAt,
          });

          return access_token;
        } catch (error) {
          console.error("Token refresh error:", error);
          return null;
        }
      },

      openSignInModal: () => {
        set({ showSignInModal: true });
      },

      closeSignInModal: () => {
        set({ showSignInModal: false });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => sessionStorage),
      // Persist user data and tokens for hydration
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        tokenExpiresAt: state.tokenExpiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
      // Skip automatic hydration - we do it manually in initialize()
      skipHydration: true,
    }
  )
);
