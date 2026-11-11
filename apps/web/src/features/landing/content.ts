// Everything the landing page states about the system lives here, so it can be checked against the code and against
// docs/evaluation.md. The recorded runs are in runs.ts. Nothing on the page claims more than the system does.

export type Role = { name: string; job: string; rule: string; doneBy: string };

// Names match the labels the system itself writes into each run's log.
export const ROLES: Role[] = [
  {
    name: "Supervisor",
    job: "Reads the question and plans the search: business line, today's policy or its history, what to look for.",
    rule: "A fixed, small number of searches per question. It asks you to clarify only when it cannot go on.",
    doneBy: "Model, limits in code",
  },
  {
    name: "Retrieval",
    job: "Finds passages by keywords and by meaning together, each with its document, version, page and section.",
    rule: "Your permissions are applied inside the search. A passage you may not read is never retrieved, so no model sees it.",
    doneBy: "Database search",
  },
  {
    name: "Policy & Version",
    job: "Leaves out drafts and superseded versions, says when it did, and looks for current documents that disagree.",
    rule: "A conflict is reported only when code finds both quotes in the documents and their figures really differ.",
    doneBy: "Model proposes, code decides",
  },
  {
    name: "Synthesis",
    job: "Writes short claims using only the passages found, each tied to its source.",
    rule: "If the passages do not answer the question, it says so instead of filling the gap.",
    doneBy: "Model",
  },
  {
    name: "Verification",
    job: "Checks each citation exists, is readable by you, and matches the figures; then asks whether the source supports the claim.",
    rule: "It may search once more. After that it declines. No citation, no answer.",
    doneBy: "Mostly code, one model check",
  },
  {
    name: "Bilingual Response",
    job: "Drafts a reply in English for a staff member to review before anything is sent.",
    rule: "Nothing is sent to a customer. Staff review and edit every draft.",
    doneBy: "Model",
  },
];

export type Refusal = { no: string; body: string; example?: string; exampleLabel?: string };

export const REFUSALS: Refusal[] = [
  {
    no: "No source, no answer.",
    body: "Every claim carries the document, version and page it came from, and each source opens that page in the document viewer. A claim the sources do not support is rejected before you see it.",
  },
  {
    no: "No quiet tie-breaks.",
    body: "Only approved current versions answer by default. When two current documents give different figures, it quotes both and sends the question to their owners instead of picking one.",
    exampleLabel: "Test documents, recorded run",
    example: "Memo A says 10 working days. Memo B says 20 working days. No reply is drafted.",
  },
  {
    no: "No access, no retrieval.",
    body: "Permissions are checked in the search itself, before any text reaches a language model, and again when a file is opened. A document you may not read is answered as “not found”, the same as one that does not exist. Drafts are never searchable.",
  },
  {
    no: "No sending.",
    body: "Replies are drafts marked “Review before use”. Nothing goes to a customer automatically, and it never decides whether a claim or loan is approved. Staff have the final say.",
  },
];

// From docs/evaluation.md: one run of 18 labelled questions on this laptop, 2026-11-10. Update both together.
export const EVIDENCE = [
  { check: "Questions fully passed", result: "16 of 18", note: "10 of 12 on real documents, 6 of 6 on labelled test documents" },
  { check: "Unsupported questions declined", result: "4 of 4", note: "No answer and no sources when the documents do not say" },
  { check: "Citations that open the cited page", result: "14 of 14", note: "Every source link resolved to a real page" },
  { check: "Required section among the top 8 passages", result: "0.96", note: "Mean over the 14 questions that name one" },
  { check: "Time to answer", result: "10 to 110 s", note: "Mean 31 s, median 23 s, on a laptop with a local 8B model" },
];

export const NAV = [
  { href: "#run", label: "A real run" },
  { href: "#roles", label: "Six roles" },
  { href: "#refusals", label: "What it refuses" },
  { href: "#evidence", label: "Evidence" },
];

export const STACK = "Qwen3 8B through Ollama, BGE-M3 embeddings, PostgreSQL with pgvector, LangGraph, FastAPI and Next.js";
