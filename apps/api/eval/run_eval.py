"""Run the evaluation set against a LIVE API and write measured results. No numbers are invented: everything printed
here is computed from this run.

    uv run python eval/run_eval.py [--api http://localhost:8000] [--password Demo-Pass-2026]
"""

import argparse
import http.cookiejar
import json
import re
import statistics
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EMAIL = {"staff": "staff@demo.bil.test", "manager": "manager@demo.bil.test", "admin": "admin@demo.bil.test"}
STOP = set("the and for with that this are was were has have not but you your from into than then them they their will would should "
           "can could must may any all each per its which when what where who whom how why also only over under about".split())


class Client:
    def __init__(self, api: str, email: str, password: str):
        self.api = api
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.post("/auth/login", {"email": email, "password": password})

    def _open(self, request):
        try:
            return self.opener.open(request, timeout=900)
        except urllib.error.HTTPError as exc:
            return exc

    def post(self, path, body):
        request = urllib.request.Request(self.api + path, data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json", "X-Requested-With": "bil-web"})
        response = self._open(request)
        return json.load(response) if response.status == 200 else {"_http": response.status}

    def get_text(self, path):
        response = self._open(urllib.request.Request(self.api + path))
        return response.status, response.read().decode("utf-8", "replace")


def tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 3 and t not in STOP}


def evaluate(api: str, password: str) -> dict:
    questions = json.loads((ROOT / "questions.json").read_text())["questions"]
    clients: dict[str, Client] = {}
    rows = []
    for q in questions:
        client = clients.setdefault(q["role"], Client(api, EMAIL[q["role"]], password))
        e = q["expect"]
        body = {"question": q["question"], "include_history": q.get("include_history", False)}
        started = time.monotonic()
        result = client.post("/chat/ask", body)
        latency = time.monotonic() - started
        row = {"id": q["id"], "latency_s": round(latency, 1), "status": result.get("status"), "checks": {}}
        if "_http" in result:
            row["checks"]["http_ok"] = False
            rows.append(row)
            continue
        cites = result["citations"]
        sections = [(c["title"], (c["section"] or "").lstrip("§").split(" ")[0] if c["section"] else "") for c in cites]
        blob = json.dumps(result).lower()
        row["checks"]["status_ok"] = result["status"] == e["status"]
        if e.get("cite"):
            # Retrieval recall@8: are the expected passages in the top 8 direct search hits (no language model involved)?
            hits = client.post("/search", {"query": q["question"], "status": "history" if q.get("include_history") else "current"})
            found = [(h["title"], (h["section"] or "").lstrip("§").split(" ")[0]) for h in hits.get("items", [])][:8]
            row["recall_at_8"] = sum(1 for want in e["cite"] if want in found) / len(e["cite"])
            row["checks"]["citations_present"] = all(want in sections for want in e["cite"])
        if cites:
            ok = True
            for c in cites:  # every citation must open the real, permitted file
                status, _ = client.get_text(c["url"].split("#")[0])
                ok &= status == 200
            row["checks"]["citations_resolve"] = ok
        if e.get("facts"):
            row["checks"]["key_facts"] = all(f.lower() in blob for f in e["facts"])
        if e.get("no_superseded"):
            row["checks"]["current_versions_only"] = all(c["version_status"] == "approved_current" for c in cites)
        if e.get("must_cite_superseded"):
            row["checks"]["history_version_cited"] = any(c["version_status"] == "superseded" for c in cites)
        if e.get("no_citations"):
            row["checks"]["abstained_without_sources"] = not cites and result["answer"] is None
        for forbidden in e.get("must_not_mention", []):
            row["checks"][f"no_leak:{forbidden[:24]}"] = forbidden.lower() not in blob
        if e.get("no_draft"):
            row["checks"]["no_draft_on_conflict"] = result["drafts"]["en"] is None and result["drafts"]["dzo"] is None
        if e.get("dzongkha"):
            row["checks"]["english_draft"] = bool(result["drafts"]["en"])
            row["dzongkha_draft"] = bool(result["drafts"]["dzo"])
            row["draft_notes"] = result["draft_notes"]
        # lexical groundedness proxy: how many of each claim's content words appear in the cited documents' text
        if result["claims"]:
            texts = {}
            for c in cites:
                status, text = client.get_text(c["url"].split("#")[0])
                texts[c["id"]] = tokens(text) if status == 200 else set()
            scores = []
            for claim in result["claims"]:
                claim_tokens = tokens(claim["text"])
                cited = set().union(*(texts.get(i, set()) for i in claim["citation_ids"])) if claim["citation_ids"] else set()
                scores.append(len(claim_tokens & cited) / len(claim_tokens) if claim_tokens else 1.0)
            row["groundedness"] = round(sum(scores) / len(scores), 3)
        row["passed"] = all(row["checks"].values())
        rows.append(row)
    latencies = [r["latency_s"] for r in rows]
    recalls = [r["recall_at_8"] for r in rows if "recall_at_8" in r]
    grounded = [r["groundedness"] for r in rows if "groundedness" in r]

    def rate(check):
        values = [r["checks"][check] for r in rows if check in r["checks"]]
        return (sum(values), len(values))

    summary = {
        "questions": len(rows), "fully_passed": sum(1 for r in rows if r.get("passed")),
        "status_accuracy": rate("status_ok"), "citations_present": rate("citations_present"),
        "citations_resolve": rate("citations_resolve"), "key_facts": rate("key_facts"),
        "current_versions_only": rate("current_versions_only"), "history_version_cited": rate("history_version_cited"),
        "abstained_without_sources": rate("abstained_without_sources"),
        "recall_at_8_mean": round(statistics.mean(recalls), 3) if recalls else None,
        "groundedness_proxy_mean": round(statistics.mean(grounded), 3) if grounded else None,
        "latency_mean_s": round(statistics.mean(latencies), 1), "latency_max_s": max(latencies),
        "latency_median_s": round(statistics.median(latencies), 1),
    }
    return {"summary": summary, "rows": rows}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--password", default="Demo-Pass-2026")
    parser.add_argument("--out", default=str(ROOT.parent.parent.parent / "docs" / "evaluation-results.json"))
    args = parser.parse_args()
    report = evaluate(args.api, args.password)
    Path(args.out).write_text(json.dumps(report, indent=2))
    for row in report["rows"]:
        failed = [k for k, v in row["checks"].items() if not v]
        print(f"{'PASS' if row.get('passed') else 'FAIL'}  {row['id']:<28} status={row['status']:<18} {row['latency_s']:>6}s  {('failed: ' + ', '.join(failed)) if failed else ''}")
    print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()
