import { describe, expect, it, vi } from "vitest";
import { ApiError, API_URL, approveVersion, askQuestion, citationHref, listDocuments, login, onUnauthorized, request } from "./api";
import { mockApi, route } from "@/test/utils";

describe("api client", () => {
  it("sends cookies on every call and the CSRF header only on writes", async () => {
    const { calls } = mockApi(route("GET", "/documents", { body: { items: [], total: 0, page: 1, page_size: 20 } }), route("POST", /approve$/, { body: {} }));
    await listDocuments({ q: "motor", page: 2 });
    await approveVersion("d", "v");
    expect(calls[0].init.credentials).toBe("include");
    expect((calls[0].init.headers as Record<string, string>)["X-Requested-With"]).toBeUndefined();
    expect(calls[0].url.searchParams.get("q")).toBe("motor");
    expect(calls[0].url.searchParams.get("page")).toBe("2");
    expect(calls[1].init.credentials).toBe("include");
    expect((calls[1].init.headers as Record<string, string>)["X-Requested-With"]).toBe("bil-web");
  });

  it("drops empty query values", async () => {
    const { calls } = mockApi(route("GET", "/documents", { body: {} }));
    await listDocuments({ q: "", business_line: undefined, status: "draft" });
    expect([...calls[0].url.searchParams.keys()]).toEqual(["status"]);
  });

  it("turns an error body into an ApiError with detail and code", async () => {
    mockApi(route("GET", "/documents", { status: 404, body: { detail: "Not found", code: "not_found" } }));
    const error = await listDocuments({}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "not_found", message: "Not found" });
  });

  it("reports an unreachable server as status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await request("/x").catch((e) => e);
    expect(error).toMatchObject({ status: 0, code: "network" });
  });

  it("notifies on 401, except for sign-in where 401 means wrong password", async () => {
    const listener = vi.fn();
    const off = onUnauthorized(listener);
    mockApi(route("GET", "/documents", { status: 401, body: { detail: "Sign in", code: "unauthorized" } }), route("POST", "/auth/login", { status: 401, body: { detail: "Wrong email or password", code: "invalid_credentials" } }));
    await listDocuments({}).catch(() => {});
    expect(listener).toHaveBeenCalledTimes(1);
    await login("a@b.c", "nope").catch(() => {});
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it("posts the ask body as JSON", async () => {
    const { calls } = mockApi(route("POST", "/chat/ask", { body: { conversation_id: "c", status: "answered" } }));
    await askQuestion({ question: "Q?", language: "dz", include_history: false });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ question: "Q?", language: "dz", include_history: false });
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("prefixes API-relative citation URLs with the API base and keeps the page anchor", () => {
    expect(citationHref("/documents/d/versions/v/file#page=3")).toBe(`${API_URL}/documents/d/versions/v/file#page=3`);
    expect(citationHref("https://x.example/f.pdf")).toBe("https://x.example/f.pdf");
  });
});
