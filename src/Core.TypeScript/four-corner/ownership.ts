/**
 * four-corner/ownership.ts — the GENERIC four-corner ownership shape.
 *
 * Four corners = data × feedback, in × out. The corners are distinguished by
 * WHO AUTHORS each one, which is the whole point of the shape:
 *
 *   - `tIn`          — caller authors; flows caller → function
 *   - `tOut`         — function produces; flows function → caller (value branch)
 *   - `tOutFeedback` — function authors; flows function → caller (control-flow signals)
 *   - `tInFeedback`  — CO-OWNED; both caller and function contribute variants,
 *                      and each side's contribution is the other's backpressure
 *
 * Lineage: the asymmetric-authorship rule + the 4-corner-monad
 * 081KSKBP80008QG0R000B3Y19A substrate, from the operator + Mika
 * substrate-engineering thread (PR #5516, with the Prism
 * iterator/generator-asymmetry extension). The full F# 4-corner monad CE
 * builder is 081KSKBP80008QG0R000B3Y19A.4 (deferred); these are the type
 * parameters the PoC scaffold uses.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * This interface was declared inside `workflow-engine/types.ts`, next to the
 * workflow engine's `Action` / `State` / `Tick` machinery. It is not workflow
 * machinery: it is a universal shape, and `observe/observe.ts` and
 * `algebra/wset-four-corner-trace.ts` both instantiate it for their own
 * channels while wanting nothing else the workflow engine has. Reaching into
 * the meta-harness for a four-type-parameter interface with no runtime was two
 * of the harness's 38 measured back-edges
 * (`docs/research/2026-09-09-repo-split-round-4-*.md` §3.1), and it is the
 * free-interface case from
 * `.claude/rules/interfaces-free-classes-earned-under-rules.md`: pure shape,
 * nothing to capture, so it belongs where anyone may depend on it.
 *
 * `workflow-engine/types.ts` imports it back and re-exports it, so existing
 * importers are unchanged.
 *
 * ── RELATIONSHIP TO `./four-corner.ts` ──────────────────────────────────────
 * `four-corner.ts` declares a `FourCornerOwnership` too, and the two are not
 * duplicates: that one is the **string-quad instantiation** that carries the
 * treaty codec (`toLine` / `ofLine`) byte-locked against F# and C# — its own
 * header already records that it "descends from the ORIGINAL
 * FourCornerOwnership in workflow-engine/types.ts". This file is that original,
 * now sitting beside its descendant. It is deliberately NOT re-exported from
 * `./index.ts`, so `four-corner`'s package surface still means exactly one
 * thing: the treaty-bearing string quad.
 */
export interface FourCornerOwnership<TIn, TOut, TOutFeedback, TInFeedback> {
  readonly tIn: TIn;
  readonly tOut?: TOut;
  readonly tOutFeedback?: TOutFeedback;
  readonly tInFeedback?: TInFeedback;
}
