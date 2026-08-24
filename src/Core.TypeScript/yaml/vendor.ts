// The WRAPPED VENDOR ADAPTER for the YAML port — the fallback half of the
// "hand-rolled default + vendor adapter" architecture, finally wired.
//
// -- WHY THIS FILE EXISTS --------------------------------------------------
// `reader.ts` is a deliberately BOUNDED subset reader, and its header has always
// said what the bound is for: out-of-subset constructs "decline cleanly via the
// typed `YamlFeedback` channel (Result over throw) SO A CALLER CAN FALL BACK TO A
// VENDOR ADAPTER". The LOCKED contract in
// `docs/agendas/ace-package-manager/2026-06-01-yaml-port-implementation-plan.md`
// repeats it verbatim, and the design doc's operator-locked Decision 2 names the
// out-of-scope set exactly:
//
//     "Anchors/aliases, tags, multi-document streams, flow style ({} / []), and
//      block scalars (| / >) are out of scope for the hand-rolled default; THE
//      WRAPPED VENDOR ADAPTER COVERS THEM WHEN A USE CASE NEEDS THEM."
//
// The use case arrived (081M0N90CHX087G0R0034C7NPT): ace's
// `loadDependencyGraphFromFile` could not read
// `full-ai-cluster/k8s/sync-wave-dependency-graph.yaml` — 44 folded block scalars
// (`>-`) and 28 non-empty flow sequences (`dependsOn: [cilium]`) — and failed with
// a bare `YAML parse failed: UnsupportedConstruct`. Two other tools had already
// routed around ace by importing the `yaml` npm package directly. The adapter this
// file provides is the half of the design that was specified and never built.
//
// -- WHY Bun.YAML AND NOT THE `yaml` PACKAGE -------------------------------
// Decision 3 of the same doc: "Bun.YAML is a Bun built-in (BCL-tier) so the TS
// adapter may call it directly." Under `bcl-interface-boundary`, a platform
// built-in is the floor you build on, not a dependency choice — so this adds ZERO
// new package to ace's closure, which keeps `clone-at-tag-stays-sufficient` intact.
// It is also a genuinely INDEPENDENT implementation from the `yaml` package the
// cluster tools use, which is what makes the agreement check in
// `deps-graph-parse.test.ts` evidence rather than a tautology.
//
// -- WHAT THIS FILE DOES NOT DO --------------------------------------------
// It does NOT widen the subset, and `parse` in `dom.ts` is untouched. The
// six-oracle byte-lock (TS/F#/C#/Rust/Go/Python) rests on every oracle declining
// the SAME inputs; widening TS alone would make TS accept what Rust refuses with no
// check able to see it. 081KT7YW00008QG0R002T1XNWT — the one prior subset change,
// for empty `{}` / `[]` — says it in its own body: "do NOT do unilaterally". So the
// fallback sits strictly ABOVE the port, and `parseWithFallback` reports which
// reader answered so a caller can never mistake one for the other.

import { parse as parseSubset } from "./dom.ts";
import type { YamlValue } from "./dom.ts";
import type { YamlFeedback } from "./reader.ts";

/** Which reader produced a value. Reported, never inferred. */
export type ParseVia = "subset" | "vendor";

export type VendorParseResult =
  | { ok: true; value: YamlValue }
  | { ok: false; error: string };

export type FallbackParseResult =
  | { ok: true; value: YamlValue; via: ParseVia }
  | { ok: false; feedback: YamlFeedback; vendorError: string };

// `Bun.YAML` is a Bun built-in (BCL-tier per `bcl-interface-boundary`), but it is
// absent on non-Bun runtimes and was absent from older Bun. Probed rather than
// assumed, so a missing built-in is a named refusal and not a TypeError.
interface BunYamlNamespace {
  parse(text: string): unknown;
}

function bunYaml(): BunYamlNamespace | undefined {
  const g = (globalThis as { Bun?: { YAML?: unknown } }).Bun;
  const ns = g?.YAML;
  if (ns === undefined || ns === null) return undefined;
  if (typeof (ns as BunYamlNamespace).parse !== "function") return undefined;
  return ns as BunYamlNamespace;
}

/**
 * Convert a plain JS value (vendor output) into the port's `YamlValue`.
 *
 * Strict on purpose: the port's `Map` keys are strings and its scalars are the
 * core schema. A construct the port cannot represent (a non-string mapping key, a
 * Date, a function) throws rather than being coerced — a silent coercion here
 * would be exactly the "parse succeeded and is wrong" failure that is worse than a
 * clean decline.
 */
