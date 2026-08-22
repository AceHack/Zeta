/**
 * src/Core.TypeScript/algebra/erasure-class.ts — the TypeScript half of the substrate-wide
 * erasure vocabulary. The F# original is `src/Core/ErasureClass.fs`; the two carry the same three
 * classes, the same evidence kinds, and the same refusal to let an unmeasured operation read as a
 * free one.
 *
 * ## Why classify at all, and why by injectivity
 *
 * Landauer 1961 prices *logical irreversibility*: a step whose output does not determine its input
 * dissipates at least kT.ln2 per bit lost. Bennett 1973 is the converse — a bijective step erases
 * nothing and is free. So the classifying question is injectivity, and nothing else. Not "is this
 * called garbage collection", not "does this happen at a lifecycle boundary". A list of operations
 * typed by *when they run* is a lifecycle taxonomy wearing a thermodynamic one's clothes.
 *
 * ## Why the key is the representation
 *
 * In the F# substrate one interface method (`IDeltaLog.TruncateAsync`) has opposite classes under
 * different backends: destroying under an in-memory list, preserving under a git backend that
 * commits the truncated tree with the old commit as its parent. Erasure is a property of the
 * concrete representation, so the declaration lives beside the representation and the key is
 * `(representation, operation, observation)`.
 *
 * ## Why `unmeasured` is not zero
 *
 * An operation nobody has swept has an UNKNOWN cost. Recording it as `0` is the closed-ledger free
 * lunch the whole apparatus exists to refuse — a channel that looks free because nothing is
 * watching it. `bitsErasedPpm` returns `undefined` for an unmeasured row, so every caller that
 * folds it into a ledger has to decide in the open what an unmeasured operation costs.
 *
 * This module CLASSIFIES. It deliberately does not charge: nothing here touches
 * `entropy-tracker.ts`, because metering is a separate decision that deserves its own review.
 *
 * Anchors (Beacon): Landauer 1961; Bennett 1973; Goguen-Meseguer 1982 (noninterference).
 */

/** The classification. Three cases, and the third is a hole in the books rather than a cost. */
export type ThermodynamicClass = "reversible" | "erasing" | "unmeasured";

/**
 * How a declared class is backed.
 *
 * - `exhaustive-sweep` — the real implementation run on every point of a named finite domain.
 * - `bounded-model-sweep` — one or more of the operation's inputs had to be PINNED because it is
 *   not enumerable (a 160-bit id space, a byte quota, a real filesystem). Exhaustive in the
 *   remaining coordinates; the `model` string names what was pinned, so a reader can judge what
 *   the sweep does and does not cover.
 * - `no-admissible-measurement` — nothing here can be swept, and the reason is written down.
 */
export type Evidence =
  | {
      readonly kind: "exhaustive-sweep";
      readonly domain: string;
      readonly largestFibre: number;
      readonly bitsErasedPpm: number;
    }
  | {
      readonly kind: "bounded-model-sweep";
      readonly model: string;
      readonly largestFibre: number;
      readonly bitsErasedPpm: number;
    }
  | { readonly kind: "no-admissible-measurement"; readonly reason: string };

/** One declaration, attached to one concrete representation. */
export interface ErasureProfile {
  /** The module or structure that chooses the representation. THIS is the key, not `operation`. */
  readonly representation: string;
  /** The function classified, as it is spelled in the source. */
  readonly operation: string;
  /** What the injectivity is measured against. Without this a class is not a claim. */
  readonly observation: string;
  /** What a reader of the post-state can still get back, and through which channel. */
  readonly recoveryChannel: string;
  readonly classification: ThermodynamicClass;
  readonly evidence: Evidence;
}

/** `(representation, operation, observation)` — the identity of a declaration. */
export function profileKey(p: ErasureProfile): string {
  return `${p.representation}::${p.operation}::${p.observation}`;
}

/** The largest fibre, or `undefined` when unmeasured. */
export function largestFibre(p: ErasureProfile): number | undefined {
  return p.evidence.kind === "no-admissible-measurement" ? undefined : p.evidence.largestFibre;
}

/**
 * Bits erased in parts per million, or `undefined` when unmeasured.
 *
 * `undefined` is not `0`. There is no defaulting overload, on purpose.
 */
export function bitsErasedPpm(p: ErasureProfile): number | undefined {
  return p.evidence.kind === "no-admissible-measurement" ? undefined : p.evidence.bitsErasedPpm;
}

/** True when the evidence is a sweep someone can re-run — i.e. a law pack owes it a measurement. */
export function isSwept(p: ErasureProfile): boolean {
  return p.evidence.kind !== "no-admissible-measurement";
}

/** The class implied by a measured largest fibre. A sweep can never return `unmeasured`. */
export function classOfLargestFibre(fibre: number): ThermodynamicClass {
  return fibre <= 1 ? "reversible" : "erasing";
}

/** `log2(fibre)` in parts per million, rounded — the integer form declarations commit to. */
export function bitsPpmOfLargestFibre(fibre: number): number {
  return fibre <= 1 ? 0 : Math.round(Math.log2(fibre) * 1_000_000);
}

/**
 * Measure a class by exhaustive sweep: group the domain by image and read the largest fibre.
 * `largestFibre === 1` iff injective. Identical in shape to the F# pack's `measureLargestFibre`.
 */
export function measureLargestFibre<A>(inputs: readonly A[], probe: (a: A) => string): number {
  const fibres = new Map<string, number>();
  for (const input of inputs) {
    const image = probe(input);
    fibres.set(image, (fibres.get(image) ?? 0) + 1);
  }
  let max = 0;
  for (const n of fibres.values()) if (n > max) max = n;
  return max;
}

/**
 * Internal well-formedness of a single declaration, independent of any measurement: the class and
 * the evidence must not contradict each other. Returns the violations, so a failing law pack can
 * say exactly what is wrong.
 */
export function inconsistencies(p: ErasureProfile): readonly string[] {
  const out: string[] = [];
  const key = profileKey(p);
  const complain = (what: string) => out.push(`${key}: ${what}`);

  if (p.representation.trim() === "") complain("representation is blank — the class has no key");
  if (p.operation.trim() === "") complain("operation is blank");
  if (p.observation.trim() === "")
    complain("observation is blank — a class without a stated observation is not a claim");
  if (p.recoveryChannel.trim() === "")
    complain("recoveryChannel is blank — say what survives, or say that nothing does");

  const fibre = largestFibre(p);
  const ppm = bitsErasedPpm(p);

  if (p.evidence.kind === "no-admissible-measurement") {
    if (p.classification !== "unmeasured")
      complain(
        `declared ${p.classification} on no measurement — a class asserted without a sweep is the free-by-default claim this vocabulary refuses`,
      );
    if (p.evidence.reason.trim() === "") complain("unmeasured with no written reason");
  } else if (p.classification === "unmeasured") {
    complain("declared unmeasured but carries a sweep — if it was swept it has a class");
  } else if (p.classification === "reversible") {
    if (fibre !== 1 || ppm !== 0)
      complain(
        `declared reversible but the evidence is fibre=${fibre} ppm=${ppm}; reversible means fibre 1 and exactly 0 bits`,
      );
  } else if (fibre === undefined || ppm === undefined || fibre <= 1 || ppm <= 0) {
    complain(
      `declared erasing but the evidence is fibre=${fibre} ppm=${ppm}; erasing means fibre > 1 and strictly positive bits`,
    );
  }

  return out;
}
