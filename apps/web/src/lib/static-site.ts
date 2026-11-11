/**
 * The public landing-page build (`pnpm build:static`) has no API behind it: the real app needs a database and local
 * language models. In that build there is no sign-in, so the page must not offer a demo it cannot run.
 */
export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";
/** Set when the static site is served from a sub-path, such as a GitHub project page. Plain <img> tags need it. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/**
 * Where the real app is reachable, for the static public copy only (set `NEXT_PUBLIC_APP_URL` when building it).
 * Empty means "no hosted app", and the page then says the demo runs locally instead of showing a dead link.
 */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
