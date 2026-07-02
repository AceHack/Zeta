#!/usr/bin/env bun
/**
 * phase7-csp-proof.ts — static CSP hardening regression guard for the inventory
 * viewer (git-as-database era; supabase-specific SRI checks retired with the
 * backend 2026-07-02 — lineage in git history).
 *
 * Asserts the shipped index.html keeps:
 *   - a locked CSP: script-src 'self', style-src 'self', connect-src 'self' —
 *     no 'unsafe-inline', no 'unsafe-eval', NO off-origin host anywhere.
 *   - no inline <script> bodies, no <style> blocks, no style="" attrs,
 *     no on*= handler attributes.
 *   - every script src/link stylesheet same-origin AND present on disk.
 *
 * Run: bun inventory/proofs/phase7-csp-proof.ts [htmlPath]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const htmlPath = Bun.argv[2] ?? join(import.meta.dir, "..", "index.html");
const html = readFileSync(htmlPath, "utf8");
let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
}

const cspMatch = html.match(/http-equiv=["']Content-Security-Policy["']\s+content="([^"]*)"/i);
check("CSP meta tag present", cspMatch !== null);
const csp = (cspMatch?.[1] ?? "").replace(/\s+/g, " ");

for (const d of ["default-src", "script-src", "style-src", "connect-src"]) {
  const dir = csp.match(new RegExp(`${d}([^;]*);`));
  check(`${d} present`, dir !== null);
  const v = dir?.[1] ?? "";
  check(`${d} is 'self'-only (no off-origin, no unsafe-*)`, v.trim() === "'self'", `got:${v.trim()}`);
}
check("base-uri locked", /base-uri 'none'/.test(csp));
check("object-src locked", /object-src 'none'/.test(csp));
check("form-action locked", /form-action 'none'/.test(csp));

check("no inline <script> bodies", ![...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].some((m) => m[2]!.trim().length > 0));
check("no <style> blocks", !/<style[\s>]/i.test(html));
check("no style= attributes", !/\sstyle=["']/i.test(html));
check("no inline on*= handlers", !/\son[a-z]+=["']/i.test(html));

const dir = dirname(htmlPath);
for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
  const src = m[1]!;
  check(`script src same-origin: ${src}`, !/^(https?:)?\/\//i.test(src));
  check(`script exists on disk: ${src}`, existsSync(join(dir, src)));
}
for (const m of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)) {
  const href = m[1]!;
  check(`stylesheet same-origin: ${href}`, !/^(https?:)?\/\//i.test(href));
  check(`stylesheet exists on disk: ${href}`, existsSync(join(dir, href)));
}

if (failures > 0) {
  console.error(`\n${failures} CSP hardening check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll CSP hardening checks passed.");
