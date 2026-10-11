import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "./api";
import { tokenStorage } from "./tokenStorage";
import type { LoginResponse, User } from "../types/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, portal?: LoginPortal) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

/** Which login page is calling: each maps to a role-scoped backend endpoint. */
export type LoginPortal = "staff" | "admin";
const LOGIN_PATH: Record<LoginPortal, string> = {
  staff: "/auth/staff-login/", // Teacher + Student only
  admin: "/auth/admin-login/", // Super Admin only
};

const PORTAL_KEY = "tvv_last_portal";
/** Where RequireAuth sends a signed-out visitor: the page they last signed in through. */
export function loginPathForLastPortal(): string {
  try {
    return localStorage.getItem(PORTAL_KEY) === "admin" ? "/portal/admin" : "/portal";
  } catch {
    return "/portal";
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!tokenStorage.getAccess()) {
      setUser(null);
      return;
    }
    try {
      const me = await api.get<User>("/auth/me/");
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        tokenStorage.clear();
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username: string, password: string, portal: LoginPortal = "staff") => {
    // Errors (including account-lockout messages from the backend, e.g.
    // "Too many failed attempts. Try again in N minute(s)") propagate as
    // ApiError — the LoginPage displays err.message directly, which is
    // already the safe, user-facing text the backend chose to return.
    const data = await api.post<LoginResponse>(LOGIN_PATH[portal], { username, password }, { auth: false });
    tokenStorage.setTokens(data.access, data.refresh);
    try {
      localStorage.setItem(PORTAL_KEY, portal);
    } catch {
      /* non-fatal */
    }
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    // Ask the server to blacklist the refresh token so a copied token dies
    // too. Fire-and-forget: signing out locally must never wait on the network.
    const refresh = tokenStorage.getRefresh();
    if (refresh) {
      api.post("/auth/logout/", { refresh }).catch(() => undefined);
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post("/auth/me/change-password/", { current_password: currentPassword, new_password: newPassword });
    setUser((prev) => (prev ? { ...prev, must_change_password: false } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, changePassword, refreshUser }),
    [user, loading, login, logout, changePassword, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
