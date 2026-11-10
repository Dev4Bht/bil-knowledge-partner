"""Import REAL public documents from the official BIL and RMA websites into the DMS, through the real API.

Downloads with curl (full TLS verification), converts BIL web pages to clean text, then uploads and approves each
document through the same endpoints (and the same validation) a person would use. Every document records its source
URL, retrieval date and SHA-256 in its lineage. Nothing is committed to git: downloads go to data/public_cache/.

    uv run python scripts/import_public_documents.py --password "$DEMO_PASSWORD"
    options: --api URL  --email EMAIL  --only pdf|web  --limit N  --dry-run

The documents are public-facing, but "approved" here means approved by the person running this import in the demo
DMS. It is not BIL's internal approval and the copies have not been compared with BIL's internal versions.
"""

import argparse
import hashlib
import html
import http.cookiejar
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import public_sources as src  # noqa: E402

CACHE = Path(__file__).resolve().parents[3] / "data" / "public_cache"
UA = "Mozilla/5.0 (BIL knowledge partner prototype; fetching public documents)"
TODAY = date.today().isoformat()
NEW_FOLDERS = {("corporate", "RMA Regulations"), ("corporate", "Public Information")}
JUNK = {"-", "/", "home", "toll free number", "document", "documents", "loading...", "accept", "read more", "info@bil.bt", "2011"}
BOILERPLATE = re.compile(r"^(we use cookie|404!)", re.I)


def download(url: str) -> Path | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / (hashlib.sha1(url.encode()).hexdigest() + Path(urllib.parse.urlparse(url).path).suffix.lower()[:6])
    if target.exists() and target.stat().st_size > 0:
        return target
    result = subprocess.run(["curl", "-fsSL", "--max-time", "180", "-A", UA, "-o", str(target), url], capture_output=True)
    if result.returncode != 0 or not target.exists() or target.stat().st_size == 0:
        target.unlink(missing_ok=True)
        return None
    return target


def humanize(path: str) -> str:
    def one(segment: str) -> str:
        return re.sub(r"\bS\b", "'s", segment.replace("-s-", "-'s-").replace("-", " ").title()).replace(" 's ", "'s ")
    return " - ".join(one(seg) for seg in path.split("/"))


def html_to_text(raw: bytes) -> str:
    text = raw.decode("utf-8", "replace")
    text = re.sub(r"(?is)<(script|style|svg|noscript|nav|header|footer|aside|form|template)\b[^>]*>.*?</\1>", "", text)
    text = re.sub(r"(?is)<!--.*?-->", "", text)
    text = re.sub(r"(?i)<h[1-6][^>]*>", "\n## ", text)
    text = re.sub(r"(?i)</h[1-6]>", "\n", text)
    text = re.sub(r"(?i)<li[^>]*>", "\n- ", text)
    text = re.sub(r"(?i)</?(p|div|br|tr|section|article|table|ul|ol|td|th)\b[^>]*>", "\n", text)
    text = html.unescape(re.sub(r"<[^>]+>", "", text)).replace("\xa0", " ")
    lines, previous = [], None
    for line in (re.sub(r"[ \t]+", " ", l).strip() for l in text.splitlines()):
        if not line or line.lower() in JUNK or BOILERPLATE.match(line) or line == previous:
            continue
        lines.append(line)
        previous = line
    if "no data found" in text.lower():  # BIL serves some empty pages with a 404 message inside a 200 response
        return ""
    first_heading = next((i for i, l in enumerate(lines) if l.startswith("## ")), None)
    if first_heading is not None:  # everything before the first heading is the page title and breadcrumb navigation
        lines = lines[first_heading:]
    return "\n".join(lines)


class Api:
    def __init__(self, base: str, email: str, password: str):
        self.base = base.rstrip("/")
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.call("POST", "/auth/login", json_body={"email": email, "password": password})

    def call(self, method, path, *, json_body=None, fields=None, file=None):
        headers = {"X-Requested-With": "bil-web"}
        data = None
        if json_body is not None:
            data, headers["Content-Type"] = json.dumps(json_body).encode(), "application/json"
        elif fields is not None:
            boundary = uuid.uuid4().hex
            parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in fields.items() if v is not None]
            name, content, ctype = file
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + content + b"\r\n")
            data, headers["Content-Type"] = b"".join(parts) + f"--{boundary}--\r\n".encode(), f"multipart/form-data; boundary={boundary}"
        request = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with self.opener.open(request, timeout=300) as response:
                body = response.read()
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            try:
                detail = json.loads(detail).get("detail", detail)
            except Exception:
                pass
            raise RuntimeError(f"{exc.code} {detail}") from None


