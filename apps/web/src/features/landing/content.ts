// Everything the landing page claims is written here in one place so it can be checked against the code and
// against docs/evaluation.md. Nothing on the page is a promise the prototype cannot keep.

export type Agent = {
  id: string;
  name: string;
  job: string;
  does: string;
  guard: string;
  worker: string;
  kind: "model" | "code" | "mixed";
};

export const AGENTS: Agent[] = [
  {
    id: "supervisor",
    name: "Supervisor",
    job: "Reads the question",
    does: "Works out which business line it belongs to, whether you want today's policy or its history, and what to search for. It asks you to clarify only when it cannot go on without it.",
    guard: "Every question gets a small, fixed number of searches. It cannot wander.",
    worker: "Language model, with its limits set in code",
    kind: "mixed",
  },
  {
    id: "retrieval",
    name: "Retrieval",
    job: "Finds the passages",
    does: "Searches by keywords and by meaning at the same time, so a question about a natural calamity still finds the section that says flood. Each result carries its document, version, page and section.",
    guard: "Your permissions are applied inside the search. A passage you may not read is never retrieved, so no model ever sees it.",
    worker: "Database search. No language model.",
    kind: "code",
  },
  {
    id: "version",
    name: "Policy and Version",
    job: "Checks what is current",
    does: "Leaves out drafts and superseded versions and tells you when it did. If two current documents give different figures for the same thing, it shows both side by side and stops.",
    guard: "A conflict is reported only when code finds both quotes in the documents and the figures really differ.",
    worker: "The model proposes, code decides",
    kind: "mixed",
  },
  {
    id: "synthesis",
    name: "Synthesis",
    job: "Writes the answer",
    does: "Writes short claims using only the passages found, each tied to the source it came from. A general rule is stated as a rule, never as a decision on one customer's case.",
    guard: "If the passages do not answer the question, it says so instead of filling the gap.",
    worker: "Language model",
    kind: "model",
  },
  {
    id: "verifier",
    name: "Verifier",
    job: "Checks the answer",
    does: "Confirms that every citation exists, that you are allowed to read it, and that its figures match the source. A second check asks whether the source really supports each claim. It may search once more; after that it declines.",
    guard: "No citation, no answer.",
    worker: "Mostly code, with one model check",
    kind: "mixed",
  },
  {
    id: "reply",
    name: "Reply",
    job: "Drafts the reply",
    does: "Writes a reply in English for a staff member to review and edit. A Dzongkha draft exists as an experiment: it is off by default and always needs a Dzongkha speaker to check it.",
    guard: "Nothing is sent to a customer. Staff stay the final authority.",
    worker: "Language model",
    kind: "model",
  },
];

// From docs/evaluation.md: one run of 18 questions on this laptop, 2026-11-10. Update both together.
export const RESULTS = [
  { value: "16 of 18", label: "evaluation questions fully passed", note: "10 of 12 on real documents, 6 of 6 controls" },
  { value: "4 of 4", label: "unsupported questions declined", note: "No guess, no sources, no invented answer" },
  { value: "14 of 14", label: "citations opened the real file", note: "Every source link resolved to a stored document" },
  { value: "0.96", label: "retrieval recall at 8 passages", note: "Measured against the specific section each question needs" },
];

export const STACK = [
  "Qwen3 8B through Ollama",
  "BGE-M3 embeddings",
  "PostgreSQL and pgvector",
  "LangGraph",
  "FastAPI",
  "Next.js",
];
