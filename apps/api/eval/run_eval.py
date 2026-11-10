"""Run the evaluation set against a LIVE API and write measured results. No numbers are invented: everything printed
here is computed from this run.

    uv run python eval/run_eval.py --password "$DEMO_PASSWORD" [--api http://localhost:8000]

Setup: creates (idempotently) the fictional 'EVAL FIXTURE' control documents through the real API, waits for indexing,
then asks each question as the stated role. Control documents stay in the DMS afterwards, clearly labelled.
"""

import argparse
import http.cookiejar
import json
import re
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EMAIL = {"staff": "staff@demo.bil.test", "manager": "manager@demo.bil.test", "admin": "admin@demo.bil.test"}
STOP = set("the and for with that this are was were has have not but you your from into than then them they their will would should "
           "can could must may any all each per its which when what where who whom how why also only over under about".split())
BANNER = "FICTIONAL EVALUATION FIXTURE - not BIL policy.\n\n"


class Client:
    def __init__(self, api: str, email: str, password: str):
        self.api = api
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        if self.request("POST", "/auth/login", {"email": email, "password": password}).get("_http"):
            raise SystemExit(f"could not sign in as {email}")

    def _open(self, request):
        try:
            return self.opener.open(request, timeout=1200)
        except urllib.error.HTTPError as exc:
            return exc

    def request(self, method, path, body=None, fields=None, file=None):
        headers, data = {"X-Requested-With": "bil-web"}, None
        if body is not None:
            data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
        elif fields is not None:
            boundary = uuid.uuid4().hex
            parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in fields.items()]
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file[0]}"\r\nContent-Type: text/plain\r\n\r\n'.encode() + file[1] + b"\r\n")
            data, headers["Content-Type"] = b"".join(parts) + f"--{boundary}--\r\n".encode(), f"multipart/form-data; boundary={boundary}"
        response = self._open(urllib.request.Request(self.api + path, data=data, method=method, headers=headers))
        raw = response.read()
        if response.status >= 400:
            return {"_http": response.status, "detail": raw.decode("utf-8", "replace")[:200]}
        return json.loads(raw) if raw and "json" in response.headers.get("content-type", "") else {"_raw": raw}

    def status_and_text(self, path):
        response = self._open(urllib.request.Request(self.api + path))
        return response.status, response.read().decode("utf-8", "replace")


def tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 3 and t not in STOP}


def matches(want: list, title: str, section: str | None, page: int | None) -> bool:
    """want = [title_substring, locator]; locator '' = any, 'p31' = page 31, otherwise a substring of the section."""
    needle, locator = want
    if needle.lower() not in title.lower():
        return False
    if not locator:
        return True
    options = locator.split("|")  # "p30|p31": a passage that straddles a page break may be cited from either page
    return any((page == int(o[1:])) if re.fullmatch(r"p\d+", o) else (o.lower() in (section or "").lower()) for o in options)


def setup_controls(admin: Client, setup: list[dict]) -> None:
    folders = {(f["business_line"], f["path"]): f["id"] for f in admin.request("GET", "/folders")}
    folder = folders.get(("corporate", "Public Information")) or admin.request("POST", "/folders", {"name": "Public Information", "business_line": "corporate"})["id"]
    for doc in setup:
        found = admin.request("GET", "/documents?" + urllib.parse.urlencode({"q": doc["title"], "page_size": 50}))["items"]
        if any(d["title"] == doc["title"] for d in found):
            continue
        document_id = None
        for version in doc["versions"]:
            content = (BANNER + version["text"] + "\n").encode()
            common = {"version_label": version["label"], "language": "en"}
            if document_id is None:
                created = admin.request("POST", "/documents/upload", fields={
                    "title": doc["title"], "description": "Fictional control document for the evaluation. Not BIL policy.",
                    "business_line": "corporate", "folder_id": folder, "doc_type": "other", "access_classification": doc["classification"],
                    "access_roles": ",".join(doc["roles"]), "is_demo_fixture": "true", **common}, file=("eval.txt", content))
                if created.get("_http"):
                    raise SystemExit(f"setup failed for {doc['title']}: {created}")
                document_id, version_id = created["id"], created["versions"][0]["id"]
            else:
                version_id = admin.request("POST", f"/documents/{document_id}/versions", fields=common, file=("eval.txt", content))["id"]
            if version["approve"]:
                admin.request("POST", f"/documents/{document_id}/versions/{version_id}/approve", {})
    for _ in range(90):  # wait until the index has caught up
        notes = " ".join(admin.request("GET", "/capabilities")["notes"])
        if re.search(r"\b0 waiting", notes):
            return
        time.sleep(5)
    print("warning: indexing did not finish within 7.5 minutes; results may be affected")


