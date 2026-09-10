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
 *
 * WHY THIS PARSES HTML INSTEAD OF GREPPING IT (2026-09-09, CodeQL js/bad-tag-filter,
 * alert 461). Every fact above used to be established with a regular expression, and
 * MEASURED against eight adversarial fixtures, ALL EIGHT walked through the gate
 * undetected:
 *
 *   payload                                   old verdict
 *   ----------------------------------------  ------------------------------------
 *   <script>alert(1)</script >                "no inline <script> bodies"  PASS
 *   <script>alert(1)</script\n> / \t> / />     same                         PASS
 *   <script>alert(1)</SCRIPT >                same                         PASS
 *   <div onclick=alert(1)>                    "no inline on*= handlers"    PASS
 *   <div style=color:red>                     "no style= attributes"       PASS
 *   <script src=//evil.example/x.js>          same-origin loop RAN ZERO TIMES
 *
 * The first five are the end-tag hole CodeQL named: `<\/script>` does not match a close
 * tag with trailing whitespace or a solidus, and a browser accepts all of them. A gate a
 * space walks through is not a gate. The next two are the quote hole: `["']` after the
 * `=` means an UNQUOTED attribute value is invisible to the check.
 *
 * The last is the worst and CodeQL did not name it. The same-origin/on-disk assertions are
 * a `for` loop over regex matches, so a script tag the regex cannot see produces ZERO
 * iterations and therefore ZERO failures — a check that did not run, reported as one that
 * passed. That is the vacuity class, and it is why `nonVacuous` checks below assert the
 * loops found something before trusting that they found nothing wrong.
 *
 * The fix is to stop pattern-matching a context-sensitive grammar. HTMLRewriter is Bun's
 * binding to lol-html, a spec-compliant streaming HTML parser, so tag boundaries, attribute
 * quoting, case folding and comment context are decided by the same rules a browser uses.
 * All eight payloads are caught, and a script inside an HTML comment is correctly NOT
 * flagged — a false positive the regex version would have raised.
 *
 * Falsifier: phase7-csp-proof.test.ts drives every payload above through
 * `cspHardeningReport` and requires a named FAILING check for each. Mutate any barrier
 * here and a test goes red.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** One assertion in the report. `ok === false` is a hardening regression. */
