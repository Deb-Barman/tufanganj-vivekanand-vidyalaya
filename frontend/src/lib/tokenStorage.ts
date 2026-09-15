// JWT storage. Kept in one place so it's easy to change the storage
// strategy later (e.g. to an httpOnly cookie set by the backend) without
// touching every call site.
//
// NOTE: localStorage is used here for a straightforward first slice. It is
// readable by any JS on the page, so it is vulnerable to XSS exfiltration.
// TODO / hardening for a later pass: consider moving refresh tokens to an
// httpOnly cookie issued by the backend, keeping only the short-lived
// access token in memory.

const ACCESS_KEY = "tvv_access_token";
const REFRESH_KEY = "tvv_refresh_token";

export const tokenStorage = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  setTokens(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  setAccess(access: string) {
    localStorage.setItem(ACCESS_KEY, access);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
