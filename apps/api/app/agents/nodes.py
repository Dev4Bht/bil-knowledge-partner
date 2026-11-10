"""The six logical agent roles (CLAUDE.md section 4), as plain functions over a state dict.

Each node returns a partial state update. Nothing here decides access rights: retrieval applies them inside the
query, and the verifier re-checks every cited version before it can appear in an answer.
"""

import html
import re
import time
from dataclasses import dataclass

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import access
from ..config import Settings
from ..embeddings import Embedder
from ..models import BusinessLineCode, DocumentVersion, User, VersionStatus
from ..search import Hit, hybrid_search
from . import prompts
from .llm import LLM, LLMBadOutput, LLMUnavailable
from .models import AdjudicateOut, ConflictOut, EntailOut, JudgeOut, Plan, ReplyOut, SelectOut, SynthOut, schema_for
from .translate import DZ, EN, Translator, is_degenerate, tibetan_share, western_digits

TIBETAN = re.compile(r"[\u0F00-\u0FFF]")
NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
CUSTOMER_SPECIFIC_CAVEAT = ("This states the rule in BIL's documents. It is not a decision on this customer's case; "
                            "a qualified officer must assess the specific policy or application.")
MAX_QUERIES = 4


@dataclass
class Ctx:
    db: Session
    user: User
    embedder: Embedder
    llm: LLM
    settings: Settings
    business_line: BusinessLineCode | None
    include_history: bool
    language: str | None
    translator: Translator | None = None


def _structured(ctx: Ctx, model, system: str, user: str, max_tokens: int = 700):
    last: Exception | None = None
    for _ in range(2):  # one retry if the model returns malformed JSON
        try:
            return model.model_validate(ctx.llm.json(system=system, user=user, schema=schema_for(model), max_tokens=max_tokens))
        except (LLMBadOutput, ValidationError) as exc:
            last = exc
    raise LLMBadOutput(str(last))


def _step(agent: str, summary: str, started: float) -> list[dict]:
    return [{"agent": agent, "summary": f"{summary} ({time.monotonic() - started:.1f}s)"}]


def _numbers(text: str) -> set[str]:
    return {n.replace(",", "") for n in NUMBER.findall(text)}


def to_evidence(hit: Hit, number: int) -> dict:
    section = " ".join(x for x in (f"§{hit.section_label}" if hit.section_label else None, hit.heading) if x) or None
    return {
        "id": f"E{number}", "chunk_id": str(hit.chunk_id), "document_id": str(hit.document_id),
        "version_id": str(hit.version_id), "title": hit.title, "folder_path": hit.folder_path,
        "business_line": hit.business_line, "version_label": hit.version_label, "version_status": hit.version_status,
        "effective_from": hit.effective_from, "section": section, "page": hit.page, "text": hit.text,
        "snippet": hit.snippet, "is_demo_fixture": hit.is_demo_fixture, "score": hit.score,
    }


# ------------------------------------------------------------------ 1. Supervisor

def supervisor(state: dict, ctx: Ctx) -> dict:
    started = time.monotonic()
    question = state["question"]
    history = state.get("history") or []
    prompt = ""
    if history:
        prompt += "Earlier messages:\n" + "\n".join(f"{m['role']}: {m['content'][:400]}" for m in history[-6:]) + "\n\n"
    prompt += f"Question: {question}"
    llm_down, note = False, "planned the search"
    try:
        plan = _structured(ctx, Plan, prompts.SUPERVISOR, prompt, 300)
    except LLMUnavailable:
        plan, llm_down, note = Plan(), True, "language model unavailable; searching with the question as written"
    except LLMBadOutput:
        plan, note = Plan(), "could not plan; searching with the question as written"
    queries = [question] + [q.strip() for q in plan.search_queries if q.strip()]  # the user's own words always run
    queries = list(dict.fromkeys(queries))[:MAX_QUERIES]
    plan.search_queries = queries
    if ctx.include_history:
        plan.intent = "history"
    return {"plan": plan.model_dump(), "llm_down": llm_down, "attempt": state.get("attempt", 0),
            "steps": _step("Supervisor", f"{note}: {len(queries)} query(ies), intent {plan.intent}", started)}


