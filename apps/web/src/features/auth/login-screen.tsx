"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, TextInput } from "@/components/ui/fields";
import { IconCheck } from "@/components/ui/icons";
import { LogoMark, Wordmark } from "@/components/ui/logo";
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
        <div aria-hidden="true" className="pattern-band absolute inset-0 -z-10 opacity-[0.22]" />
        <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 size-72 rotate-45 rounded-[28px] border border-[#b87d0a]/40" />
        <div aria-hidden="true" className="absolute -bottom-32 -left-20 -z-10 size-80 rotate-45 rounded-[32px] border border-[#b87d0a]/30" />
        <Wordmark className="text-[#f5f0ea]" />
        <div className="py-8 lg:py-0">
          <LogoMark size={56} className="mb-6 hidden lg:block" />
          <h1 className="max-w-xl font-display text-[32px] font-semibold leading-[1.1] tracking-tight !text-[#f5f0ea] lg:text-[44px]">
            Every answer, traced to the page it came from.
          </h1>
          <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-[#d5d9e6] lg:text-[18px]">
            Ask a real situation. Get a sourced answer from approved BIL documents, and a draft reply in English and Dzongkha for you to review.
          </p>
          <ul className="mt-6 hidden max-w-lg space-y-2 text-[15px] text-[#d5d9e6] lg:block">
            {["Current versions only, with conflicts shown, never hidden", "Every claim links to its document and page", "Nothing is sent to a customer automatically"].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <IconCheck size={18} className="mt-0.5 shrink-0 text-[#e0a63a]" strokeWidth={2.4} />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-[13px] text-[#aab3cc] lg:block">Bhutan Insurance Limited. Hackathon 2026 prototype.</p>
      </section>

      <main id="main" className="flex items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-md">
          <div className="anim-rise rounded-[16px] border border-line bg-surface p-6 shadow-[var(--shadow-md)] sm:p-8">
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

          <section aria-labelledby="demo-heading" className="mt-5 rounded-[12px] border border-gold/50 bg-gold-soft p-4">
            <h2 id="demo-heading" className="text-[14px] font-bold uppercase tracking-wide text-gold-ink">
              Demo environment
            </h2>
            <p className="mt-1 text-[14px] text-ink">
              All documents here are fictional demo data, not BIL policy. Demo password for all three accounts: <code className="rounded bg-surface px-1.5 py-0.5 text-[13px] font-semibold">{DEMO_PASSWORD}</code>
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-1">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => fillAccount(account.email)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[8px] border border-gold/40 bg-surface px-3 py-2 text-left transition-colors hover:border-gold hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-heading">{account.email}</span>
                      <span className="block text-[13px] text-muted">{account.blurb}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-navy px-2.5 py-0.5 text-[12px] font-semibold text-white">Fill in {account.role}</span>
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
