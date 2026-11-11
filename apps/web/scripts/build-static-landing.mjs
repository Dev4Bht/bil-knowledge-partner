// Builds the public landing page as a plain static folder (dist-landing/) that any free static host can serve.
//
// Why a separate build: the real app needs PostgreSQL, the API and local language models, none of which a free
// static host provides. This copies only the landing page into a scratch directory, builds it with
// `output: "export"`, and leaves the real app untouched.
//
// Usage:  pnpm build:static            (served from the site root)
//         STATIC_BASE_PATH=/bil pnpm build:static   (served from a sub-path, e.g. a GitHub project page)
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(root, ".static-build");
const out = join(root, "dist-landing");
const basePath = (process.env.STATIC_BASE_PATH ?? "").replace(/\/+$/, "");
if (basePath && !/^\/[A-Za-z0-9._~/-]+$/.test(basePath)) throw new Error(`STATIC_BASE_PATH must look like /name, got "${basePath}"`);

rmSync(work, { recursive: true, force: true });
rmSync(out, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

// Only what the landing page needs. The signed-in app and sign-in page are left out on purpose.
// Tests and their helpers are not part of a public build.
cpSync(join(root, "src"), join(work, "src"), { recursive: true, filter: (from) => !/\.test\.tsx?$/.test(from) && !from.endsWith(`${join("src", "test")}`) });
for (const gone of ["(app)", "login"]) rmSync(join(work, "src", "app", gone), { recursive: true, force: true });
cpSync(join(root, "public"), join(work, "public"), { recursive: true });
for (const file of ["package.json", "tsconfig.json", "next-env.d.ts"]) if (existsSync(join(root, file))) cpSync(join(root, file), join(work, file));
symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");

writeFileSync(join(work, "next.config.ts"), `import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ${basePath ? `basePath: ${JSON.stringify(basePath)},` : ""}
  turbopack: { rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } } },
};
export default nextConfig;
`);

const env = { ...process.env, NEXT_PUBLIC_STATIC_SITE: "1", NEXT_PUBLIC_BASE_PATH: basePath, NEXT_TELEMETRY_DISABLED: "1" };
const build = spawnSync("pnpm", ["exec", "next", "build"], { cwd: work, env, stdio: "inherit" });
if (build.status !== 0) {
  console.error("Static build failed.");
  process.exit(build.status ?? 1);
}

cpSync(join(work, "out"), out, { recursive: true });
// Security headers for hosts that read a _headers file (Cloudflare Pages, Netlify). The page needs inline scripts and
// styles from Next.js and the theme boot script, and nothing from any other origin.
writeFileSync(join(out, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
`);
rmSync(work, { recursive: true, force: true });
console.log(`\nStatic site written to ${out}${basePath ? ` (base path ${basePath})` : ""}`);
