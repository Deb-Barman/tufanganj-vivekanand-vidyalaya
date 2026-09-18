import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "./api";
import { tokenStorage } from "./tokenStorage";
import type { LoginResponse, User } from "../types/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
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

  const login = useCallback(async (username: string, password: string) => {
    // Errors (including account-lockout messages from the backend, e.g.
    // "Too many failed attempts. Try again in N minute(s)") propagate as
    // ApiError — the LoginPage displays err.message directly, which is
    // already the safe, user-facing text the backend chose to return.
    const data = await api.post<LoginResponse>("/auth/login/", { username, password }, { auth: false });
    tokenStorage.setTokens(data.access, data.refresh);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
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
