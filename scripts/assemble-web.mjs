#!/usr/bin/env node
/**
 * Assemble the two web surfaces into a single deployable directory:
 *
 *   dist/            Astro landing (owns /, /es/, /_astro/*, /favicon.webp)
 *   dist/app/        React SPA (base /app/, deep links rewritten to
 *                    /app/index.html by firebase.json and nginx.conf)
 *
 * Both hosts serve the same tree, so /auth/* and the public pages rewrite to
 * /app/index.html and the password-reset links keep working unchanged.
 * Capacitor does NOT use this output: it builds the SPA with base './'.
 */
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const landingDist = join(root, "apps/landing/dist");
const webDist = join(root, "apps/webClient/dist");
const out = join(root, "dist");

await rm(out, { recursive: true, force: true });
await mkdir(join(out, "app"), { recursive: true });
await cp(landingDist, out, { recursive: true });
await cp(webDist, join(out, "app"), { recursive: true });

console.log("✓ dist/ assembled: landing at /, SPA at /app/");