def lineage_pdf(url: str, sha: str, publisher: str) -> str:
    return f"Official public document published by {publisher}: {url} . Retrieved {TODAY}. SHA-256 {sha}."[:990]


def lineage_web(url: str, sha: str) -> str:
    return f"Official public BIL web page {url} . Retrieved {TODAY}. Text copy made by this project (layout, images and links are not kept). SHA-256 of the text {sha}."[:990]


def plan_items(only: str | None):
    items = []
    if only in (None, "pdf"):
        for title, line, folder, doc_type, publisher, versions in src.PDFS:
            items.append(dict(kind="pdf", title=title, line=line, folder=folder, doc_type=doc_type, publisher=publisher, versions=versions))
    if only in (None, "web"):
        for path, line, folder, doc_type in src.WEB:
            url = f"{src.BIL}/{path}"
            items.append(dict(kind="web", title="BIL website: " + humanize(path), line=line, folder=folder, doc_type=doc_type,
                              publisher="Bhutan Insurance Limited", versions=[("web copy " + TODAY, url, None)]))
    return items


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--email", default="admin@demo.bil.test")
    parser.add_argument("--password", required=True)
    parser.add_argument("--only", choices=["pdf", "web"])
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    items = plan_items(args.only)[: args.limit]
    api = None if args.dry_run else Api(args.api, args.email, args.password)

    folders: dict[tuple[str, str], str] = {}
    if api:
        for (line, name) in NEW_FOLDERS:
            if not any(f["business_line"] == line and f["path"] == name for f in api.call("GET", "/folders")):
                api.call("POST", "/folders", json_body={"name": name, "business_line": line})
        folders = {(f["business_line"], f["path"]): f["id"] for f in api.call("GET", "/folders")}

    done, skipped, failed = [], [], []
    for item in items:
        title = item["title"]
        try:
            if api:
                existing = api.call("GET", "/documents?" + urllib.parse.urlencode({"q": title, "page_size": 50}))["items"]
                if any(d["title"] == title and not d["is_demo_fixture"] for d in existing):
                    skipped.append((title, "already imported"))
                    continue
            document_id = None
            for label, url, effective in item["versions"]:
                path = download(url)
                if path is None:
                    raise RuntimeError(f"download failed: {url}")
                raw = path.read_bytes()
                if item["kind"] == "web":
                    text = html_to_text(raw)
                    if len(text) < 200:
                        raise RuntimeError("skipped: the static page has no real content (it is empty or loaded by JavaScript)")
                    content, name, ctype = text.encode(), re.sub(r"[^A-Za-z0-9]+", "_", urllib.parse.urlparse(url).path.strip("/") or "home") + ".txt", "text/plain"
                    lineage = lineage_web(url, hashlib.sha256(content).hexdigest())
                else:
                    if not raw.startswith(b"%PDF-"):
                        raise RuntimeError("not a PDF")
                    content, name, ctype = raw, Path(urllib.parse.unquote(urllib.parse.urlparse(url).path)).name, "application/pdf"
                    lineage = lineage_pdf(url, hashlib.sha256(raw).hexdigest(), item["publisher"])
                if args.dry_run:
                    print(f"would import: {title} [{label}] {len(content)} bytes")
                    continue
                common = {"version_label": label, "effective_from": effective, "language": "en", "source_lineage": lineage}
                if document_id is None:
                    created = api.call("POST", "/documents/upload", fields={
                        "title": title, "description": f"Published by {item['publisher']}. Imported from the official public website on {TODAY}; not verified against BIL's internal approved version.",
                        "business_line": item["line"], "folder_id": folders[(item["line"], item["folder"])],
                        "doc_type": item["doc_type"], "access_classification": "public", "is_demo_fixture": "false", **common}, file=(name, content, ctype))
                    document_id, version_id = created["id"], created["versions"][0]["id"]
                else:
                    version_id = api.call("POST", f"/documents/{document_id}/versions", fields=common, file=(name, content, ctype))["id"]
                api.call("POST", f"/documents/{document_id}/versions/{version_id}/approve", json_body={})
            if not args.dry_run:
                done.append(title)
        except Exception as exc:
            failed.append((title, str(exc)[:200]))
    print(f"\nimported {len(done)}, already present {len(skipped)}, failed {len(failed)}")
    for title, reason in failed:
        print(f"  FAILED: {title}: {reason}")


if __name__ == "__main__":
    main()
