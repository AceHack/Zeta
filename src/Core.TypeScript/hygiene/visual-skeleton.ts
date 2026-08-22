#!/usr/bin/env bun
// visual-skeleton.ts — the modelled perceptual quotient for Zeta's shape vocabulary.
//
// WHY THIS FILE EXISTS
// --------------------
// Aaron 2026-08-19: *"for us we try to make things visual shape representable for common
// agreement without words, we just have to make sure to be careful about similar shapes so
// humans don't see them the same as an optical illusion."*
//
// A shape vocabulary buys escape from etymological drift (a shape needs no shared vocabulary to
// be a common referent) and pays for it in a NEW failure mode: two marks a machine separates
// trivially can be one mark to a human at a glance. `state-du.test.ts:128` already asserts that
// every glyph in the DU is unique — but it compares CODEPOINTS, which is exactly the comparison
// the eye does not perform. U+25CB and U+25CC are different strings and the same ring.
//
// THE MODEL, AND ITS PROVENANCE
// -----------------------------
// This is UTS #39's *skeleton* construction, with the alphabet widened from text to marks.
// UTS #39 §4 detects confusables by mapping each candidate through a table to a canonical
// prototype and declaring a collision when two prototypes are equal. Everything here is that
// same shape:
//
//     confusable(x, y)  <=>  skeleton(x) == skeleton(y)
//
// What changes is the table. UTS #39's `confusables.txt` covers script homoglyphs and has no
// useful coverage of the Geometric Shapes block, which is where this vocabulary actually lives.
// So the table below is built from Unicode's own NORMATIVE CHARACTER NAMES, which decompose
// each geometric mark into (base form, fill) by construction: "CIRCLE WITH VERTICAL FILL" is a
// circle, partly filled, and the name says so. The `name` field on every row is that normative
// name, recorded so the derivation is auditable rather than asserted.
//
// THE TWO QUOTIENTS — these are the modelling decisions, and they are where this can be wrong
// -------------------------------------------------------------------------------------------
//   1. OUTLINE STYLE IS QUOTIENTED AWAY. A dotted outline and a solid outline of the same
//      diameter differ by less than a stroke width. Low-pass the mark (the designer's squint
//      test) and the dots merge into a lighter continuous ring. So U+25CC DOTTED CIRCLE and
//      U+25CB WHITE CIRCLE share a skeleton.
//   2. FILL TEXTURE IS QUOTIENTED AWAY; FILL FRACTION IS NOT. Vertical hatching and a solid
//      half both read as "partly dark" at small size. So U+25CD CIRCLE WITH VERTICAL FILL and
//      U+25D0 CIRCLE WITH LEFT HALF BLACK share a skeleton, while U+25CF BLACK CIRCLE (full)
//      and U+25CB WHITE CIRCLE (empty) do not — fill fraction is Bertin's `value`, an ordered
//      visual variable that survives a low-pass filter.
//
// A full-diameter STRIKE is deliberately NOT quotiented: it is a stroke spanning the mark, it
// changes the silhouette, and it is the one modifier that survives blur. That is why U+2205
// EMPTY SET does not collide with U+25CB WHITE CIRCLE.
//
// REGISTER — read this before citing anything here
// ------------------------------------------------
// The quotient is a `toy`->`unmetered` MODEL of human perception. No perceptual threshold was
// measured for it and none is claimed. What IS metered is the collision detection: given the
// table, collisions are computed, and `audit-visual-confusability.ts` fails today on real pairs
// in `state-du.ts`. The table is the falsifiable part — an empirical study that finds humans
// reliably separate U+25CB from U+25CC at 12px would refute quotient (1) and this file should
// then change. Nothing downstream should read a collision as a measured human error rate; read
// it as "these two were not separated by a channel we have any evidence survives a glance."
//
// Deliberately conservative in ONE direction: the quotient OVER-approximates confusability
// (it merges more than a human does). For a guard, over-flagging costs a redesign and
// under-flagging ships a mark that lies. Those costs are not symmetric.
//
// Anchors (Beacon), each with what it does and does NOT entail:
//   - Unicode UTS #39, *Unicode Security Mechanisms*, §4 Confusable Detection + the skeleton
//     algorithm. ENTAILS: the construction (canonicalise, then collide on equality) and the
//     standing of "visually confusable" as a security property rather than a usability note.
//     Does NOT entail: any of the geometric quotients above — its table does not cover them.
//   - Jacques Bertin, *Semiologie Graphique* (1967). ENTAILS: shape is a NOMINAL visual
//     variable and value/fill is an ORDERED one — the reason fill fraction is kept and fill
//     texture is dropped. Does NOT entail: a confusability threshold.
//   - Wertheimer (1923), Gestalt grouping by similarity. ENTAILS: marks alike in form are
//     perceptually grouped, i.e. their individual identity is subordinated to the group — which
//     is the mechanism by which a collision does its damage. Does NOT entail: a metric, and it
//     is cited here for MECHANISM only.
//
// Not cited as load-bearing, and named so nobody promotes them by accident: metamerism is a
// genuine existence proof that physically distinct stimuli can be perceptually identical, but
// it is a fact about colour matching and supplies no threshold for shape; just-noticeable
// difference is defined on a magnitude continuum and a nominal shape alphabet is not one.

