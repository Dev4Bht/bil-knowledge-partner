# Security and governance

Scope for the hackathon: **unclassified, public-facing documents only. No customer personal data.**

## Authentication and sessions
* Email and password; hashes use Argon2. No plaintext passwords anywhere.
* Session is a signed JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` when `COOKIE_SECURE=true`).
* Login is rate limited per client and email; wrong email and wrong password give the same answer.
* **CSRF:** every state-changing request must carry `X-Requested-With: bil-web`. CORS allows only the configured web origin, so a cross-site page cannot send it.
* The API refuses the development `JWT_SECRET` when `APP_ENV=production`. Demo accounts and fixtures are created only outside production.

## Authorization (server side, never the UI)
| Rule | Behaviour |
|------|-----------|
| admin | everything |
| folder `required_role` | hides the folder and everything below it |
| classification | public: signed-in users; staff: staff, manager, admin; restricted: listed roles and admin |
| drafts | admin and manager only, and **never searchable by anyone** |
| unseen document | 404, identical to a missing one, plus a `denied` audit event |

Enforcement points: document, version, file and compare endpoints; the list endpoint; **inside the search query** (the permitted version ids are computed first and used as a hard filter); and again in the verifier before a citation can be returned. A passage a user may not read never reaches the model (tested).

## View-only documents
Documents are for reading in the app, not for taking away. This is what is enforced and what is not.

**Enforced on the server**
- **No original file for anyone by default.** `GET .../file` answers 403 `view_only` to staff, managers and admins. `ALLOW_ORIGINAL_DOWNLOAD=true` lets managers and admins (never staff) fetch it, and the web app then shows a "Download original" button; with it off the app shows no download or "open file" link anywhere.
- **Pages are rendered images.** A PDF page is rasterised on the server; text and Word documents are laid out and drawn. The browser receives a JPEG with no text layer and no original bytes, with `Cache-Control: no-store`.
- **Every page is watermarked** across its whole area with the viewer's name, email, the time (UTC) and "view only", plus a footer line. Two people never receive identical bytes for the same page (tested), so a leaked capture identifies who viewed it.
- **Same visibility rules as everything else.** Drafts, unseen and restricted documents answer 404 on the viewer endpoints exactly as on the file endpoint. Denied download attempts are audited (`file.download`, result `denied`); each opening of the viewer is audited (`file.view`, with the page count and never any content).
- **Rate limit:** 90 page images per person per minute, to make scraping a library slow (429 `too_many_pages`).

**Deterrents in the browser (these can be bypassed by a determined person)**
- The viewer switches off the context menu, copy, cut and drag, disables text selection and image dragging, and shows a print-only note instead of the page when printed. Where the browser reports the PrintScreen key (Windows) it blanks the page for about 2.5 seconds and empties the clipboard.

**What this cannot do**
- **It cannot stop screenshots, screen recordings or a photo of the screen.** A web page cannot control the operating system or a phone camera. The watermark and the audit trail make a capture traceable and discouraging; they do not prevent it.
- Someone who is allowed to see a page can still write down or retype what they read.
- The answers, citations' short quoted passages and draft replies are text and can be copied: staff need to copy draft replies. Only document pages are protected.
- Accessibility: page images have no text for screen readers. The alt text says so. Anyone who needs an accessible copy has to ask the document owners for one through a process outside this prototype.
- A passage's quoted snippet in a citation is shown as text (a few hundred characters), and the search index holds extracted text server-side; neither is the document.

## Uploads
Extension whitelist (PDF, DOCX, TXT), content signature check, UTF-8 and binary check for text, size limit, sanitised file name that is never used in a storage path (keys are built from ids and the hash), write-once storage. Plain text containing CID-style 11-digit numbers is rejected, and the number is never echoed back. PDF and DOCX are not screened for personal data yet.

## Prompt injection
Documents are untrusted. Evidence is HTML-escaped and fenced in `<evidence>` tags so a passage cannot close the fence; every prompt states that document instructions must be ignored; the model has no tools that act on anything. Even if a model were fooled, its claims still need real, permitted citations, and any figure must appear in the cited text, so an injected statement cannot become a verified answer unless a current document actually says it.

## Logging
`audit_events` stores actor, event, resource, result and counts. Question and answer text is never logged (tested). The manager/admin dashboard is built only from those records and from counts of documents and jobs; it exposes no text, titles, names or emails (tested). Chat messages are stored for follow-ups; questions containing CID-style numbers are refused.

## Known gaps
* The login rate limiter is in memory (single process).
* No account management UI; demo accounts only.
* Dzongkha output is machine translation and needs human validation; the NLLB weights are non-commercial (CC-BY-NC 4.0).
* The two-role access model (roles, not individual users) is a stand-in until BIL's permission model is known.
