import type { ReactNode } from "react";
import Link from "next/link";
// Italic is used only for emphasis on this page, so it is loaded here and not for the whole app.
import "@fontsource-variable/fraunces/wght-italic.css";
import { buttonClasses } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/logo";
import { cn } from "@/lib/format";
import { APP_URL, STATIC_SITE } from "@/lib/static-site";
import { EVIDENCE, REFUSALS, ROLES, STACK } from "./content";
import { LandingHeader, PrimaryAction } from "./landing-header";
import { Replay } from "./replay";
import { RUNS } from "./runs";

const label = "text-[12px] font-semibold uppercase tracking-[0.16em] text-muted";
const wrap = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";

/** Emphasis in headings: italic, with a pale gold marker underneath. */
function Em({ children }: { children: ReactNode }) {
  return (
    <em className="whitespace-nowrap font-display italic [box-decoration-break:clone]" style={{ background: "linear-gradient(transparent 62%, var(--gold-soft) 62%)" }}>
      {children}
    </em>
  );
}

function Section({ id, mark, name, title, children, className }: { id: string; mark: string; name: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-16 border-t border-line-strong", className)}>
      <div className={cn(wrap, "grid gap-x-10 gap-y-5 py-14 md:py-20 lg:grid-cols-[170px_minmax(0,1fr)]")}>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="font-display text-[26px] italic leading-none text-gold-ink" aria-hidden="true">&sect; {mark}</p>
          <p className={cn(label, "mt-2")}>{name}</p>
        </div>
        <div>
          <h2 id={`${id}-title`} className="max-w-3xl text-balance font-display text-[34px] font-medium leading-[1.06] tracking-[-0.015em] text-heading md:text-[50px]">{title}</h2>
          <div className="mt-9 md:mt-11">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** The one claim, tied to the one sentence it came from. Real text, recorded 11 Nov 2026. */
function Specimen() {
  const run = RUNS[0];
  const claim = run.claims[0];
  const source = run.sources[0];
  const [before, key, after] = source.snippet.split(/(Acknowledgement of complaints within maximum of 3 working days)/);
  return (
    <figure aria-label="A claim tied to its source" className="relative">
      <div className="border border-line-strong bg-surface p-5 shadow-[8px_8px_0_var(--line)]">
        <p className={label}>Question</p>
        <p className="mt-1 font-display text-[19px] leading-snug text-heading">How quickly must a financial service provider acknowledge a consumer complaint?</p>
        <p className={cn(label, "mt-5")}>Answer</p>
        <p className="mt-1 font-display text-[22px] leading-snug text-heading">
          {claim.text}
          <sup className="ml-0.5 font-sans text-[14px] font-bold text-gold-ink">1</sup>
        </p>
      </div>
      <div aria-hidden="true" className="ml-8 h-8 w-px border-l-2 border-dotted border-gold" />
      <div className="relative border border-line-strong border-l-[5px] border-l-gold bg-surface-2 p-5">
        <p className={label}>
          <span className="text-gold-ink">1</span> · p. {source.page} · {source.title} · {source.section?.replace(/^§/, "§ ")}
        </p>
        <blockquote className="mt-2 font-display text-[17px] italic leading-relaxed text-ink">
          &hellip;{before}
          <mark className="not-italic font-medium text-heading" style={{ background: "linear-gradient(transparent 12%, var(--gold-soft) 12%)", padding: "0 2px" }}>{key}</mark>
          {after.split(";")[0]};&hellip;
        </blockquote>
      </div>
      <figcaption className="mt-4 text-[13px] leading-relaxed text-muted">A real answer, recorded on the demo. The quoted line is the sentence the system cited, from the stored page.</figcaption>
    </figure>
  );
}

function RolesTable() {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">The six roles, what each does, the rule it cannot break, and what does the work</caption>
      <thead className="sr-only lg:table-header-group">
        <tr className="border-b-2 border-heading">
          {["Role", "What it does", "The rule it cannot break", "Done by"].map((h) => (
            <th key={h} scope="col" className={cn(label, "py-2 pr-6 font-semibold")}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROLES.map((r, i) => (
          <tr key={r.name} className="block border-b border-line-strong py-5 lg:table-row lg:py-0">
            <th scope="row" className="block pb-2 pr-6 align-top lg:table-cell lg:py-5">
              <span className="flex items-baseline gap-3">
                <span className="font-display text-[18px] italic text-gold-ink">{i + 1}</span>
                <span className="font-display text-[22px] font-semibold leading-tight text-heading">{r.name}</span>
              </span>
            </th>
            <td data-label="What it does" className="block pb-3 pr-8 align-top text-[16px] leading-relaxed before:mb-0.5 before:block before:text-[11px] before:font-semibold before:uppercase before:tracking-[0.16em] before:text-muted before:content-[attr(data-label)] lg:table-cell lg:py-5 lg:before:hidden">{r.job}</td>
            <td data-label="The rule it cannot break" className="block pb-3 pr-8 align-top text-[16px] leading-relaxed before:mb-0.5 before:block before:text-[11px] before:font-semibold before:uppercase before:tracking-[0.16em] before:text-muted before:content-[attr(data-label)] lg:table-cell lg:py-5 lg:before:hidden">{r.rule}</td>
            <td data-label="Done by" className="block align-top text-[15px] text-muted before:mb-0.5 before:block before:text-[11px] before:font-semibold before:uppercase before:tracking-[0.16em] before:content-[attr(data-label)] lg:table-cell lg:w-40 lg:py-5 lg:before:hidden">{r.doneBy}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LandingPage({ staticSite = STATIC_SITE, appUrl = APP_URL }: { staticSite?: boolean; appUrl?: string }) {
  // The demo is offered unless this is the public copy with no app to point at.
  const demo = !staticSite || !!appUrl;
  const loginHref = staticSite ? `${appUrl}/login` : "/login";
  return (
    <div className="bg-bg text-ink">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <LandingHeader staticSite={staticSite} appUrl={appUrl} />

      <main id="content">
        <section aria-labelledby="hero-title">
          <div className={wrap}>
            <div className={cn(label, "flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line-strong py-3")}>
              <span>BIL Knowledge Partner</span>
              <span>BIL Hackathon 2026 &middot; Agentic Knowledge Partner</span>
            </div>
            <div className="grid items-start gap-14 pb-16 pt-12 lg:grid-cols-12 lg:gap-10 lg:pb-24 lg:pt-20">
              <div className="lg:col-span-7">
                <h1 id="hero-title" className="text-balance font-display text-[clamp(2.7rem,5.6vw,5rem)] font-medium leading-[0.99] tracking-[-0.025em] text-heading">
                  Every answer comes with <Em>the page</Em> it came from.
                </h1>
                <p className="mt-8 max-w-xl text-[19px] leading-relaxed">
                  BIL Knowledge Partner reads only approved documents and answers staff questions with the exact page behind each claim. When the documents do not say, or disagree, it tells you instead of guessing.
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <PrimaryAction size="lg" staticSite={staticSite} />
                  {demo && <a href="#run" className="text-[16px] font-semibold text-link underline-offset-4 hover:underline">Watch a real run</a>}
                </div>
                <p className={cn(label, "mt-12")}>Six cooperating agents &middot; one laptop &middot; no cloud AI &middot; staff have the final say</p>
              </div>
              <div className="lg:col-span-5 lg:pt-3"><Specimen /></div>
            </div>
          </div>
        </section>

        <Section id="run" mark="1" name="A real run" title={<>Watch the agents answer, <Em>decline</Em> and disagree.</>}>
          <p className="mb-8 max-w-2xl text-[18px] leading-relaxed text-muted">
            These are three recorded runs of the demo. The log lines, answers, sources and drafts are exactly what the system returned; only the pacing is staged. Pick a question.
          </p>
          <Replay />
        </Section>

        <Section id="roles" mark="2" name="Six roles" title={<>One job each, and one rule each <Em>that holds</Em>.</>}>
          <p className="mb-8 max-w-2xl text-[18px] leading-relaxed text-muted">
            This is a bounded workflow, not an autonomous system. The roles run in a fixed order with limits set in code, and they are the same names you saw in the log.
          </p>
          <RolesTable />
        </Section>

        <Section id="refusals" mark="3" name="What it refuses" title={<>Four things it will <Em>not</Em> do.</>}>
          <div className="grid gap-px bg-line-strong md:grid-cols-2">
            {REFUSALS.map((r) => {
              const [first, ...rest] = r.no.split(" ");
              return (
                <article key={r.no} className="bg-bg p-6 md:p-8">
                  <h3 className="font-display text-[32px] font-medium leading-tight tracking-[-0.01em] text-heading">
                    <em className="text-gold-ink">{first}</em> {rest.join(" ")}
                  </h3>
                  <p className="mt-3 text-[16px] leading-relaxed">{r.body}</p>
                  {r.example && (
                    <p className="mt-4 border-l-[3px] border-gold pl-3 text-[14px] leading-relaxed text-muted">
                      <span className={cn(label, "mb-0.5 block")}>{r.exampleLabel}</span>
                      {r.example}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </Section>

        <Section id="evidence" mark="4" name="Evidence" title={<>Tested on <Em>18 labelled questions</Em>.</>}>
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Results of one run of 18 labelled questions</caption>
            <thead className="sr-only md:table-header-group">
              <tr className="border-b-2 border-heading">
                {["Check", "Result", "Note"].map((h) => (
                  <th key={h} scope="col" className={cn(label, "py-2 pr-6 font-semibold")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVIDENCE.map((e) => (
                <tr key={e.check} className="block border-b border-line-strong py-4 md:table-row md:py-0">
                  <th scope="row" className="block pr-6 text-[17px] font-semibold text-heading md:table-cell md:py-4">{e.check}</th>
                  <td className="block font-display text-[30px] font-medium leading-tight tabular-nums text-heading md:table-cell md:whitespace-nowrap md:py-4 md:pr-8">{e.result}</td>
                  <td className="block text-[15px] text-muted md:table-cell md:py-4">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-muted">
            One run on a laptop with a local model. The method and every result are in <code className="bg-surface-3 px-1 text-[14px]">docs/evaluation.md</code>.
          </p>
        </Section>

        <section aria-labelledby="cta-title" className="border-t-2 border-heading bg-surface-2">
          <div className={cn(wrap, "grid items-end gap-8 py-16 md:py-24 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]")}>
            <h2 id="cta-title" className="font-display text-[36px] font-medium leading-[1.04] tracking-[-0.02em] text-heading md:text-[56px]">
              {demo ? <>Try it, then <Em>check its sources</Em>.</> : <>Watch it answer, <Em>decline</Em> and disagree.</>}
            </h2>
            <div>
              <p className="text-[17px] leading-relaxed text-muted">
                {demo
                  ? "Sign in with a demo account, ask about a claim, and open the page each source points to."
                  : "Three recorded runs show the log, the answer, the sources and the draft exactly as the system produced them."}
              </p>
              <div className="mt-6">
                {demo ? <PrimaryAction size="lg" staticSite={staticSite} appUrl={appUrl} /> : <a href="#run" className={buttonClasses("primary", "lg")}>Watch a real run</a>}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line-strong">
        <div className={cn(wrap, "grid gap-6 py-10 text-[14px] leading-relaxed text-muted md:grid-cols-[auto_1fr_auto] md:items-start md:gap-10")}>
          <span className="text-heading"><Wordmark /></span>
          <div className="space-y-2">
            <p>Built for the BIL Hackathon 2026. Not an official BIL service. Replies are drafts for staff to review.</p>
            <p>Built with {STACK}. Set in Fraunces and Source Sans 3.</p>
          </div>
          {!demo ? <a href="#content" className="font-semibold text-link hover:underline">Back to top</a> : staticSite ? <a href={loginHref} className="font-semibold text-link hover:underline">Sign in</a> : <Link href="/login" className="font-semibold text-link hover:underline">Sign in</Link>}
        </div>
      </footer>
    </div>
  );
}