# ------------------------------------------------------------------ 2. Retrieval

def retrieval(state: dict, ctx: Ctx) -> dict:
    started = time.monotonic()
    plan, attempt = state["plan"], state.get("attempt", 0)
    limit = 8 if attempt == 0 else 12
    history = plan["intent"] == "history"
    merged: dict[str, Hit] = {}
    notes: list[str] = []
    for query in plan["search_queries"]:
        hits, meta = hybrid_search(ctx.db, ctx.user, ctx.embedder, query, vector_max_distance=ctx.settings.vector_max_distance,
                                   business_line=ctx.business_line, include_history=history, limit=limit)
        notes += meta.notes
        for hit in hits:
            key = str(hit.chunk_id)
            if key not in merged or hit.score > merged[key].score:
                merged[key] = hit
    ranked = sorted(merged.values(), key=lambda h: h.score, reverse=True)[:limit]
    evidence = [to_evidence(hit, i) for i, hit in enumerate(ranked, start=1)]

    older: list[dict] = []
    if not history and evidence:
        doc_ids = {e["document_id"] for e in evidence}
        current_labels = {e["document_id"]: e["version_label"] for e in evidence if e["version_status"] == "approved_current"}
        seen: set[str] = set()
        past, _ = hybrid_search(ctx.db, ctx.user, ctx.embedder, plan["search_queries"][0],
                                vector_max_distance=ctx.settings.vector_max_distance, business_line=ctx.business_line,
                                include_history=True, limit=12)
        for hit in past:
            if hit.version_status != "approved_current" and str(hit.document_id) in doc_ids and str(hit.version_id) not in seen:
                seen.add(str(hit.version_id))
                older.append({"version_id": str(hit.version_id), "title": hit.title, "label": hit.version_label,
                              "current_label": current_labels.get(str(hit.document_id), "?")})
    mode = "keyword-only" if notes else "hybrid"
    return {"evidence": evidence, "older": older,
            "steps": _step("Retrieval", f"{len(evidence)} passage(s) from {len({e['document_id'] for e in evidence})} "
                                        f"document(s), {mode} search, access filtered", started)}


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


_SELF_REFERENCE = re.compile(r"\b(these|this)\s+(rules?(\s+and\s+regulations?)?|regulations?|guidelines?|act|directive|circular|policy|manual|document)\b", re.I)


def _about_itself(passage: str, quote_norm: str) -> bool:
    """True when the quoted words sit in a sentence about 'these Rules', 'this circular' and so on, i.e. a property of
    the document itself (for example its in-force date), which another document's own date cannot contradict."""
    flat = _norm(passage)
    at = flat.find(quote_norm)
    return at >= 0 and bool(_SELF_REFERENCE.search(flat[max(0, at - 160): at + len(quote_norm) + 40]))


