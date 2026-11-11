# Deploying

## What can be hosted for free, and what cannot

| Part | Free static hosting | Why |
|------|--------------------|-----|
| **Landing page** (what the agents do, trust rules, measured results, limits) | **Yes** | It is plain HTML, CSS and JavaScript. |
| **The app** (sign-in, Documents, Ask, Dashboard) | **No** | It needs PostgreSQL with pgvector, the API, and local language models (Qwen3 8B and BGE-M3 through Ollama). A free host cannot run an 8B model, and `CLAUDE.md` forbids sending documents to a cloud AI API. |

So the public copy is the landing page only. It describes the prototype and says plainly that the demo runs on a laptop; it has no sign-in button, makes no API calls, and asks search engines not to index it (it is a hackathon prototype that uses BIL's name; remove `robots` in `apps/web/src/app/page.tsx` if its owners want it listed).

The app itself is run with Docker Compose, see the README.

## Linking the landing page and the app

- **In the full app** the landing page (`/`) links to the app ("Try the demo" goes to sign-in, "Open the app" to Ask when signed in), and the app links back: the logo in the side rail and on the sign-in screen, and an "About this prototype" link in the rail.
- **In the public static copy** there is no app to link to, so it says the demo runs locally. If the app is reachable somewhere you control, build with `NEXT_PUBLIC_APP_URL=https://your-app-host pnpm build:static` and "Try the demo" and "Sign in" point to `https://your-app-host/login`. Do not point it at an app you have not secured: the demo accounts use a published password (see "If you share the running demo instead").

## Build the static landing page

```bash
cd apps/web
pnpm build:static                       # writes apps/web/dist-landing/ (about 2 MB)
STATIC_BASE_PATH=/bil pnpm build:static # if it will be served from a sub-path such as https://host/bil/
```

This copies only the landing page into a scratch folder and builds it with `output: "export"`; the real app is untouched. The folder includes a `_headers` file (content security policy, no framing, no referrer) that Cloudflare Pages and Netlify read.

Check it the way a host would serve it:

```bash
(cd dist-landing && python3 -m http.server 3481) &
node e2e/static-landing.mjs http://localhost:3481/
```

The check confirms the page loads, the hero image loads, there is no demo or sign-in link, no request leaves the site (nothing tries to reach an API), no console errors, and it fits a 360 px phone.

## Put it online

Any of these serves `dist-landing/` as-is. Each needs an account of yours and a one-time login, which cannot be done on your behalf. Free-tier terms change, so check the host's current limits.

| Host | Command |
|------|---------|
| Cloudflare Pages | `npx wrangler login`, then `npx wrangler pages deploy dist-landing --project-name bil-knowledge-partner` |
| Netlify | `npx netlify-cli login`, then `npx netlify-cli deploy --dir dist-landing --prod` |
| Vercel | `npx vercel login`, then `npx vercel deploy dist-landing --prod` |
| GitHub Pages | Needs a public repository (or a paid plan for a private one). Build with `STATIC_BASE_PATH=/<repo-name>`, then publish `dist-landing/` from a workflow or a `gh-pages` branch. This repository is private, so it is not an option today. |

## Live copy

The landing page is published at **https://dev4bht.github.io/bil-knowledge-partner/** (GitHub Pages, from the `gh-pages` branch of the public repository https://github.com/Dev4Bht/bil-knowledge-partner).

This private repository cannot use GitHub Pages on a free plan, and publishing it would expose its history, so the public repository is a **separate copy**: the same files, with author emails rewritten to the GitHub no-reply address. It does not update itself. To refresh the live page:

```bash
cd apps/web
STATIC_BASE_PATH=/bil-knowledge-partner pnpm build:static
# in a clone of the public repository: replace the contents of the gh-pages branch with dist-landing/,
# add an empty .nojekyll file (GitHub would otherwise drop the _next folder), commit and push.
node e2e/static-landing.mjs https://dev4bht.github.io/bil-knowledge-partner/   # check the live page
```

To take it down: `gh repo delete Dev4Bht/bil-knowledge-partner`.

The public repository has no licence, so by default all rights are reserved.

## Keep it honest

The result figures on the page come from `apps/web/src/features/landing/content.ts`, copied from `docs/evaluation.md`. Update both together and rebuild before publishing.

## If you share the running demo instead

Do not expose the full app to the internet as it stands. Its demo accounts use a published password, and the API's CORS and cookie settings are for `localhost`. Change the demo password, restrict who can reach it, and review `docs/security.md` first.