/** The silhouette that survives a low-pass filter. Nominal — never ordered. */
export type BaseForm = "circle" | "diamond" | "square" | "triangle" | "bar" | "other";

/** How much of the base form reads as dark. Ordered (Bertin's `value`); texture is quotiented. */
export type FillClass = "empty" | "partial" | "full";

export interface MarkSkeleton {
  readonly baseForm: BaseForm;
  readonly fill: FillClass;
  /** A stroke spanning the whole mark. Survives blur, so it separates. */
  readonly struck: boolean;
}

interface MarkRow extends MarkSkeleton {
  /** The normative Unicode character name the skeleton was derived from. */
  readonly name: string;
}

/**
 * The table. Keyed by the literal character so a caller cannot mistype a codepoint and get a
 * silent pass — an unknown mark is `undefined`, and callers must treat that as UNAUDITED rather
 * than as SAFE. That distinction is the whole of the vacuity discipline applied to this file.
 */
const MARKS: ReadonlyMap<string, MarkRow> = new Map([
  ["●", { name: "BLACK CIRCLE", baseForm: "circle", fill: "full", struck: false }],
  ["○", { name: "WHITE CIRCLE", baseForm: "circle", fill: "empty", struck: false }],
  ["◌", { name: "DOTTED CIRCLE", baseForm: "circle", fill: "empty", struck: false }],
  ["◐", { name: "CIRCLE WITH LEFT HALF BLACK", baseForm: "circle", fill: "partial", struck: false }],
  ["◑", { name: "CIRCLE WITH RIGHT HALF BLACK", baseForm: "circle", fill: "partial", struck: false }],
  ["◍", { name: "CIRCLE WITH VERTICAL FILL", baseForm: "circle", fill: "partial", struck: false }],
  ["◎", { name: "BULLSEYE", baseForm: "circle", fill: "partial", struck: false }],
  ["∅", { name: "EMPTY SET", baseForm: "circle", fill: "empty", struck: true }],
  ["⊘", { name: "CIRCLED DIVISION SLASH", baseForm: "circle", fill: "empty", struck: true }],
  ["◆", { name: "BLACK DIAMOND", baseForm: "diamond", fill: "full", struck: false }],
  ["◇", { name: "WHITE DIAMOND", baseForm: "diamond", fill: "empty", struck: false }],
  ["■", { name: "BLACK SQUARE", baseForm: "square", fill: "full", struck: false }],
  ["□", { name: "WHITE SQUARE", baseForm: "square", fill: "empty", struck: false }],
  ["▨", { name: "SQUARE WITH UPPER RIGHT TO LOWER LEFT FILL", baseForm: "square", fill: "partial", struck: false }],
  ["▩", { name: "SQUARE WITH DIAGONAL CROSSHATCH FILL", baseForm: "square", fill: "partial", struck: false }],
  ["▲", { name: "BLACK UP-POINTING TRIANGLE", baseForm: "triangle", fill: "full", struck: false }],
  ["△", { name: "WHITE UP-POINTING TRIANGLE", baseForm: "triangle", fill: "empty", struck: false }],
  ["─", { name: "BOX DRAWINGS LIGHT HORIZONTAL", baseForm: "bar", fill: "full", struck: false }],
  ["│", { name: "BOX DRAWINGS LIGHT VERTICAL", baseForm: "bar", fill: "full", struck: false }],
]);

/** The normative Unicode name a row's skeleton was derived from, for audit output. */
export function unicodeNameOf(mark: string): string | undefined {
  return MARKS.get(mark)?.name;
}

/**
 * The skeleton of a mark, or `undefined` if the mark is not in the table.
 *
 * `undefined` means UNAUDITED, never SAFE. A caller that treats a missing row as a pass has
 * built a check that cannot fail on exactly the marks nobody has looked at yet.
 */
export function skeletonOf(mark: string): MarkSkeleton | undefined {
  const row = MARKS.get(mark);
  if (row === undefined) return undefined;
  return { baseForm: row.baseForm, fill: row.fill, struck: row.struck };
}

/** The canonical string form — the UTS #39 skeleton, stringified so equality is the test. */
export function skeletonKey(s: MarkSkeleton): string {
  return `${s.baseForm}/${s.fill}${s.struck ? "/struck" : ""}`;
}