def evaluate(api: str, password: str, only: set[str] | None = None) -> dict:
    data = json.loads((ROOT / "questions.json").read_text())
    clients: dict[str, Client] = {}
    get = lambda role: clients.setdefault(role, Client(api, EMAIL[role], password))
    setup_controls(get("admin"), data["setup"])
    rows = []
    created: list[tuple[str, str]] = []  # (role, conversation id): the runner removes its own chats afterwards
    for q in data["questions"]:
        if only and q["id"].split("-")[0] not in only and q["id"] not in only:
            continue
        client, e = get(q["role"]), q["expect"]
        started = time.monotonic()
        result = client.request("POST", "/chat/ask", {"question": q["question"], "include_history": q.get("include_history", False)})
        latency = time.monotonic() - started
        row = {"id": q["id"], "latency_s": round(latency, 1), "status": result.get("status"), "checks": {}}
        if result.get("conversation_id"):
            created.append((q["role"], result["conversation_id"]))
        if result.get("_http"):
            row["checks"]["http_ok"] = False
            rows.append(row)
            continue
        cites = result["citations"]
        blob = json.dumps(result).lower()
        row["checks"]["status_ok"] = result["status"] == e["status"]
        if e.get("cite"):
            hits = client.request("POST", "/search", {"query": q["question"], "status": "history" if q.get("include_history") else "current"})
            top = [(h["title"], h["section"], h["page"]) for h in hits.get("items", [])][:8]
            row["recall_at_8"] = sum(1 for want in e["cite"] if any(matches(want, *t) for t in top)) / len(e["cite"])
            row["checks"]["citations_present"] = all(any(matches(want, c["title"], c["section"], c["page"]) for c in cites) for want in e["cite"])
        if cites:
            row["checks"]["citations_resolve"] = all(client.status_and_text(c["url"].split("#")[0])[0] == 200 for c in cites)
        if e.get("facts"):
            row["checks"]["key_facts"] = all(f.lower() in blob for f in e["facts"])
        if e.get("min_documents"):
            row["checks"]["multi_document"] = len({c["document_id"] for c in cites}) >= e["min_documents"]
        if e.get("no_superseded"):
            row["checks"]["current_versions_only"] = all(c["version_status"] == "approved_current" for c in cites)
        if e.get("must_cite_superseded"):
            row["checks"]["history_version_cited"] = any(c["version_status"] == "superseded" for c in cites)
        if e.get("warning"):
            row["checks"]["version_warning_shown"] = any(w["kind"] == e["warning"] for w in result["version_warnings"])
        if e.get("no_citations"):
            row["checks"]["abstained_without_sources"] = not cites and result["answer"] is None
        for forbidden in e.get("must_not_mention", []):
            row["checks"][f"no_leak:{forbidden[:24]}"] = forbidden.lower() not in blob
        if e.get("no_draft"):
            row["checks"]["no_draft_on_conflict"] = result["drafts"]["en"] is None
        if e["status"] == "answered":
            row["checks"]["english_draft"] = bool(result["drafts"]["en"])
        if result["claims"]:  # lexical groundedness proxy: share of each claim's content words found in the cited documents
            texts = {}
            for c in cites:  # text sources only: PDF bytes are not comparable word for word
                _, body = client.status_and_text(c["url"].split("#")[0])
                texts[c["id"]] = set() if body.startswith("%PDF") else tokens(body)
            scores = []
            for claim in result["claims"]:
                words = tokens(claim["text"])
                cited = set().union(*(texts.get(i, set()) for i in claim["citation_ids"])) if claim["citation_ids"] else set()
                if words and cited:
                    scores.append(len(words & cited) / len(words))
            if scores:
                row["groundedness_text_sources"] = round(sum(scores) / len(scores), 3)
        row["passed"] = all(row["checks"].values())
        rows.append(row)

    for role, conversation_id in created:  # leave nobody's chat history cluttered with evaluation questions
        get(role).request("DELETE", f"/chat/conversations/{conversation_id}")

    def rate(check):
        values = [r["checks"][check] for r in rows if check in r["checks"]]
        return {"passed": sum(values), "of": len(values)}

    real = [r for r in rows if r["id"].startswith("R")]
    lat = [r["latency_s"] for r in rows]
    recalls = [r["recall_at_8"] for r in rows if "recall_at_8" in r]
    grounded = [r["groundedness_text_sources"] for r in rows if "groundedness_text_sources" in r]
    summary = {
        "questions": len(rows), "fully_passed": sum(1 for r in rows if r.get("passed")),
        "real_document_questions_fully_passed": f"{sum(1 for r in real if r.get('passed'))}/{len(real)}",
        "control_questions_fully_passed": f"{sum(1 for r in rows if r['id'].startswith('C') and r.get('passed'))}/{len(rows) - len(real)}",
        **{name: rate(name) for name in ("status_ok", "citations_present", "citations_resolve", "key_facts", "multi_document",
                                          "current_versions_only", "history_version_cited", "version_warning_shown",
                                          "abstained_without_sources", "english_draft")},
        "recall_at_8_mean": round(statistics.mean(recalls), 3) if recalls else None,
        "groundedness_proxy_mean_text_sources": round(statistics.mean(grounded), 3) if grounded else None,
        "latency_mean_s": round(statistics.mean(lat), 1), "latency_median_s": round(statistics.median(lat), 1), "latency_max_s": max(lat),
    }
    return {"summary": summary, "rows": rows}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--password", required=True)
    parser.add_argument("--only", help="comma-separated question ids to run, e.g. R01,R05,C3")
    parser.add_argument("--out", default=str(ROOT.parents[2] / "docs" / "evaluation-results.json"))
    args = parser.parse_args()
    report = evaluate(args.api, args.password, set(args.only.split(",")) if args.only else None)
    Path(args.out).write_text(json.dumps(report, indent=2))
    for row in report["rows"]:
        failed = [k for k, v in row["checks"].items() if not v]
        print(f"{'PASS' if row.get('passed') else 'FAIL'}  {row['id']:<32} status={str(row['status']):<18} {row['latency_s']:>6}s  {('failed: ' + ', '.join(failed)) if failed else ''}")
    print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()
