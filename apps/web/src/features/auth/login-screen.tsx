"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, TextInput } from "@/components/ui/fields";
import { Wordmark } from "@/components/ui/logo";
import { ApiStatus } from "@/components/api-status";

export const DEMO_PASSWORD = "Demo-Pass-2026";
const DEMO_ACCOUNTS = [
  { email: "admin@demo.bil.test", role: "Admin", blurb: "Everything, including the audit log" },
  { email: "manager@demo.bil.test", role: "Manager", blurb: "Upload, approve, archive, see drafts" },
  { email: "staff@demo.bil.test", role: "Staff", blurb: "Browse and ask. No drafts" },
];

/** Only same-site relative paths are honoured, so a crafted link cannot bounce people elsewhere. */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/ask";
  return value;
}

export function LoginScreen() {
  const { state, signIn } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === "authenticated") router.replace(next);
  }, [state.status, next, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace(next);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? "The email or password is not right. Check both and try again."
            : err.message
          : "Something went wrong. Please try again.",
      );
      setBusy(false);
    }
  };

  const fillAccount = (account: string) => {
    setEmail(account);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="relative isolate overflow-hidden bg-[#1b2a4e] px-6 py-8 text-[#f5f0ea] sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12" aria-label="About BIL Knowledge Partner">
        <div aria-hidden="true" className="pattern-band absolute inset-0 -z-10 opacity-[0.12]" />
        <Link href="/" aria-label="About this prototype (home page)" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gold"><Wordmark className="text-[#f5f0ea]" /></Link>
        <div className="py-8 lg:py-0">
          <h1 className="max-w-xl font-display text-[30px] font-semibold leading-[1.15] tracking-tight !text-[#f5f0ea] lg:text-[40px]">
            Ask about a policy, a claim or a loan.
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[#d5d9e6]">
            Answers come only from approved documents and show the file and page they were taken from. Replies are drafted for you to review before anything reaches a customer.
          </p>
          <dl className="mt-8 hidden max-w-md text-[14px] lg:block">
            {[
              ["Sources", "Documents published by BIL and the Royal Monetary Authority of Bhutan."],
              ["Versions", "Only the current approved version answers a question. Conflicts are shown, not hidden."],
              ["Review", "Staff check every draft. Nothing is sent automatically."],
            ].map(([term, detail]) => (
              <div key={term} className="grid grid-cols-[6.5rem_1fr] gap-4 border-t border-white/15 py-3">
                <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#e0a63a]">{term}</dt>
                <dd className="text-[#d5d9e6]">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="hidden text-[13px] text-[#aab3cc] lg:block">Bhutan Insurance Limited. Hackathon 2026 prototype.</p>
      </section>

      <main id="main" className="flex items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-md">
          <div className="anim-rise rounded-[10px] border border-line bg-surface p-6 sm:p-8">
            <h2 className="font-display text-[26px] font-semibold">Sign in</h2>
            <p className="mt-1 text-[15px] text-muted">Use your BIL Knowledge Partner account.</p>
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {error && (
                <Callout kind="error" title="Could not sign in">
                  {error}
                </Callout>
              )}
              <Field label="Email" htmlFor="email">
                <TextInput id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@bil.example" aria-invalid={!!error || undefined} />
              </Field>
              <Field label="Password" htmlFor="password">
                <TextInput id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error || undefined} />
              </Field>
              <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!email || !password}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>

          <section aria-labelledby="demo-heading" className="mt-5 rounded-[10px] border border-line bg-surface-2 p-4">
            <h2 id="demo-heading" className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
              Prototype accounts
            </h2>
            <p className="mt-1.5 text-[14px] text-ink">
              The documents here are public material from bil.bt and rma.org.bt, imported for this prototype and not checked against BIL&rsquo;s internal versions. Password for all three accounts:{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-[13px] font-semibold">{DEMO_PASSWORD}</code>
            </p>
            <ul className="mt-3 divide-y divide-line rounded-[6px] border border-line bg-surface">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => fillAccount(account.email)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-heading">{account.email}</span>
                      <span className="block text-[13px] text-muted">{account.blurb}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-medium text-link">Fill in {account.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <div className="mt-4">
            <ApiStatus />
          </div>
        </div>
      </main>
    </div>
  );
}
