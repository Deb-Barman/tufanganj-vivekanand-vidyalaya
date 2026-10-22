import { API_BASE_URL } from "./config";
import { tokenStorage } from "./tokenStorage";

export interface ApiErrorShape {
  detail?: string;
  [field: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorShape;

  constructor(status: number, body: ApiErrorShape) {
    const message =
      (typeof body?.detail === "string" && body.detail) || firstFieldError(body) || `Request failed (${status})`;
    super(message);
    this.status = status;
    this.body = body;
  }
}

function firstFieldError(body: ApiErrorShape): string | null {
  for (const key of Object.keys(body ?? {})) {
    const value = body[key];
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    if (typeof value === "string") return value;
  }
  return null;
}

/**
 * Getting a fresh access token. The result tells the caller WHY it failed:
 * - sessionOver: the server said the sign-in is no longer valid (expired, password changed) → the person must sign in again.
 * - otherwise it was only a hiccup (server waking up, busy, bad mobile signal) → keep the sign-in and let them retry.
 * Before, ANY failure signed the person out, so a weak network could throw a student out mid-lesson.
 */
type RefreshResult = { ok: true; access: string } | { ok: false; sessionOver: boolean };

let refreshInFlight: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return { ok: false, sessionOver: true };

  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (res): Promise<RefreshResult> => {
        if (res.ok) {
          const data = await res.json();
          tokenStorage.setAccess(data.access);
          return { ok: true, access: data.access as string };
        }
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          tokenStorage.clear();
          return { ok: false, sessionOver: true };
        }
        return { ok: false, sessionOver: false }; // 429 / 5xx / proxy errors: not the person's fault
      })
      .catch((): RefreshResult => ({ ok: false, sessionOver: false }))
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// While Render's free server wakes up, requests fail with a network error or a 502/503/504.
// Reading data is safe to repeat, so GETs quietly retry a few times before giving up.
const RETRY_DELAYS_MS = [1500, 3500, 7000];
const RETRYABLE_STATUS = new Set([502, 503, 504]);

// One attempt never waits longer than this, so a panel can show "Try again" instead of a skeleton forever.
const GET_TIMEOUT_MS = 25_000;

async function fetchWithRetry(url: string, init: RequestInit, canRetry: boolean): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const last = !canRetry || attempt >= RETRY_DELAYS_MS.length;
    const ctrl = canRetry ? new AbortController() : null;
    const timer = ctrl ? window.setTimeout(() => ctrl.abort(), GET_TIMEOUT_MS) : 0;
    try {
      const res = await fetch(url, ctrl ? { ...init, signal: ctrl.signal } : init);
      if (last || !RETRYABLE_STATUS.has(res.status)) return res;
    } catch (err) {
      if (last) throw err;
    } finally {
      window.clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  isMultipart?: boolean;
  /** Return the raw response body (CSV/file downloads) instead of JSON. */
  asBlob?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = "GET", body, auth = true, isMultipart = false, asBlob = false } = options;

  const headers: Record<string, string> = {};
  if (!isMultipart) headers["Content-Type"] = "application/json";
  if (auth) {
    const access = tokenStorage.getAccess();
    if (access) headers.Authorization = `Bearer ${access}`;
  }

  let res: Response;
  try {
    res = await fetchWithRetry(
      `${API_BASE_URL}${path}`,
      {
        method,
        headers,
        body: body === undefined ? undefined : isMultipart ? (body as FormData) : JSON.stringify(body),
      },
      method === "GET",
    );
  } catch {
    // fetch() only throws when the server could not be reached at all. On
    // Render's free plan that usually means the service is waking up (~30-60 s).
    throw new ApiError(0, {
      detail: "Could not reach the school server. It may be waking up — please wait about a minute and try again.",
    });
  }

  if (res.status === 401 && auth && !isRetry && tokenStorage.getRefresh()) {
    const fresh = await refreshAccessToken();
    if (fresh.ok) return request<T>(path, options, true);
    if (!fresh.sessionOver) {
      throw new ApiError(0, { detail: "The school server is busy or your connection dropped for a moment. You are still signed in — please try again." });
    }
  }

  if (res.status === 204) return undefined as T;
  if (asBlob && res.ok) return (await res.blob()) as T;

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) throw new ApiError(res.status, data ?? {});
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) => request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  del: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) => request<T>(path, { ...opts, method: "DELETE" }),
  /** For endpoints with file uploads (gallery, school forms, article covers, marksheets). */
  /** Authenticated file download (e.g. CSV export) as a Blob. */
  download: (path: string) => request<Blob>(path, { method: "GET", asBlob: true }),
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData, isMultipart: true }),
};
