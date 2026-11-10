import { render } from "@testing-library/react";
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { SessionProvider } from "@/lib/session";
import type { User } from "@/lib/types";
import { ToastProvider } from "@/components/ui/toast";

export type MockResponse = { status?: number; body?: unknown; text?: string } | Promise<never>;
export type Handler = (url: URL, init: RequestInit) => MockResponse | undefined | Promise<MockResponse | undefined>;

/** Stubs fetch. Handlers are tried in order; unmatched calls fail the test loudly. Returns the call log. */
export function mockApi(...handlers: Handler[]) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    calls.push({ url, init });
    for (const handler of handlers) {
      const result = await handler(url, init);
      if (result === undefined) continue;
      const r = result as { status?: number; body?: unknown; text?: string };
      const status = r.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => r.body,
        text: async () => r.text ?? JSON.stringify(r.body ?? ""),
      } as Response;
    }
    throw new Error(`Unmocked fetch: ${init.method ?? "GET"} ${url.pathname}${url.search}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

export const route =
  (method: string, path: string | RegExp, response: MockResponse | ((url: URL, init: RequestInit) => MockResponse)): Handler =>
  (url, init) => {
    if ((init.method ?? "GET") !== method) return undefined;
    const matches = typeof path === "string" ? url.pathname === path : path.test(url.pathname);
    if (!matches) return undefined;
    return typeof response === "function" ? response(url, init) : response;
  };

export function renderApp(ui: ReactElement, options: { user?: User | null; search?: string; onUrlUpdate?: OnUrlUpdateFunction } = {}) {
  const initial = options.user ? ({ status: "authenticated", user: options.user } as const) : ({ status: "anonymous" } as const);
  return render(
    <NuqsTestingAdapter hasMemory searchParams={options.search ?? ""} onUrlUpdate={options.onUrlUpdate}>
      <SessionProvider initial={initial}>
        <ToastProvider>{ui}</ToastProvider>
      </SessionProvider>
    </NuqsTestingAdapter>,
  );
}
