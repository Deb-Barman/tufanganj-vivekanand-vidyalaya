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

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;

  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (res) => {
        if (!res.ok) {
          tokenStorage.clear();
          return null;
        }
        const data = await res.json();
        tokenStorage.setAccess(data.access);
        return data.access as string;
      })
      .catch(() => {
        tokenStorage.clear();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  isMultipart?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = "GET", body, auth = true, isMultipart = false } = options;

  const headers: Record<string, string> = {};
  if (!isMultipart) headers["Content-Type"] = "application/json";
  if (auth) {
    const access = tokenStorage.getAccess();
    if (access) headers.Authorization = `Bearer ${access}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isMultipart ? (body as FormData) : JSON.stringify(body),
  });

  if (res.status === 401 && auth && !isRetry && tokenStorage.getRefresh()) {
    const newAccess = await refreshAccessToken();
    if (newAccess) return request<T>(path, options, true);
  }

  if (res.status === 204) return undefined as T;

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
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData, isMultipart: true }),
};
