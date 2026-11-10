# Evaluation

How to run: `uv run python apps/api/eval/run_eval.py --password "$DEMO_PASSWORD"` against a running stack. It writes `docs/evaluation-results.json`. Every number below comes from one real run on 2026-11-10 on the author's laptop (Apple M5 Pro, Qwen3 8B and BGE-M3 through Ollama, translation off). Nothing here is a general benchmark.

## Method
* **12 questions on real documents** (R01 to R12) answered from public BIL and RMA documents. The expected facts were read from the stored text of those documents.
* **6 control questions** (C1 to C6) use five clearly labelled fictional "EVAL FIXTURE" documents, because the real corpus has no superseded versions, conflicts, drafts or restricted documents to test. The runner creates them through the real API.
* Checks per question: status as expected; expected document and page or section cited; every citation opens the real file; key facts present; current versions only; history version cited when asked; version warning shown; abstention without sources; no leak of draft or restricted text; English draft present.
* **Recall@8** is measured on direct search (no language model). **Groundedness** is a rough proxy: the share of each claim's content words found in the cited text source (web pages only, not PDFs).

## Results (18 questions)
| Measure | Result |
|---------|--------|
| Fully passed | 11 of 18 |
| Real-document questions fully passed | 6 of 12 |
| Control questions fully passed | 5 of 6 |
| Status as expected | 14 of 18 |
| Expected citation present | 11 of 14 |
| Citations that open the real file | 12 of 12 |
| Key facts present | 11 of 14 |
| Abstained without sources when it should | 4 of 4 |
| Current versions only (where required) | 2 of 2 |
| Older version cited for history question | 1 of 1 |
| Older-version warning shown | 1 of 1 |
| English draft present on answered questions | 10 of 13 |
| Retrieval Recall@8 (mean) | 1.00 |
| Groundedness proxy (mean, text sources) | 0.98 |
| Latency, mean / median / max | 25 s / 18 s / 108 s |

Access control held: the draft-only and manager-only control documents never leaked to staff, and the manager received the answer.

## Failures (not fixed; causes not yet diagnosed)
| Question | What happened |
|----------|---------------|
| R01 flood, comprehensive | Answered, but a required fact was missing from the answer |
| R04 handbook claim intimation | Answered with "15 days" but did not cite the expected page (p. 31) |
| R05 fire claim documents | Wrongly abstained (`no_evidence`) although retrieval found the right page; took 108 s |
| R07 minimum paid-up capital | Reported a `conflict` instead of answering |
| R08 rules effective date | Reported a `conflict` instead of answering |
| R10 flood plus claim documents | Answered, but a required fact was missing |
| C3 two memos disagree | Abstained instead of reporting the conflict |

Retrieval found the expected passages every time (Recall@8 = 1.0), so the failures are in the answering steps: synthesis, the conflict check and verification. The false conflicts on R07 and R08 matter most, because a wrong "conflict" blocks a correct answer. Next step: inspect the stored `steps` and `unsupported_claims` for these seven questions, then fix and re-run.

## Not covered
Dzongkha (parked), PDFs in the groundedness proxy, questions in Dzongkha, concurrent users, and any document outside this corpus.
