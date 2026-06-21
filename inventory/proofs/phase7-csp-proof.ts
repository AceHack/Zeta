/**
 * Inventory — Phase 7 Part 1 CSP-hardening proof (static analysis of index.html)
 * ---------------------------------------------------------------------------
 * Gate: the CSP must drop 'unsafe-inline' (script + style) and the cdn.jsdelivr.net
 * origin, and the page must contain NO inline JS/CSS that would require them.
 *
 * WHAT THIS PROVES (and what it does NOT):
 *   - PROVES, statically, that the SHIPPED index.html has:
 *       * a CSP whose script-src and style-src are exactly ['self'] — no
 *         'unsafe-inline', no 'unsafe-eval', no off-origin script host;
 *       * no inline script body (every script tag has a src=), no style block,
 *         no inline style attributes, no on*= handlers, no javascript: URLs;
 *       * supabase-js loaded SAME-ORIGIN (lib/) with an integrity= (SRI) attr
 *         whose hash MATCHES the vendored file on disk (catches SRI drift).
 *   - Parses the CSP's content="" attribute specifically, and strips HTML
 *     comments before the structural scans, so explanatory COMMENTS that merely
 *     mention the forbidden constructs do not false-positive.
 *   - Does NOT load a browser or confirm the absence of runtime CSP console
 *     violations on the deployed site — that is the Part-2 Auditor's live check
 *     (no browser in this build env; same deferral precedent as the Phase-3/5/6
 *     browser proofs).
 *
 * Run:   bun inventory/proofs/phase7-csp-proof.ts [htmlPath] [supabaseFilePath]
 *        (paths default to the shipped files; overridable so the "fails on broken
 *         code" demonstration can point at a deliberately-broken temp copy.)
 * Exit:  0 = all checks pass; 1 = one or more failed (prints each).
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const htmlPath = process.argv[2] ?? resolve(import.meta.dir, "../index.html");
const html = readFileSync(htmlPath, "utf8");

const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log("PASS: " + name);
  else { console.log(`FAIL: ${name}${detail ? " — " + detail : ""}`); failures.push(name); }
}

// ---- Extract the CSP meta's content="" (the ACTUAL policy, not comments) -------
const cspMeta = html.match(
  /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([\s\S]*?)["']\s*\/?>/i,
);
check("CSP meta present", cspMeta !== null);
const csp = (cspMeta?.[1] ?? "").replace(/\s+/g, " ").trim();

// Parse "name a b c;" directives -> Map<name, tokens[]>
const directives = new Map<string, string[]>();
for (const part of csp.split(";")) {
  const toks = part.trim().split(/\s+/).filter(Boolean);
  const name = toks[0];
  if (name) directives.set(name.toLowerCase(), toks.slice(1));
}
const scriptSrc = directives.get("script-src") ?? [];
const styleSrc = directives.get("style-src") ?? [];

check("CSP script-src is exactly 'self'", scriptSrc.length === 1 && scriptSrc[0] === "'self'",
  `script-src = [${scriptSrc.join(" ")}]`);
check("CSP style-src is exactly 'self'", styleSrc.length === 1 && styleSrc[0] === "'self'",
  `style-src = [${styleSrc.join(" ")}]`);
check("CSP has no 'unsafe-inline' anywhere", !/'unsafe-inline'/i.test(csp));
check("CSP has no 'unsafe-eval' anywhere", !/'unsafe-eval'/i.test(csp));
check("CSP allows no cdn.jsdelivr.net origin", !/cdn\.jsdelivr\.net/i.test(csp));

// ---- No inline JS/CSS surfaces in the document -------------------------------
// Scan with HTML COMMENTS STRIPPED: comments never execute, so explanatory text
// that mentions inline script/style/style= must not false-positive (the same
// reason the CSP check parses only the content="" attribute, not the whole file).
const code = html.replace(/<!--[\s\S]*?-->/g, "");
// Every script tag must carry a src=; none may have an inline body.
const scriptTags = [...code.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const inlineScripts = scriptTags.filter((m) => {
  const attrs = m[1] ?? "";
  const body = m[2] ?? "";
  return !/\bsrc=/.test(attrs) || body.trim() !== "";
});
check("no inline script body (all script tags are src=)", inlineScripts.length === 0,
  `${inlineScripts.length} inline script block(s)`);

check("no style block", !/<style\b/i.test(code));
// inline style attributes (need style-src 'unsafe-inline')
const styleAttrs = [...code.matchAll(/\sstyle\s*=\s*["']/gi)];
check("no inline style attributes", styleAttrs.length === 0, `${styleAttrs.length} found`);
// inline event handlers (onclick=, onerror=, ...) and javascript: URLs
const onHandlers = [...code.matchAll(/\son[a-z]+\s*=\s*["']/gi)];
check("no inline on*= event handlers", onHandlers.length === 0, `${onHandlers.length} found`);
check("no javascript: URLs", !/javascript:/i.test(code));

// ---- supabase-js: same-origin + SRI matching the vendored file ---------------
const sbTag = html.match(/<script\b[^>]*\bsrc=["'](lib\/supabase-js[^"']+)["'][^>]*>/i);
check("supabase-js loaded same-origin from lib/", sbTag !== null,
  sbTag ? "" : "no lib/supabase-js* script tag found");
if (sbTag) {
  const fullTag = sbTag[0];
  const integrity = fullTag.match(/integrity=["'](sha\d+-[^"']+)["']/i)?.[1];
  check("supabase-js script tag has an integrity= (SRI) attribute", integrity !== undefined);
  const sbSrc = sbTag[1] ?? "";
  check("supabase-js is NOT loaded from an off-origin CDN", !/https?:\/\//.test(sbSrc));
  if (integrity) {
    const sbFile = process.argv[3] ?? resolve(import.meta.dir, "..", sbSrc);
    const bytes = readFileSync(sbFile);
    const want = "sha384-" + createHash("sha384").update(bytes).digest("base64");
    check("SRI integrity matches the vendored file on disk", integrity === want,
      `attr=${integrity} file=${want}`);
  }
}

// ---- Verdict -----------------------------------------------------------------
console.log("");
if (failures.length === 0) {
  console.log(`CSP hardening proof OK — all checks passed (${htmlPath}).`);
  process.exit(0);
} else {
  console.log(`CSP hardening proof FAILED — ${failures.length} check(s): ${failures.join(", ")}`);
  process.exit(1);
}
