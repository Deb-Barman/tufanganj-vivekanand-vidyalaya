// JWT storage in one place so the strategy can change later without
// touching every call site. localStorage is readable by any JS on the
// page (XSS-exfiltration risk) — acceptable for this first pass given
// short-lived (15 min) access tokens and refresh rotation, but a hardening
// candidate is moving the refresh token to an httpOnly cookie the backend
// sets, keeping only the access token in memory.

const ACCESS_KEY = "tvv_access_token";
const REFRESH_KEY = "tvv_refresh_token";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS_KEY, access),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
