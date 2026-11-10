"""LangGraph workflow wiring the six roles, with a checkpointer and a hard bound on loops.

START -> supervisor -> retrieval -> policy_version -> synthesis -> verifier -> bilingual -> END
Branches: no evidence / model down / clarification end early; a failed verification retries retrieval ONCE.
"""

import operator
import uuid
from functools import partial
from typing import Annotated, Any, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from ..schemas import AskOut, Citation, Claim, Drafts, Step, VersionWarning
from . import nodes
from .nodes import CUSTOMER_SPECIFIC_CAVEAT, Ctx

RECURSION_LIMIT = 24  # a safety net well above the 2 passes the graph can take
_checkpointer = MemorySaver()


class AskState(TypedDict, total=False):
    question: str
    history: list[dict]
    plan: dict
    llm_down: bool
    attempt: int
    evidence: list[dict]
    older: list[dict]
    warnings: list[dict]
    conflicts: list[dict]
    synth: dict | None
    claims: list[dict]
    unsupported: list[str]
    status: str
    reason: str | None
    drafts: dict
    draft_notes: list[str]
    steps: Annotated[list[dict], operator.add]


def _after_supervisor(state: AskState) -> str:
    plan = state["plan"]
    return "end" if plan.get("needs_clarification") and not state.get("history") and plan.get("clarification_question") else "retrieval"


def _after_retrieval(state: AskState) -> str:
    return "end" if not state["evidence"] or state.get("llm_down") else "policy"


def _after_synthesis(state: AskState) -> str:
    return "end" if state.get("llm_down") else "verifier"


def _after_verifier(state: AskState) -> str:
    return {"retry": "retrieval", "verified": "bilingual"}.get(state.get("status", ""), "end")


def build_graph(ctx: Ctx):
    graph = StateGraph(AskState)
    for name, fn in (("supervisor", nodes.supervisor), ("retrieval", nodes.retrieval), ("policy", nodes.policy_version),
                     ("synthesis", nodes.synthesis), ("verifier", nodes.verifier), ("bilingual", nodes.bilingual)):
        graph.add_node(name, partial(fn, ctx=ctx))
    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges("supervisor", _after_supervisor, {"retrieval": "retrieval", "end": END})
    graph.add_conditional_edges("retrieval", _after_retrieval, {"policy": "policy", "end": END})
    graph.add_edge("policy", "synthesis")
    graph.add_conditional_edges("synthesis", _after_synthesis, {"verifier": "verifier", "end": END})
    graph.add_conditional_edges("verifier", _after_verifier, {"retrieval": "retrieval", "bilingual": "bilingual", "end": END})
    graph.add_edge("bilingual", END)
    return graph.compile(checkpointer=_checkpointer)


def _citation(e: dict) -> Citation:
    url = f"/documents/{e['document_id']}/versions/{e['version_id']}/file" + (f"#page={e['page']}" if e.get("page") else "")
    return Citation(id=e["id"], document_id=e["document_id"], version_id=e["version_id"], title=e["title"],
                    folder_path=e["folder_path"], version_label=e["version_label"], version_status=e["version_status"],
                    section=e["section"], page=e["page"], snippet=e["snippet"], url=url, is_demo_fixture=e["is_demo_fixture"])


def build_result(state: dict[str, Any], conversation_id: uuid.UUID, *, include_diagnostics: bool) -> AskOut:
    evidence = {e["id"]: e for e in state.get("evidence", [])}
    plan = state.get("plan", {})
    steps = [Step(**s) for s in state.get("steps", [])]
    warnings = [VersionWarning(kind=w["kind"], message=w["message"], version_ids=w["version_ids"]) for w in state.get("warnings", [])]
    base = dict(conversation_id=conversation_id, steps=steps, version_warnings=warnings, needs_human_review=True,
                unsupported_claims=state.get("unsupported", []) if include_diagnostics else [])

    if plan.get("needs_clarification") and not state.get("evidence") and plan.get("clarification_question") and not state.get("history"):
        return AskOut(status="needs_clarification", answer=None, claims=[], citations=[], drafts=Drafts(),
                      abstention_reason=plan["clarification_question"], **base)
    if state.get("llm_down"):
        top = [_citation(e) for e in list(evidence.values())[:5]]
        return AskOut(status="model_unavailable", answer=None, claims=[], citations=top, drafts=Drafts(),
                      abstention_reason="The local language model is not available, so no answer was composed. "
                                        "The most relevant passages from approved documents are listed below.", **base)
    if state.get("status") != "verified":
        reason = state.get("reason") or "The approved documents you can access do not contain information about this."
        return AskOut(status="no_evidence", answer=None, claims=[], citations=[], drafts=Drafts(), abstention_reason=reason, **base)

    claims = [Claim(text=c["text"], citation_ids=c["citation_ids"]) for c in state["claims"]]
    cited: list[str] = []
    for claim in claims:
        cited += [i for i in claim.citation_ids if i not in cited]
    conflicts = state.get("conflicts", [])
    for c in conflicts:
        cited += [i for i in c["evidence_ids"] if i not in cited and i in evidence]
    drafts = state.get("drafts") or {}
    status = "conflict" if conflicts else "answered"
    return AskOut(
        status=status, answer="\n".join(c.text for c in claims), claims=claims,
        citations=[_citation(evidence[i]) for i in cited if i in evidence], drafts=Drafts(en=drafts.get("en"), dzo=drafts.get("dzo")),
        abstention_reason=("The current documents disagree. Ask the owning team which applies before replying to the customer."
                           if conflicts else None),
        caveats=[CUSTOMER_SPECIFIC_CAVEAT] if plan.get("asks_customer_specific") else [],
        draft_notes=state.get("draft_notes", []), **base)


def run_ask(ctx: Ctx, question: str, history: list[dict], conversation_id: uuid.UUID, *, include_diagnostics: bool) -> AskOut:
    graph = build_graph(ctx)
    config = {"configurable": {"thread_id": str(uuid.uuid4())}, "recursion_limit": RECURSION_LIMIT}
    state = graph.invoke({"question": question, "history": history, "steps": []}, config)
    return build_result(state, conversation_id, include_diagnostics=include_diagnostics)