export function jsToYamlValue(v: unknown, path = "$"): YamlValue {
  if (v === null || v === undefined) return { t: "Null" };
  if (typeof v === "boolean") return { t: "Bool", value: v };
  if (typeof v === "bigint") return { t: "Int", value: v };
  if (typeof v === "number") {
    if (Number.isInteger(v)) return { t: "Int", value: BigInt(v) };
    if (!Number.isFinite(v)) {
      throw new Error(`${path}: non-finite number ${String(v)} has no YamlValue form`);
    }
    return { t: "Float", value: v };
  }
  if (typeof v === "string") return { t: "Str", value: v };
  if (Array.isArray(v)) {
    return { t: "Seq", items: v.map((item, i) => jsToYamlValue(item, `${path}[${i}]`)) };
  }
  if (typeof v === "object") {
    const proto = Object.getPrototypeOf(v) as unknown;
    if (proto !== Object.prototype && proto !== null) {
      throw new Error(`${path}: ${v.constructor?.name ?? "object"} has no YamlValue form`);
    }
    const entries: Array<[string, YamlValue]> = [];
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      entries.push([k, jsToYamlValue(val, `${path}.${k}`)]);
    }
    return { t: "Map", entries };
  }
  throw new Error(`${path}: ${typeof v} has no YamlValue form`);
}

// A document marker at column 0. Block-scalar CONTENT is always indented past its
// key, so a `---` / `...` starting at column 0 cannot be scalar text — this is a
// sound conservative detector, and it is used to REFUSE rather than to interpret.
const DOCUMENT_MARKER = /^(---|\.\.\.)(\s|$)/m;

/**
 * Parse with the vendor adapter alone.
 *
 * SINGLE-DOCUMENT ONLY, and this is enforced rather than assumed. Measured
 * 2026-08-22: `Bun.YAML.parse("a: 1\n---\nb: 2\n")` returns
 * `[{a:1},{b:2}]` — an ARRAY, structurally indistinguishable from a single
 * document whose root is a sequence. Converting that to a `Seq` would be a parse
 * that succeeds and is wrong, which is strictly worse than a clean failure. The
 * port's `YamlValue` has no stream form, so a stream is refused here and a caller
 * that needs one must use a multi-document reader directly.
 */
export function parseWithVendor(text: string): VendorParseResult {
  const ns = bunYaml();
  if (ns === undefined) {
    return { ok: false, error: "Bun.YAML is unavailable on this runtime" };
  }
  if (DOCUMENT_MARKER.test(text)) {
    return {
      ok: false,
      error:
        "input carries a document marker (--- / ...); YamlValue has no stream form, " +
        "so this adapter refuses rather than flattening a stream into a sequence",
    };
  }
  let raw: unknown;
  try {
    raw = ns.parse(text);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  try {
    return { ok: true, value: jsToYamlValue(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The one feedback the fallback answers.
 *
 * The other four — `TabIndentation`, `UnterminatedQuote`, `UnexpectedCharacter`,
 * `UnexpectedIndent` — describe MALFORMED input, not out-of-subset input, and
 * falling back on them would trade our strictness for a vendor's leniency without
 * anyone deciding to. That is not hypothetical: measured 2026-08-22,
 * `Bun.YAML.parse("a:\n\tb: 1\n")` returns `{a: null, b: 1}`, silently accepting a
 * tab in indentation that YAML forbids and that the `yaml` npm package rejects
 * outright ("Tabs are not allowed as indentation"). A blanket fallback would have
 * converted our correct refusal into a quietly different reading.
 *
 * `UnsupportedConstruct` is exactly the class the design's Decision 2 hands to the
 * adapter: anchors/aliases, tags, multi-document streams, flow style, block
 * scalars.
 */
const FALLBACK_ANSWERS: ReadonlySet<YamlFeedback> = new Set<YamlFeedback>(["UnsupportedConstruct"]);

/**
 * The designed path: OUR subset reader first, the vendor adapter only on an
 * out-of-subset decline. `via` is returned so a caller (or a test) can assert that
 * in-subset input still goes through the hand-rolled reader — which is what stops
 * this fallback from quietly becoming a replacement.
 *
 * A parse error that is NOT a decline (there are none the subset reader can raise
 * — every internal throw is a `DeclineError`) would surface from `parseSubset` as
 * an exception and is deliberately not caught.
 */
export function parseWithFallback(text: string): FallbackParseResult {
  const subset = parseSubset(text);
  if (subset.ok) return { ok: true, value: subset.value, via: "subset" };

  if (!FALLBACK_ANSWERS.has(subset.feedback)) {
    return {
      ok: false,
      feedback: subset.feedback,
      vendorError: `not consulted — ${subset.feedback} is malformed input, not an out-of-subset construct`,
    };
  }

  const vendor = parseWithVendor(text);
  if (vendor.ok) return { ok: true, value: vendor.value, via: "vendor" };

  return { ok: false, feedback: subset.feedback, vendorError: vendor.error };
}
