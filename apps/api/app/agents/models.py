"""Structured outputs the local model must produce, plus a JSON-schema helper for Ollama's `format` option."""

from typing import Literal

from pydantic import BaseModel, Field


class Plan(BaseModel):
    business_line: Literal["general_insurance", "credit", "pf_gf", "corporate"] | None = None
    intent: Literal["answer", "history"] = "answer"
    asks_customer_specific: bool = False
    search_queries: list[str] = Field(default_factory=list)
    needs_clarification: bool = False
    clarification_question: str | None = None


class ConflictItem(BaseModel):
    topic: str
    evidence_id_a: str
    quote_a: str  # exact words from passage A (checked against the passage by code)
    evidence_id_b: str
    quote_b: str  # exact, DIFFERENT words from passage B (checked against the passage by code)


class ConflictOut(BaseModel):
    conflicts: list[ConflictItem] = Field(default_factory=list)


class SynthClaim(BaseModel):
    text: str
    evidence_ids: list[str]


class SynthOut(BaseModel):
    answerable: bool
    claims: list[SynthClaim] = Field(default_factory=list)
    missing_info: str | None = None


class EntailResult(BaseModel):
    index: int
    supported: bool
    reason: str = ""


class EntailOut(BaseModel):
    results: list[EntailResult]


class ReplyOut(BaseModel):
    reply: str


class JudgeOut(BaseModel):
    same_meaning: bool
    differences: str = ""


def schema_for(model: type[BaseModel]) -> dict:
    """The model's JSON schema with $defs inlined, which Ollama's structured output handles reliably."""
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {})

    def inline(node):
        if isinstance(node, dict):
            if "$ref" in node:
                return inline(defs[node["$ref"].split("/")[-1]])
            return {k: inline(v) for k, v in node.items() if k != "title"}
        if isinstance(node, list):
            return [inline(x) for x in node]
        return node

    return inline(schema)
