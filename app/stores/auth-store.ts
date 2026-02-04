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
  signIn: (user: User, tokens: { accessToken: string; refreshToken?: string; expiresIn?: number }) => void;
  signOut: () => void;
  initialize: () => void;
  getAccessToken: () => string | null;
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
function loadInitialTokens(): { user: User | null; tokens: TokenData | null } {
  if (typeof window === "undefined") {
    return { user: null, tokens: null };
  }
  const user = loadUser();
  const tokens = loadTokens();
  if (user && tokens && !isTokenExpired(tokens.expiresAt)) {
    return { user, tokens };
  }
  return { user: null, tokens: null };
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

      initialize: () => {
        if (get().initialized) return;
        set({ initialized: true });

        // Load tokens from localStorage first
        const { user, tokens } = loadInitialTokens();
        if (user && tokens) {
          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken || null,
            tokenExpiresAt: tokens.expiresAt,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }

        // Failsafe timeout - if nothing happens in 2 seconds, stop loading
        const timeoutId = setTimeout(() => {
          if (get().isLoading) {
            set({ isLoading: false });
          }
        }, 2000);

        // No valid tokens found
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isAuthenticated: false,
          isLoading: false,
        });

        clearTimeout(timeoutId);
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
        if (!state.accessToken) return null;

        if (state.tokenExpiresAt && isTokenExpired(state.tokenExpiresAt)) {
          return null;
        }

        return state.accessToken;
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
