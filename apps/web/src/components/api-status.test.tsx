import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiStatus } from "./api-status";

function mockFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => vi.unstubAllGlobals());

describe("ApiStatus", () => {
  it("shows a loading message first", () => {
    mockFetch(() => new Promise(() => {}));
    render(<ApiStatus />);
    expect(screen.getByText(/checking the api/i)).toBeInTheDocument();
  });

  it("lists each dependency as ready", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({
        status: "ready",
        checks: { database: { ok: true }, object_store: { ok: true, backend: "filesystem" } },
      }),
    }));
    render(<ApiStatus />);
    expect(await screen.findByText(/Database: ready/)).toBeInTheDocument();
    expect(screen.getByText(/Document store: ready \(filesystem\)/)).toBeInTheDocument();
  });

  it("explains which dependency is down", async () => {
    mockFetch(async () => ({
      ok: false,
      json: async () => ({
        status: "not_ready",
        checks: { database: { ok: false, detail: "OperationalError: down" }, object_store: { ok: true } },
      }),
    }));
    render(<ApiStatus />);
    expect(await screen.findByText(/Database: not ready — OperationalError: down/)).toBeInTheDocument();
  });

  it("tells the user how to start the API when it is unreachable", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    render(<ApiStatus />);
    expect(await screen.findByText(/API is not reachable \(Failed to fetch\)/)).toBeInTheDocument();
  });
});
