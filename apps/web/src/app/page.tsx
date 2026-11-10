import { ApiStatus } from "@/components/api-status";

export default function Home() {
  return (
    <>
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <p className="text-lg font-semibold">BIL Knowledge Partner</p>
          <p className="text-sm text-cream-deep">Hackathon 2026 prototype</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <h1 className="text-3xl font-semibold text-navy">Find, trust and share BIL knowledge</h1>
        <p className="max-w-2xl text-ink">
          Ask a question in plain words and get an answer built from approved BIL documents, with the exact file,
          page and section it came from, plus a draft reply in English and Dzongkha for staff to review.
        </p>
        <p className="max-w-2xl rounded-lg border border-gold bg-white p-4 text-sm text-ink">
          <strong>Demo notice.</strong> Only unclassified, public-facing documents belong here. Fictional demo
          fixtures are always labelled and are never BIL policy.
        </p>
        <ApiStatus />
      </main>
    </>
  );
}
