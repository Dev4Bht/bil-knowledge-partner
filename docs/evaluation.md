# Evaluation

How to run: `uv run python apps/api/eval/run_eval.py --password "$DEMO_PASSWORD"` against a running stack. It writes `docs/evaluation-results.json`. Every number below comes from one real run (the last of several; earlier runs are in git history) on 2026-11-10 on the author's laptop (Apple M5 Pro, Qwen3 8B and BGE-M3 through Ollama, translation off). Nothing here is a general benchmark.

## Method
* **12 questions on real documents** (R01 to R12) answered from public BIL and RMA documents. The expected facts were read from the stored text of those documents.
* **6 control questions** (C1 to C6) use five clearly labelled fictional "EVAL FIXTURE" documents, because the real corpus has no superseded versions, conflicts, drafts or restricted documents to test. The runner creates them through the real API.
* Checks per question: status as expected; expected document and page or section cited; every citation opens the real file; key facts present; current versions only; history version cited when asked; version warning shown; abstention without sources; no leak of draft or restricted text; English draft present.
* **Recall@8** is measured on direct search (no language model) against the *specific document and section* each question must cite (for R01, R03, R05 and R10 that is a named section such as "Coverage" or "Document Checklist", not just the document title). An earlier version of this page reported 1.00; that matched on document title only and overstated retrieval quality. R05 accepts either of two sources, the BIL web claims checklist (section "Document Checklist") or the Handbook p. 36 Q&A, because both legitimately list fire-claim documents; its required fact is therefore only "claim form", which is in both (the web checklist alone also lists a fire brigade report). R05 passed in the full run under its original, stricter expectation too, so the 16 of 18 below is unchanged by this. **Groundedness** is a rough proxy: the share of each claim's content words found in the cited text source (web pages only, not PDFs).

## Results (18 questions)
| Measure | Result |
|---------|--------|
| Fully passed | 16 of 18 |
| Real-document questions fully passed | 10 of 12 |
| Control questions fully passed | 6 of 6 |
| Status as expected | 18 of 18 |
| Expected citation present | 12 of 14 |
| Citations that open the real file | 14 of 14 |
| Key facts present | 13 of 14 |
| Abstained without sources when it should | 4 of 4 |
| Current versions only (where required) | 2 of 2 |
| Older version cited for history question | 1 of 1 |
| Older-version warning shown | 1 of 1 |
| English draft present on answered questions | 13 of 13 |
| Retrieval Recall@8, section-level (mean over 14 questions with a target) | 0.964 |
| Groundedness proxy (mean, text sources) | 0.903 |
| Latency, mean / median / max | 31 s / 23 s / 110 s |

Access control held: the draft-only and restricted control documents never leaked to staff, and the manager received the answer.

Latency is noisy on this laptop. The same code measured a 15 s mean in an earlier run the same day, when nothing else was competing for memory and the models were already loaded; this run's 31 s mean includes cold model loads. Treat it as an order of magnitude, not a benchmark.

## What changed since the first run (7 of 18 failing)
| Question | Cause found | Fix |
|----------|-------------|-----|
| R07, R08 false "conflict" | Two documents each stating their own figure or in-force date were treated as contradicting each other | Conflicts are proposed by the model but only kept if code verifies the quotes, they differ in figures, neither is a document describing itself, and a second check confirms the same subject |
| R05 false "conflict" | Handbook "original estimate of the loss" vs web "Engineer's Estimation of Loss/ Damage": list items worded differently | A conflict now needs differing figures in both quotes. Consequence: a purely wording-level contradiction (for example "must" vs "must not" with no number) is not auto-flagged; that is a deliberate trade-off against blocking correct answers |
| C5 answered an unrelated question | "QW-77" appears in no document; the answer used the complaints-rules timeline | A question naming a code that no retrieved passage contains abstains |
| R01, R05, R10 target passage ranked 16th to 18th | Keyword (OR) ranking is noisy for natural-language questions and was given an equal vote | Hybrid fusion weights vector 4 : keyword 1. Measured on the same questions: vector only 1.000, equal-weight fusion with rare-term lists 0.786, plain 1:1 RRF 0.964, 4:1 1.000 (offline experiment with the full set of 14 targets; the live run below is 0.964) |
| `&amp;` in answers | Passages are HTML-escaped before the model sees them (prompt-injection defence) and the model copied the escaping | Claims are unescaped after synthesis |
| C3 abstained instead of reporting the conflict | Fixed with the conflict pipeline above | Passes |

## Still failing (2 of 18)
| Question | What happens |
|----------|--------------|
| R01 flood, comprehensive | The answer cites the Comprehensive page intro and a Handbook list, but not the "Coverage" section the check requires. **The Handbook list it cites for flood (p. 46) belongs to the Erection All Risks section, a different product** (see below), so this answer is weaker than the earlier wording "correct and grounded" suggested. |
| R10 flood plus claim documents | Gives the full claim-document list but says "natural disasters" instead of naming flood, so the key fact and the "Coverage" citation are missing. Section-level Recall@8 is 0.5 for this question: the long two-part question embeds closer to the claim-checklist than to the coverage list. |

## Found by reading the answers by hand (2026-11-11)
The automated checks confirm status, required facts and that every source exists. They do not grade each sentence, and they passed all of the following. None is fixed.

1. **Wrong-product evidence.** "Does BIL's comprehensive motor insurance cover flood damage?" was answered with the line "Storm/tempest, Flood, inundation, cyclone, & allied perils" from Handbook p. 46. That passage continues "...storage, erection, testing and commissioning": it is the Erection All Risks cover, not motor. The text is grounded but the context is wrong, and the verifier did not catch it.
2. **Duplicated and unrequested claims.** The minimum paid-up capital question produced the same non-life claim twice (from two documents) and added two reinsurance claims that were not asked for.
3. **A reversed draft reply.** For "How many days do we have to report a motor claim after the loss?" the claim was "Claim intimation (normally within 15 days after accident" (cut off mid-parenthesis) and the English draft said "We will send you a claim intimation normally within 15 days", reversing who intimates the claim.
4. A third-party-insurance answer included a sentence about every country in the world, copied from a Handbook marketing passage, which does not answer the question.

Likely causes (not yet investigated): synthesis does not check that a passage is about the product asked about; the verifier checks that a claim is supported by its cited text, not that the text is relevant to the question; the reply step rewrites claims without a check that the direction of the statement is preserved. Worth adding to the labelled set: a product-scope check and a human-graded sample.

## Not covered
Dzongkha (parked), PDFs in the groundedness proxy, questions in Dzongkha, concurrent users, and any document outside this corpus. A single run per question: there is no variance estimate, and the language model is not deterministic across restarts of the stack.