def verified_conflicts(out: ConflictOut, evidence: list[dict]) -> list[dict]:
    """Keep only conflicts the code can prove: both quotes really appear in their own passages, the passages come from
    different documents, and the quoted words actually differ. The model proposes; deterministic checks decide."""
    by_id = {e["id"]: e for e in evidence}
    found: list[dict] = []
    for item in out.conflicts:
        a, b = by_id.get(item.evidence_id_a), by_id.get(item.evidence_id_b)
        if not a or not b or a["document_id"] == b["document_id"]:
            continue
        qa, qb = _norm(item.quote_a), _norm(item.quote_b)
        if not qa or not qb or len(qa) > 160 or len(qb) > 160:
            continue
        if qa not in _norm(a["text"]) or qb not in _norm(b["text"]):
            continue  # a quote that is not in the passage is invented
        if qa == qb or qa in qb or qb in qa:
            continue  # the same words, or one merely more detailed than the other
        figures_a, figures_b = _numbers(item.quote_a), _numbers(item.quote_b)
        if not (figures_a and figures_b):
            continue  # only differences in figures (days, amounts, dates) are proven; two differently worded list items are not
        if figures_a == figures_b:
            continue  # worded differently but stating the same figures: not a conflict
        if _about_itself(a["text"], qa) and _about_itself(b["text"], qb):
            continue  # each document is stating its OWN date, scope or status
        found.append({"evidence_ids": [a["id"], b["id"]], "quotes": {a["id"]: item.quote_a.strip(), b["id"]: item.quote_b.strip()},
                      "description": f"on {item.topic.strip() or 'the same point'}, {a['title']} ({a['section'] or a['version_label']}) says "
                                     f"\u201c{item.quote_a.strip()}\u201d while {b['title']} ({b['section'] or b['version_label']}) says "
                                     f"\u201c{item.quote_b.strip()}\u201d"})
    return found


def adjudicated(ctx: Ctx, question: str, candidates: list[dict], evidence: list[dict]) -> list[dict]:
    """A second, narrow question for each candidate: are the two quotes about the SAME thing? Anything the model
    cannot confirm is dropped, because a wrong 'conflict' blocks a correct answer."""
    by_id = {e["id"]: e for e in evidence}
    kept = []
    for candidate in candidates:
        a, b = (by_id[i] for i in candidate["evidence_ids"])
        prompt = (f"Staff question: {question}\n\nPassage A ({a['title']}, {a['section'] or a['version_label']}):\n{a['text'][:700]}\n\n"
                  f"Passage B ({b['title']}, {b['section'] or b['version_label']}):\n{b['text'][:700]}\n\nThe values that differ: {candidate['description']}")
        try:
            if _structured(ctx, AdjudicateOut, prompts.ADJUDICATE, prompt, 200).same_subject:
                kept.append(candidate)
        except (LLMUnavailable, LLMBadOutput):
            continue
    return kept


# ------------------------------------------------------------------ 3. Policy and version

def policy_version(state: dict, ctx: Ctx) -> dict:
    started = time.monotonic()
    evidence = state["evidence"]
    warnings: list[dict] = []
    history = state["plan"]["intent"] == "history"
    if history and any(e["version_status"] != "approved_current" for e in evidence):
        warnings.append({"kind": "history_included", "version_ids": [e["version_id"] for e in evidence if e["version_status"] != "approved_current"],
                         "message": "Older versions are included because you asked about history. They are not current policy."})
    for old in state.get("older", []):
        warnings.append({"kind": "older_version_ignored", "version_ids": [old["version_id"]],
                         "message": f"An older version of '{old['title']}' ({old['label']}) was ignored because version "
                                    f"'{old['current_label']}' is current."})
    if access.can_manage(ctx.user):  # staff must not learn that unpublished drafts exist
        import uuid as _uuid

        doc_ids = [_uuid.UUID(d) for d in {e["document_id"] for e in evidence}]
        drafts = ctx.db.execute(select(DocumentVersion).where(DocumentVersion.document_id.in_(doc_ids),
                                                              DocumentVersion.status == VersionStatus.draft)).scalars().all()
        for draft in drafts:
            warnings.append({"kind": "draft_excluded", "version_ids": [str(draft.id)],
                             "message": f"A draft version '{draft.version_label}' of '{draft.document.title}' exists but is not approved, so it was not used."})

    conflicts: list[dict] = []
    if not state.get("llm_down") and len({e["document_id"] for e in evidence}) >= 2:
        try:
            out = _structured(ctx, ConflictOut, prompts.CONFLICT,
                              f"Staff question: {state['question']}\n\n{prompts.render_evidence(evidence)}", 500)
            conflicts = adjudicated(ctx, state["question"], verified_conflicts(out, evidence), evidence)
        except (LLMUnavailable, LLMBadOutput):
            pass
    for c in conflicts:
        by_id = {e["id"]: e for e in evidence}
        warnings.append({"kind": "conflict", "version_ids": [by_id[i]["version_id"] for i in c["evidence_ids"]],
                         "message": f"Conflict between current documents: {c['description']}"})
    return {"warnings": warnings, "conflicts": conflicts,
            "steps": _step("Policy & Version", f"{len(warnings)} notice(s), {len(conflicts)} conflict(s) among current documents", started)}


