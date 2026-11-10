"""Approved query expansions for the keyword side of search.

These add alternative words staff and documents use for the same thing (for example "flood" and "natural
calamity"). They never remove or replace the user's words, so the meaning of the question is preserved.
Semantic (vector) search handles most paraphrases on its own; this only helps exact-word matching.
"""

import re

_GROUPS = [
    {"flood", "inundation", "natural calamity", "natural calamities"},
    {"car", "vehicle", "motor"},
    {"claim", "claims"},
    {"withdraw", "withdrawal", "withdrawals"},
    {"loan", "credit", "borrowing"},
    {"renew", "renewal", "renewing"},
    {"document", "documents", "paperwork"},
    {"deadline", "period", "within", "days"},
]


def expand(query: str) -> list[str]:
    """Extra words to OR into the keyword query. Order-stable and de-duplicated."""
    lowered = query.lower()
    words = set(re.findall(r"[a-z0-9]+", lowered))
    extra: list[str] = []
    for group in _GROUPS:
        if any((term in words) if " " not in term else (term in lowered) for term in group):
            for term in sorted(group):
                for token in re.findall(r"[a-z0-9]+", term):
                    if token not in words and token not in extra:
                        extra.append(token)
    return extra