export interface CheckResult {
  readonly label: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** Facts a spec-compliant HTML parse establishes about the document. */
export interface HtmlFacts {
  /** `content` of the Content-Security-Policy <meta>, or null when absent. */
  readonly cspContent: string | null;
  /** Non-empty bodies of <script> elements. Inline JS, whatever the close tag looks like. */
  readonly inlineScriptBodies: readonly string[];
  /** `src` of every <script> element that has one. */
  readonly scriptSrcs: readonly string[];
  /** Number of <style> elements. */
  readonly styleBlockCount: number;
  /** `tag[style]` for every element carrying a style attribute, quoted or not. */
  readonly styleAttrSites: readonly string[];
  /** `tag[onfoo]` for every element carrying an event-handler attribute, quoted or not. */
  readonly eventHandlerSites: readonly string[];
  /** `href` of every <link rel=stylesheet>. */
  readonly stylesheetHrefs: readonly string[];
}
/**
 * An HTML event-handler content attribute. Matched on the parser-normalized (lowercased)
 * attribute NAME only, so quoting of the value is irrelevant — which is the whole point:
 * the previous regex required a quote character and therefore missed `onclick=alert(1)`.
 */
const EVENT_HANDLER_ATTR = /^on[a-z0-9-]+$/;

/**
 * Parse `html` with lol-html (via Bun HTMLRewriter) and collect the hardening-relevant facts.
 *
 * Streaming parse, so <script> text arrives in chunks AFTER that element handler and BEFORE
 * the next one; bodies are accumulated against the most recently opened <script>.
 */
export async function parseHtmlFacts(html: string): Promise<HtmlFacts> {
  let cspContent: string | null = null;
  const scriptBodies: string[] = [];
  const scriptSrcs: string[] = [];
  const styleAttrSites: string[] = [];
  const eventHandlerSites: string[] = [];
  const stylesheetHrefs: string[] = [];
  let styleBlockCount = 0;
  let openScript = -1;

  const rewriter = new HTMLRewriter()
    .on("script", {
      element(el) {
        const src = el.getAttribute("src");
        if (src !== null) scriptSrcs.push(src);
        openScript = scriptBodies.push("") - 1;
      },
      text(chunk) {
        if (openScript >= 0) scriptBodies[openScript] += chunk.text;
      },
    })
    .on("style", { element() { styleBlockCount += 1; } })
    .on("meta", {
      element(el) {
        const equiv = (el.getAttribute("http-equiv") ?? "").trim().toLowerCase();
        if (equiv === "content-security-policy" && cspContent === null) {
          cspContent = el.getAttribute("content");
        }
      },
    })
    .on("link", {
      element(el) {
        const rel = (el.getAttribute("rel") ?? "").trim().toLowerCase().split(/\s+/);
        const href = el.getAttribute("href");
        if (rel.includes("stylesheet") && href !== null) stylesheetHrefs.push(href);
      },
    })
    .on("*", {
      element(el) {
        const tag = el.tagName.toLowerCase();
        for (const [rawName] of el.attributes) {
          const name = rawName.toLowerCase();
          if (name === "style") styleAttrSites.push(tag + "[style]");
          else if (EVENT_HANDLER_ATTR.test(name)) eventHandlerSites.push(tag + "[" + name + "]");
        }
      },
    });

  await rewriter.transform(new Response(html)).text();

  return {
    cspContent,
    inlineScriptBodies: scriptBodies.filter((b) => b.trim().length > 0),
    scriptSrcs,
    styleBlockCount,
    styleAttrSites,
    eventHandlerSites,
    stylesheetHrefs,
  };
}
/**
 * Split a CSP `content` value into directive -> source-list.
 *
 * Models the browser: directives are `;`-separated, the name is the first
 * whitespace-separated token, and a DUPLICATE directive is IGNORED (CSP Level 3 §6.1 —
 * "if policy contains a directive whose name is directiveName, ignore this directive").
 * First-wins matters here: a policy that says `script-src 'self'; script-src *` is
 * locked, and one that says `script-src *; script-src 'self'` is not. `duplicates`
 * is reported separately because a duplicate is a policy that means something other than
 * what it looks like, and that is worth failing on even when the effective value is safe.
 */
export function parseCsp(content: string): { directives: Map<string, string[]>; duplicates: string[] } {
  const directives = new Map<string, string[]>();
  const duplicates: string[] = [];
  for (const part of content.split(";")) {
    const tokens = part.trim().split(/\s+/).filter((t) => t.length > 0);
    const name = tokens[0];
    if (name === undefined) continue;
    const key = name.toLowerCase();
    if (directives.has(key)) duplicates.push(key);
    else directives.set(key, tokens.slice(1));
  }
  return { directives, duplicates };
}

/** Opaque base used only to decide whether a reference stays on its own origin. */
const SAME_ORIGIN_BASE = "https://inventory.invalid/";

/**
 * True when `ref` resolves to the SAME ORIGIN as the document.
 *
 * Resolved with the WHATWG URL parser rather than tested with `/^(https?:)?\/\//`, so
 * `//evil.example/x.js`, ` //evil.example/x.js`, `\\evil.example\x.js` (backslashes are
 * normalized to solidi for special schemes), `https://evil.example/x.js` and `data:`/
 * `javascript:` URLs are all off-origin, and a relative path is not.
 */
export function isSameOrigin(ref: string): boolean {
  try {
    return new URL(ref.trim(), SAME_ORIGIN_BASE).origin === new URL(SAME_ORIGIN_BASE).origin;
  } catch {
    return false;
  }
}

/** Filesystem path a same-origin reference names, with any query/fragment dropped. */
export function localPathOf(ref: string): string {
  return decodeURIComponent(new URL(ref.trim(), SAME_ORIGIN_BASE).pathname).replace(/^\/+/, "");
}
/** Directives required to be exactly `'self'`. */
const SELF_ONLY_DIRECTIVES = ["default-src", "script-src", "style-src", "connect-src"] as const;
/** Directives required to be exactly `'none'`. */
const NONE_ONLY_DIRECTIVES = ["base-uri", "object-src", "form-action"] as const;

export interface ReportOptions {
  /** Directory local asset references resolve against. Omit to skip on-disk assertions. */
  readonly assetDir?: string;
  /** Injected existence oracle (§13: the only door to the filesystem). Defaults to existsSync. */
  readonly exists?: (path: string) => boolean;
}

/**
 * The whole hardening report as data. Pure given `facts` and an injected `exists`, so the
 * falsifier can drive adversarial documents through it without touching a filesystem.
 */
export function cspHardeningReport(facts: HtmlFacts, options: ReportOptions = {}): CheckResult[] {
  const out: CheckResult[] = [];
  const check = (label: string, ok: boolean, detail = ""): void => { out.push({ label, ok, detail }); };
  const exists = options.exists ?? existsSync;
  const assetDir = options.assetDir;

  const csp = facts.cspContent;
  check("CSP meta tag present", csp !== null);
  const { directives, duplicates } = parseCsp(csp ?? "");
  check("no duplicate CSP directives", duplicates.length === 0, duplicates.join(","));

  for (const name of SELF_ONLY_DIRECTIVES) {
    const value = directives.get(name);
    check(name + " present", value !== undefined);
    const rendered = (value ?? []).join(" ");
    check(name + " is 'self'-only (no off-origin, no unsafe-*)", rendered === "'self'", "got:" + rendered);
  }
  for (const name of NONE_ONLY_DIRECTIVES) {
    const rendered = (directives.get(name) ?? []).join(" ");
    check(name + " locked to 'none'", rendered === "'none'", "got:" + rendered);
  }

  check("no inline <script> bodies", facts.inlineScriptBodies.length === 0, String(facts.inlineScriptBodies.length) + " found");
  check("no <style> blocks", facts.styleBlockCount === 0, String(facts.styleBlockCount) + " found");
  check("no style= attributes", facts.styleAttrSites.length === 0, facts.styleAttrSites.join(","));
  check("no inline on*= handlers", facts.eventHandlerSites.length === 0, facts.eventHandlerSites.join(","));

  // NON-VACUITY GUARDS. The two loops below assert things about references they FOUND; if
  // the parse found none they would pass having checked nothing, which is how the old regex
  // version reported an off-origin <script src> as clean. Assert the loops have subjects.
  check("script-src loop non-vacuous (at least one <script src>)", facts.scriptSrcs.length > 0);
  check("stylesheet loop non-vacuous (at least one <link rel=stylesheet>)", facts.stylesheetHrefs.length > 0);

  for (const src of facts.scriptSrcs) {
    const same = isSameOrigin(src);
    check("script src same-origin: " + src, same);
    if (same && assetDir !== undefined) {
      check("script exists on disk: " + src, exists(join(assetDir, localPathOf(src))));
    }
  }
  for (const href of facts.stylesheetHrefs) {
    const same = isSameOrigin(href);
    check("stylesheet same-origin: " + href, same);
    if (same && assetDir !== undefined) {
      check("stylesheet exists on disk: " + href, exists(join(assetDir, localPathOf(href))));
    }
  }
  return out;
}
/** Parse + report in one step, for callers holding only the document text. */
export async function auditHtml(html: string, options: ReportOptions = {}): Promise<CheckResult[]> {
  return cspHardeningReport(await parseHtmlFacts(html), options);
}

if (import.meta.main) {
  const htmlPath = Bun.argv[2] ?? join(import.meta.dir, "..", "index.html");
  const report = await auditHtml(readFileSync(htmlPath, "utf8"), { assetDir: dirname(htmlPath) });
  for (const r of report) {
    console.log((r.ok ? "\u2713" : "\u2717") + " " + r.label + (r.ok || !r.detail ? "" : " \u2014 " + r.detail));
  }
  const failures = report.filter((r) => !r.ok).length;
  if (failures > 0) {
    console.error("\n" + String(failures) + " CSP hardening check(s) FAILED");
    process.exit(1);
  }
  console.log("\nAll " + String(report.length) + " CSP hardening checks passed.");
}
