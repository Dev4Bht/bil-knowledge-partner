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