/**
 * Do two marks collide under the modelled quotient?
 *
 * Returns `undefined` when either mark is unaudited — deliberately NOT `false`. "I have no
 * model for this mark" and "these two marks are distinguishable" are different answers and
 * collapsing them is how this check would go vacuous.
 */
export function collide(a: string, b: string): boolean | undefined {
  const sa = skeletonOf(a);
  const sb = skeletonOf(b);
  if (sa === undefined || sb === undefined) return undefined;
  return skeletonKey(sa) === skeletonKey(sb);
}

// ── The colour half: is a pair separated by anything other than hue? ────────────────────────
//
// `zeta-state.css` already carries the sentence *"a distinction carried only by hue is not a
// distinction"* — as prose, applied by hand. This is the computable form of it. WCAG 2.1's
// relative-luminance formula is used because it is published, exact, and reproducible; it is a
// GREYSCALE-SEPARABILITY PROXY and is not a model of dichromacy. A pair that separates in
// luminance survives greyscale and every form of colour-blindness, which is the property being
// checked; a pair that does not separate in luminance MIGHT still be separable by some
// observers and is reported as needing a second channel, not as invisible.

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance of a `#RRGGBB` string. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = srgbToLinear(Number.parseInt(h.slice(0, 2), 16));
  const g = srgbToLinear(Number.parseInt(h.slice(2, 4), 16));
  const b = srgbToLinear(Number.parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio. 1.0 = identical luminance; 21.0 = black on white. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The floor at which two marks' colours are taken to be separable IN GREYSCALE ALONE.
 *
 * 1.5 is a DECLARED THRESHOLD, not a measured one, and it is stated here rather than buried so
 * that changing it is a visible act. Its rationale: WCAG's own lowest normative ratio is 3:1
 * (non-text contrast, SC 1.4.11) for a mark against its BACKGROUND. Two foreground marks
 * distinguished from EACH OTHER is a weaker ask than legibility against a ground, so the floor
 * is set below 3:1 — but a ratio under 1.5 means the two marks differ by less than half a stop
 * of lightness, which no reasonable reading of any published guidance calls a distinction.
 * Anything in [1.5, 3.0) is separable-but-thin and this check passes it; the design review, not
 * the linter, owns that band.
 */
export const GREYSCALE_SEPARATION_FLOOR = 1.5;

// ── The ASCII channel ───────────────────────────────────────────────────────────────────────
//
// The DU's ASCII fallbacks — `(*) (~) ( ) (!) (x) (?) (#) (/)` — are the surface a terminal, a
// log line, a plain-text export and an ASCII-only notebook (BP-09) actually render. They are, on
// inspection, the BETTER-DESIGNED channel: a fixed-width frame around a distinct interior
// character, injective by construction. The constrained channel forced what the rich one did not.
//
// That was luck plus taste, and neither is a guard. This is the same skeleton construction
// applied to monospace text, so a future member cannot fix the visual channel and quietly
// collide the fallback.
//
// THE QUOTIENT. Characters are mapped to a confusability CLASS; characters outside every class
// are their own class. The classes below are the standard monospace/homoglyph groups — this is
// the part of the problem UTS #39's `confusables.txt` genuinely does cover, and these are its
// well-known members rather than an invention. Deliberately conservative (over-grouping): `-`
// and `_` differ only in baseline position, and grouping them costs a rename while separating
// them could ship two marks that read alike in a log.
//
// Register: `unmetered`, same as the geometric quotient. No monospace legibility study was run.
// What is metered is that the detector fires and stays quiet on controls.
const ASCII_CONFUSABLE_CLASSES: readonly string[] = [
  "l1I|!", // vertical stroke with or without a gap
  "O0oQ", // round bowl
  ".,_", // low-baseline dot or dash
  "'`\"", // high tick
  ":;", // stacked dots
  "/\\", // diagonal
];

const ASCII_CLASS_OF: ReadonlyMap<string, string> = new Map(
  ASCII_CONFUSABLE_CLASSES.flatMap((cls) => [...cls].map((ch) => [ch, cls] as const)),
);

/**
 * The skeleton of an ASCII mark: each character replaced by its confusability class.
 *
 * Total by construction — an unknown character is its own class — so unlike `skeletonOf` this
 * cannot return `undefined`. That asymmetry is deliberate and worth stating: the geometric
 * alphabet is open (any Unicode mark could be reached for, and one we have not modelled must
 * report as UNAUDITED), while ASCII is closed at 95 printable characters and every one of them
 * is covered here.
 */
export function asciiSkeletonKey(mark: string): string {
  return [...mark].map((ch) => ASCII_CLASS_OF.get(ch) ?? ch).join("");
}
