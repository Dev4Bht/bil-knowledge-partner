import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";
import { AgentExplorer } from "./agent-explorer";
import { RESULTS, STACK } from "./content";
import { LandingHeader, PrimaryAction } from "./landing-header";

function Eyebrow({ n, children, dark }: { n: string; children: string; dark?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.16em] ${dark ? "text-[#f0c978]" : "text-gold-ink"}`}>
      <span aria-hidden="true" className="font-display text-[15px] tracking-normal">{n}</span>
      <span aria-hidden="true" className={`h-px w-8 ${dark ? "bg-[#f0c978]" : "bg-gold"}`} />
      {children}
    </p>
  );
}

/** `dark` is for the navy band: its text colours are set explicitly because that band is dark in both themes. */
function Section({ id, n, eyebrow, title, intro, children, className, dark }: {
  id: string; n: string; eyebrow: string; title: string; intro?: string; children: React.ReactNode; className?: string; dark?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-20 py-16 md:py-24 ${dark ? "bg-rail" : ""} ${className ?? ""}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Eyebrow n={n} dark={dark}>{eyebrow}</Eyebrow>
        <h2 id={`${id}-title`} className={`mt-3 max-w-3xl font-display text-[32px] font-semibold leading-[1.1] md:text-[44px] ${dark ? "text-white" : "text-heading"}`}>{title}</h2>
        {intro && <p className={`mt-4 max-w-2xl text-[18px] leading-relaxed ${dark ? "text-rail-muted" : "text-muted"}`}>{intro}</p>}
        <div className="mt-10 md:mt-12">{children}</div>
      </div>
    </section>
  );
}

function Specimen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-[10px] border border-dashed border-line-strong bg-surface-2 p-3 text-[14px] leading-relaxed">
      <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  );
}

function TrustCard({ title, children, specimen }: { title: string; children: React.ReactNode; specimen?: React.ReactNode }) {
  return (
    <article className="flex flex-col rounded-[14px] border border-line bg-surface p-6">
      <h3 className="font-display text-[22px] font-semibold leading-snug text-heading">{title}</h3>
      <p className="mt-2 text-[16px] leading-relaxed">{children}</p>
      {specimen}
    </article>
  );
}

export function LandingPage() {
  return (
    <div className="bg-bg text-ink">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <LandingHeader />

      <main id="content">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line">
          <div aria-hidden="true" className="pattern-band absolute inset-x-0 top-0 h-3 opacity-60" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 md:pb-24 md:pt-20 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold-soft px-3 py-1 text-[13px] font-semibold text-gold-ink">
                Hackathon 2026 prototype · public documents only
              </p>
              <h1 id="hero-title" className="mt-5 font-display text-[40px] font-semibold leading-[1.04] tracking-tight text-heading sm:text-[52px] lg:text-[60px]">
                The answer, the page it came from, and a draft reply.
              </h1>
              <p className="mt-6 max-w-xl text-[19px] leading-relaxed text-muted">
                BIL Knowledge Partner is six cooperating AI agents that read only approved BIL documents. Each has one narrow job. When the documents do not say, it tells you so instead of guessing.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <PrimaryAction size="lg" />
                <a href="#how" className="inline-flex min-h-12 items-center gap-2 rounded-[8px] px-4 text-[16px] font-semibold text-link hover:underline">
                  See how an answer is made <span aria-hidden="true">↓</span>
                </a>
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-muted">
                <li className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-gold" />Runs on one laptop</li>
                <li className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-gold" />No cloud AI service</li>
                <li className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-gold" />Staff have the final say</li>
              </ul>
            </div>

            <figure className="relative">
              <div aria-hidden="true" className="absolute -inset-3 -z-10 rotate-[1.5deg] rounded-[20px] bg-gold-soft" />
              {/* A real capture of the demo answering a question from public BIL documents. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/answer.png"
                width={1272}
                height={2084}
                alt="The Ask screen. A question about flood cover on comprehensive motor insurance, an answer with a numbered source, and an English draft reply marked review before use."
                className="w-full rounded-[14px] border border-line-strong bg-surface shadow-[var(--shadow-lg)]"
              />
              <figcaption className="mt-3 text-[14px] text-muted">
                A real answer from the demo, using public BIL documents. Each source opens the stored document at that page.
              </figcaption>
            </figure>
          </div>
        </section>

        <Section id="why" n="01" eyebrow="Why this exists" title="Policy is spread across handbooks, circulars and web pages."
          intro="Versions overlap, and people answer from memory. A reply to a customer can drift from what the documents actually say. This prototype puts the documents first and shows its working.">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Ask", "A staff member describes a real situation in plain words."],
              ["Check", "The agents find the passages, discard old versions and look for conflicts."],
              ["Reply", "The answer comes with sources and a draft reply for the staff member to review."],
            ].map(([t, d], i) => (
              <div key={t} className="rounded-[14px] border border-line bg-surface p-6">
                <p className="font-display text-[15px] font-semibold text-gold-ink">0{i + 1}</p>
                <p className="mt-1 font-display text-[24px] font-semibold text-heading">{t}</p>
                <p className="mt-2 text-[16px] leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="how" n="02" eyebrow="How it works" title="Six agents, each with one job."
          intro="This is a bounded workflow, not an autonomous system. The agents run in a fixed order, with limits set in code. Select a step to see what it does and what stops it going wrong."
          className="border-y border-line bg-surface-2">
          <AgentExplorer />
        </Section>

        <Section id="trust" n="03" eyebrow="Why you can trust it" title="Built to say no, and to show its sources.">
          <div className="grid gap-4 md:grid-cols-2">
            <TrustCard title="Every claim points to its page"
              specimen={<Specimen label="What a source looks like"><span className="inline-flex items-center gap-2 rounded-full border border-info/30 bg-info-soft px-2.5 py-0.5 font-semibold text-info"><span className="grid h-4 w-4 place-items-center rounded-full bg-info text-[11px] text-white">1</span>BIL Insurance Handbook · 20 August 2024 · p. 30</span></Specimen>}>
              Sources are not decoration. Each one opens the stored file at the page and section the claim came from. An answer without a source is not shown.
            </TrustCard>
            <TrustCard title="It declines when the documents do not say"
              specimen={<Specimen label="Behaviour in the evaluation set">Asked for BIL&rsquo;s share price at yesterday&rsquo;s close, it gave no answer and no sources, because no approved document contains it.</Specimen>}>
              A confident guess is worse than no answer. When the evidence is missing, the agents stop and say what is missing.
            </TrustCard>
            <TrustCard title="Old versions and conflicts are shown, not hidden"
              specimen={<Specimen label="Example, from the labelled test documents">Memo A says 10 working days; Memo B says 20 working days. Both are quoted, and the question goes to the owning team. No reply is drafted.</Specimen>}>
              Only approved current versions answer by default. When two current documents disagree, it does not pick one.
            </TrustCard>
            <TrustCard title="Permissions come first"
              specimen={<Specimen label="Rule">A document you may not open is answered as &ldquo;not found&rdquo;, the same as one that does not exist.</Specimen>}>
              Access is enforced in the search itself, before any text reaches a language model, and again when a file is opened. Drafts are never searchable.
            </TrustCard>
            <TrustCard title="People stay in charge">
              Replies are drafts marked <strong>Review before use</strong>. Nothing is sent to a customer automatically, and the assistant never decides whether a claim or loan is approved.
            </TrustCard>
            <TrustCard title="Public documents only">
              The demo uses public BIL and RMA documents. The sign-in accounts are fictional, and no customer personal data is accepted or stored.
            </TrustCard>
          </div>
        </Section>

        <Section id="results" n="04" eyebrow="Measured, not promised" title="What one run on one laptop showed." dark>
          <dl className="grid gap-px overflow-hidden rounded-[14px] bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
            {RESULTS.map((r) => (
              <div key={r.label} className="bg-rail p-6">
                <dd className="font-display text-[44px] font-semibold leading-none tabular-nums text-white">{r.value}</dd>
                <dt className="mt-3 text-[16px] font-semibold text-white">{r.label}</dt>
                <p className="mt-1 text-[14px] text-rail-muted">{r.note}</p>
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-3xl text-[16px] leading-relaxed text-rail-muted">
            Eighteen labelled questions, run once on a laptop with a local 8B model. Two questions still give answers that are correct but less specific than the documents allow. Answers took about half a minute on average. This is a baseline, not a benchmark. The full method and every failure are in <code className="rounded bg-white/10 px-1">docs/evaluation.md</code> in the repository.
          </p>
        </Section>

        <Section id="stack" n="05" eyebrow="Under the hood" title="Free, local, and inspectable."
          intro="Everything runs on the machine in front of you. No paid AI API is used, and no document leaves it.">
          <ul className="flex flex-wrap gap-2">
            {STACK.map((s) => (
              <li key={s} className="rounded-full border border-line-strong bg-surface px-4 py-2 text-[15px] font-semibold text-heading">{s}</li>
            ))}
          </ul>
        </Section>

        <Section id="limits" n="06" eyebrow="Limits" title="What it is not, yet." className="border-t border-line bg-surface-2">
          <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
            {[
              ["Not an official BIL service.", "It is a hackathon prototype built on public documents. The mark here is original, not BIL's logo."],
              ["Dzongkha is experimental.", "The draft is off by default, has not been checked by a Dzongkha speaker, and always says so."],
              ["Scanned PDFs cannot be read.", "There is no OCR yet. Such files are reported as failed, not silently skipped."],
              ["Not connected to BIL's own document system.", "A read-only adapter is outlined with its open questions, but no real integration exists."],
              ["Conflicts are caught by figures.", "A contradiction with no number in it is not flagged automatically."],
              ["It is not fast.", "A local model takes from about ten seconds to nearly two minutes per answer on a laptop."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rotate-45 bg-gold" />
                <p className="text-[17px] leading-relaxed"><strong className="text-heading">{t}</strong> {d}</p>
              </li>
            ))}
          </ul>
        </Section>

        <section aria-labelledby="cta-title" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 md:py-24">
            <h2 id="cta-title" className="mx-auto max-w-2xl font-display text-[34px] font-semibold leading-tight text-heading md:text-[44px]">See it answer a real question.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[18px] text-muted">Sign in with a demo account, ask about a claim, and open the source it cites.</p>
            <div className="mt-8 flex justify-center"><PrimaryAction size="lg" /></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface-2">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-[14px] text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
          <span className="text-heading"><Wordmark /></span>
          <p className="max-w-xl">Hackathon 2026 prototype. Not an official BIL service, and not BIL policy. Answers are drafts for staff to review.</p>
          <Link href="/login" className="font-semibold text-link hover:underline">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
