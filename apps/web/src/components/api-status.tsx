"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Check = { ok: boolean; detail?: string; backend?: string };
type Ready = { status: string; checks: Record<string, Check> };
type State =
  | { kind: "loading" }
  | { kind: "ready" | "not_ready"; data: Ready }
  | { kind: "unreachable"; message: string };

const LABELS: Record<string, string> = { database: "Database", object_store: "Document store" };

/** Live API readiness (GET /ready). Used on the sign-in screen so a down API is explained, not mysterious. */
export function ApiStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/ready`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as Ready;
        setState({ kind: response.ok ? "ready" : "not_ready", data });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setState({ kind: "unreachable", message: error instanceof Error ? error.message : "Unknown error" });
      });
    return () => controller.abort();
  }, []);

  return (
    <section aria-labelledby="status-heading" className="rounded-[10px] border border-line bg-surface p-4">
      <h2 id="status-heading" className="text-[14px] font-semibold text-heading">
        System status
      </h2>
      <div role="status" aria-live="polite" className="mt-2 text-[14px]">
        {state.kind === "loading" && <p className="text-muted">Checking the API…</p>}
        {state.kind === "unreachable" && (
          <p className="text-bad">
            The API is not reachable ({state.message}). Start it with <code>uv run uvicorn app.main:app</code> in <code>apps/api</code>.
          </p>
        )}
        {(state.kind === "ready" || state.kind === "not_ready") && (
          <ul className="space-y-1">
            {Object.entries(state.data.checks).map(([name, check]) => (
              <li key={name} className={check.ok ? "text-ok" : "text-bad"}>
                <span aria-hidden="true">{check.ok ? "✓" : "✗"}</span>{" "}
                <span>
                  {LABELS[name] ?? name}: {check.ok ? "ready" : "not ready"}
                  {check.backend ? ` (${check.backend})` : ""}
                  {!check.ok && check.detail ? ` — ${check.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