# ------------------------------------------------------------------ 4. Knowledge synthesis

_QUESTION_STOP = set("does what which when where whether would could should about under with that this from into have your their they them "
                     "there then than also only over after before between each other many much must need needs".split())


def _with_distinctive_passages(question: str, picked: list[dict], evidence: list[dict], limit: int = 6) -> list[dict]:
    """A safety net around the model's choice: a passage that contains a rare word from the question (such as "flood")
    is kept even if the selector left it out. Words found in most passages (such as "motor") do not count."""
    terms = {t for t in re.findall(r"[a-z]{4,}", question.lower()) if t not in _QUESTION_STOP}
    ordered = list(picked)
    taken = {e["id"] for e in picked}
    for term in sorted(terms):
        holders = [e for e in evidence if term in e["text"].lower()]
        if 0 < len(holders) <= max(1, len(evidence) // 2):  # distinctive: not in most of the passages
            for e in holders:
                if e["id"] not in taken and len(ordered) < limit:
                    ordered.append(e)
                    taken.add(e["id"])
    return ordered


_IDENTIFIER = re.compile(r"\b(?=[A-Za-z0-9-]*[A-Za-z])(?=[A-Za-z0-9-]*\d)[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*\b")


def missing_identifiers(question: str, evidence: list[dict]) -> list[str]:
    """Codes the question names (such as "QW-77" or "GI12") that appear in none of the retrieved passages. The documents
    cannot answer a question about a code they never mention, however close the other passages sound."""
    haystack = re.sub(r"[^a-z0-9]", "", " ".join(e["text"] + e["title"] for e in evidence).lower())
    return [code for code in dict.fromkeys(_IDENTIFIER.findall(question))
            if re.sub(r"[^a-z0-9]", "", code.lower()) not in haystack]


def _plain_text(synth: dict) -> dict:
    """Passages are HTML-escaped before the model sees them (so a passage cannot close the evidence fence), and the
    model tends to copy that escaping into its answer ('&amp;'). The answer is shown as plain text, so undo it."""
    for claim in synth.get("claims", []):
        claim["text"] = html.unescape(claim["text"])
    if synth.get("missing_info"):
        synth["missing_info"] = html.unescape(synth["missing_info"])
    return synth


def _conflict_claims(state: dict) -> dict:
    """When documents genuinely disagree the write-up is built from the verified quotes themselves, with no model
    in the loop: each side is stated exactly as the document says it, with its own citation."""
    by_id = {e["id"]: e for e in state["evidence"]}
    claims = []
    for conflict in state["conflicts"]:
        for evidence_id in conflict["evidence_ids"]:
            e = by_id[evidence_id]
            quote = conflict.get("quotes", {}).get(evidence_id)
            if quote:
                claims.append({"text": f"Conflict: {e['title']} ({e['section'] or e['version_label']}) says \u201c{quote}\u201d.", "evidence_ids": [evidence_id]})
    return {"answerable": bool(claims), "claims": claims, "missing_info": None}


def synthesis(state: dict, ctx: Ctx) -> dict:
    started = time.monotonic()
    if state.get("conflicts"):
        synth = _conflict_claims(state)
        return {"synth": synth, "steps": _step("Synthesis", f"{len(synth['claims'])} conflicting statement(s) quoted from the documents", started)}

    evidence = state["evidence"]
    unknown = missing_identifiers(state["question"], evidence)
    if unknown:
        return {"synth": {"answerable": False, "claims": [], "missing_info": f"The approved documents do not mention {', '.join(unknown)}."},
                "steps": _step("Synthesis", f"the question names {', '.join(unknown)}, which no retrieved passage mentions", started)}
    narrowed = evidence
    try:  # keep only the passages that help answer; fall back to everything if the choice is unusable
        listing = "\n".join(f"{e['id']} [{e['title']}, {e['section'] or e['version_label']}]: {e['text'][:260].replace(chr(10), ' ')}" for e in evidence)
        chosen = _structured(ctx, SelectOut, prompts.SELECT, f"Staff question: {state['question']}\n\nPassages:\n{listing}", 120).relevant_ids
        picked = [e for e in evidence if e["id"] in set(chosen)]
        if picked:
            narrowed = _with_distinctive_passages(state["question"], picked, evidence)
    except LLMUnavailable:
        return {"llm_down": True, "synth": None, "steps": _step("Synthesis", "language model unavailable", started)}
    except LLMBadOutput:
        pass
    prompt = f"Staff question: {state['question']}\n\n{prompts.render_evidence(narrowed)}"
    try:
        synth = _plain_text(_structured(ctx, SynthOut, prompts.SYNTHESIS, prompt, 1500).model_dump())
        summary = f"{len(synth['claims'])} claim(s) drafted from {len(narrowed)} of {len(evidence)} passage(s)"
    except LLMUnavailable:
        return {"llm_down": True, "synth": None, "steps": _step("Synthesis", "language model unavailable", started)}
    except LLMBadOutput:
        synth, summary = None, "the model returned no usable answer"
    return {"synth": synth, "steps": _step("Synthesis", summary, started)}


# ------------------------------------------------------------------ 5. Verification

def verifier(state: dict, ctx: Ctx) -> dict:
    started = time.monotonic()
    attempt = state.get("attempt", 0)
    synth = state.get("synth")
    evidence = {e["id"]: e for e in state["evidence"]}
    allowed = {VersionStatus.approved_current} | ({VersionStatus.superseded, VersionStatus.archived} if state["plan"]["intent"] == "history" else set())

    def fail(reason: str, note: str) -> dict:
        if attempt == 0:  # retry retrieval at most once, with a wider net
            return {"status": "retry", "attempt": 1, "steps": _step("Verification", f"{note}; retrying retrieval once", started)}
        return {"status": "no_evidence", "reason": reason, "claims": [], "unsupported": state.get("unsupported", []),
                "steps": _step("Verification", f"{note}; abstaining", started)}

    abstain_reason = (synth or {}).get("missing_info") or "The approved documents you can access do not answer this question."
    if not synth or not synth["answerable"] or not synth["claims"]:
        return fail(abstain_reason, "no answerable claims")

    candidates, unsupported = [], []
    for claim in synth["claims"]:
        ids = [i for i in claim["evidence_ids"] if i in evidence]
        text = claim["text"].strip()
        if not text or not ids or len(ids) != len(claim["evidence_ids"]):
            unsupported.append(text or "(empty claim)")  # no citation, or a citation that does not exist
            continue
        permitted = True
        for i in ids:  # deterministic existence / permission / version check on every citation
            version = ctx.db.get(DocumentVersion, evidence[i]["version_id"])
            if version is None or not access.can_see_document(ctx.user, version.document) or version.status not in allowed:
                permitted = False
        # a claim may quote figures from the passage, or name its source (a title such as "Circular 2024/017", a section number)
        cited_numbers = set().union(*(_numbers(" ".join([evidence[i]["text"], evidence[i]["title"], evidence[i]["section"] or "", evidence[i]["version_label"]])) for i in ids))
        if not permitted or not _numbers(text) <= cited_numbers:  # a number the passages do not contain is a hallucination
            unsupported.append(text)
            continue
        candidates.append({"text": text, "citation_ids": ids})

    supported = candidates
    if candidates:
        listing = "\n\n".join(
            f"Claim {i}: {c['text']}\nCited passages:\n{prompts.render_evidence([evidence[k] for k in c['citation_ids']])}"
            for i, c in enumerate(candidates))
        try:
            results = {r.index: r for r in _structured(ctx, EntailOut, prompts.VERIFIER, listing, 600).results}
            supported = []
            for i, c in enumerate(candidates):
                if results.get(i) is not None and results[i].supported:
                    supported.append(c)
                else:
                    unsupported.append(c["text"])
        except (LLMUnavailable, LLMBadOutput):
            supported, unsupported = [], unsupported + [c["text"] for c in candidates]  # unverified claims are never shown

    if not supported:
        return {**fail(abstain_reason, "no claim survived verification"), "unsupported": unsupported}
    return {"status": "verified", "claims": supported, "unsupported": unsupported,
            "steps": _step("Verification", f"{len(supported)} claim(s) verified, {len(unsupported)} rejected", started)}


# ------------------------------------------------------------------ 6. Bilingual response

def bilingual(state: dict, ctx: Ctx) -> dict:
    started = time.monotonic()
    notes: list[str] = []
    if state.get("conflicts"):
        return {"drafts": {"en": None, "dzo": None},
                "draft_notes": ["No customer reply was drafted because the current documents conflict. Check with the owning team first."],
                "steps": _step("Bilingual Response", "skipped: documents conflict", started)}
    claims = state["claims"]
    facts = "\n".join(f"- {c['text']}" for c in claims)
    allowed_numbers = _numbers(facts)
    caveat = CUSTOMER_SPECIFIC_CAVEAT if state["plan"].get("asks_customer_specific") else ""
    prompt = f"Verified statements:\n{facts}\n" + (f"\nThe reply must say that this is general information and a staff member will assess the specific case.\n" if caveat else "")
    english = None
    try:
        for _ in range(2):
            candidate = _structured(ctx, ReplyOut, prompts.REPLY, prompt, 400).reply.strip()
            if candidate and _numbers(candidate) <= allowed_numbers:  # re-verification: no invented figures
                english = candidate
                break
        if english is None:
            notes.append("The English draft was withheld because it contained a figure not found in the verified statements.")
    except (LLMUnavailable, LLMBadOutput):
        notes.append("The English draft could not be generated.")

    dzongkha = None
    if english and (ctx.translator is None or not ctx.translator.available()):
        notes.append("No Dzongkha translation model is installed on this server, so no Dzongkha draft is shown.")
    elif english:
        try:
            raw = ctx.translator.translate(english, EN, DZ).strip()
            if not raw or tibetan_share(raw) < 0.5:
                notes.append("The translation did not produce Dzongkha text, so no Dzongkha draft is shown.")
            elif is_degenerate(raw):
                notes.append("The translation looped on repeated syllables and was withheld.")
            elif not _numbers(english) <= _numbers(western_digits(raw)):
                notes.append("The Dzongkha draft was withheld because it did not keep the figures from the English reply.")
            else:
                dzongkha = raw
                back = ctx.translator.translate(raw, DZ, EN)
                judged = _structured(ctx, JudgeOut, prompts.JUDGE, f"Text A:\n{english}\n\nText B:\n{back}", 200)
                if not judged.same_meaning:
                    notes.append("Back-translation check: the Dzongkha may differ in meaning from the English"
                                 + (f" ({judged.differences})." if judged.differences else ". Review it carefully."))
        except (LLMUnavailable, LLMBadOutput):
            notes.append("The Dzongkha draft could not be checked by the language model; review it carefully.")
        except Exception as exc:  # model download or runtime problems must never break the answer
            dzongkha = None
            notes.append(f"Dzongkha translation failed ({type(exc).__name__}); no Dzongkha draft is shown.")
    return {"drafts": {"en": english, "dzo": dzongkha}, "draft_notes": notes,
            "steps": _step("Bilingual Response", f"English {'ready' if english else 'withheld'}, Dzongkha {'ready (experimental)' if dzongkha else 'not available'}", started)}
