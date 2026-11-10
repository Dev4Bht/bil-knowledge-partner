import type {
  AskRequest,
  AskResponse,
  AuditPage,
  BusinessLine,
  Capabilities,
  CompareResult,
  ConversationDetail,
  ConversationSummary,
  DocumentDetail,
  DocumentPage,
  DocVersion,
  Folder,
  SearchRequest,
  SearchResponse,
  User,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** A failed API call. `status` is 0 when the API could not be reached at all. */
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
/** Lets the session provider react to a 401 from anywhere. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  form?: FormData;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** A 401 here is an expected answer (e.g. a wrong password), not a signed-out session. */
  quiet401?: boolean;
};

export function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, API_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (method !== "GET") headers["X-Requested-With"] = "bil-web";
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = options.form;
  }
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: "include",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(0, "network", "The server could not be reached. Check that the API is running, then try again.");
  }
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
  let detail = `Request failed (${response.status})`;
  let code = "error";
  try {
    const data = (await response.json()) as { detail?: unknown; code?: string };
    if (typeof data.detail === "string") detail = data.detail;
    else if (Array.isArray(data.detail)) detail = "Some of the details are not valid. Please check them and try again.";
    if (data.code) code = data.code;
  } catch {
    /* body was not JSON; keep generic text */
  }
  if (response.status === 401 && !options.quiet401) unauthorizedListeners.forEach((listener) => listener());
  throw new ApiError(response.status, code, detail);
}

// ---- Session
export const login = (email: string, password: string) =>
  request<User>("/auth/login", { method: "POST", json: { email, password }, quiet401: true });
export const logout = () => request<void>("/auth/logout", { method: "POST" });
export const getMe = (signal?: AbortSignal) => request<User>("/auth/me", { signal, quiet401: true });

// ---- Catalog
export const getBusinessLines = (signal?: AbortSignal) => request<BusinessLine[]>("/business-lines", { signal });
export const getFolders = (signal?: AbortSignal) => request<Folder[]>("/folders", { signal });
export const getCapabilities = (signal?: AbortSignal) => request<Capabilities>("/capabilities", { signal });

// ---- Documents
export type DocumentQuery = {
  q?: string;
  business_line?: string;
  folder_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
};
export const listDocuments = (query: DocumentQuery, signal?: AbortSignal) =>
  request<DocumentPage>("/documents", { query, signal });
export const getDocument = (id: string, signal?: AbortSignal) => request<DocumentDetail>(`/documents/${id}`, { signal });
export const uploadDocument = (form: FormData) =>
  request<DocumentDetail>("/documents/upload", { method: "POST", form });
export const uploadVersion = (documentId: string, form: FormData) =>
  request<DocVersion>(`/documents/${documentId}/versions`, { method: "POST", form });
export const approveVersion = (documentId: string, versionId: string) =>
  request<DocVersion>(`/documents/${documentId}/versions/${versionId}/approve`, { method: "POST" });
export const archiveVersion = (documentId: string, versionId: string) =>
  request<DocVersion>(`/documents/${documentId}/versions/${versionId}/archive`, { method: "POST" });
export const compareVersions = (documentId: string, from: string, to: string, signal?: AbortSignal) =>
  request<CompareResult>(`/documents/${documentId}/compare`, { query: { from, to }, signal });

export const versionFileUrl = (documentId: string, versionId: string) =>
  buildUrl(`/documents/${documentId}/versions/${versionId}/file`);

/** Citation URLs are API-relative paths such as `/documents/{id}/versions/{vid}/file#page=3`. */
export function citationHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function fetchVersionText(documentId: string, versionId: string, signal?: AbortSignal): Promise<string> {
  let response: Response;
  try {
    response = await fetch(versionFileUrl(documentId, versionId), { credentials: "include", signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(0, "network", "The file could not be loaded. Check your connection and try again.");
  }
  if (!response.ok) throw new ApiError(response.status, "file_error", "This file could not be loaded.");
  return response.text();
}

// ---- Audit
export const listAudit = (query: { event?: string; result?: string; page?: number; page_size?: number }, signal?: AbortSignal) =>
  request<AuditPage>("/audit", { query, signal });

// ---- Future endpoints (Phase 3 to 5)
export const askQuestion = (body: AskRequest, signal?: AbortSignal) =>
  request<AskResponse>("/chat/ask", { method: "POST", json: body, signal });
export const searchDocuments = (body: SearchRequest, signal?: AbortSignal) =>
  request<SearchResponse>("/search", { method: "POST", json: body, signal });

// ---- Saved chats (each user sees only their own)
export const listConversations = (signal?: AbortSignal) => request<ConversationSummary[]>("/chat/conversations", { signal });
export const getConversation = (id: string, signal?: AbortSignal) => request<ConversationDetail>(`/chat/conversations/${id}`, { signal });
export const renameConversation = (id: string, title: string) =>
  request<ConversationSummary>(`/chat/conversations/${id}`, { method: "PATCH", json: { title } });
export const deleteConversation = (id: string) => request<void>(`/chat/conversations/${id}`, { method: "DELETE" });
export const deleteAllConversations = () => request<void>("/chat/conversations", { method: "DELETE" });
