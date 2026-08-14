// sort-key.ts — a sort site must DECLARE the field it orders by.
//
// THE DEFECT THIS EXISTS TO CATCH
// -------------------------------
// `ls workitems/` is chronological because a ZetaId puts version then timestamp
// in its high bits, so lexicographic string order == numeric id order == time
// order. That is true for the OBSERVATION layout and only for it. It is already
// FALSE in this repo for two other layouts that share the same 128-bit envelope
// and the same version number:
//
//   • Category 9 (ContentAddress) and categories >= 10 (Generic) use the
//     `packGeneric` layout (`zeta-id.ts`): there is no timestamp field at bits
//     [75,123) at all — those bits carry payload.
//   • Live instance, measured 2026-08-14: the two ids in `inventory/items/`
//     (`Category.InventoryAsset` = 10, minted by `inventory/new-item.ts`) read
//     out of bits [75,123) as ms epoch 228_227_880_623_423 — the year 9200. They
//     sort after every observation id ever minted, and nothing says so.
//
//     TO BE PRECISE ABOUT WHERE THE FAULT IS NOT: that mint is CORRECT, and an
//     earlier draft of this header implying otherwise was wrong. Its ms lands at
//     id bits [82,123), above the constant Category field, so `ls inventory/items/`
//     genuinely IS chronological within the category — verified by round-trip, and
//     the two live ids decode on their own layout's terms to 2026-07-02T22:11:57.370Z
//     and .419Z, in lexical order. The year-9200 figure is what you get by decoding
//     a Generic id against the OBSERVATION layout: a misread, not a miswrite. What
//     this module removes is the SILENCE around cross-layout comparison, not any
//     mistake made at a mint site.
//
// So "sortable" is not a property of a ZetaId. It is a property of a (layout,
// field) pair. A site that sorts by the WHOLE id while MEANING "by time" has an
// unstated assumption, and an unstated assumption fails silently — in plausible
// wrong order, not with an error. That is the failure mode this module removes,
// by making the intent a value the caller has to write down.
//
// THREE ORDERING INTENTS, ONLY ONE OF WHICH IS LAYOUT-SENSITIVE
// ------------------------------------------------------------
//   time      — "earlier things first". Requires a Timestamp field. LAYOUT-SENSITIVE:
//               refuses any id whose layout has no timestamp, and any unknown version.
//   identity  — "some total order, stably". Any total order will do; the caller
//               needs determinism, not meaning. Works on every id of every version,
//               including ones this build has never seen. NOT layout-sensitive.
//   field     — "ordered by <named field>". The general case: mask the field to
//               the top and compare. Time-order is the special case where the
//               field is Timestamp.
//
// The great majority of this repo's id sorts turn out to be `identity` (they want
// deterministic output bytes), and those are safe under any future version. Only
// `time` needs a guard. Declaring which one you meant is the whole discipline.
//
// FIELD EXTRACTION IS CHEAP (why "declare your field" is not a tax)
// -----------------------------------------------------------------
// Ordering by an arbitrary field is `(id >> offset) & mask` — one shift and one
// and. For fields scattered across the word (the general "alternative sort" case)
// the hardware primitive is BMI2 `PEXT` / `PDEP` (parallel bit extract/deposit),
// introduced with Intel Haswell (2013): a scatter/gather under a bitmask in one
// instruction. Honest caveat, because it changes the answer on this fleet: PEXT
// and PDEP are microcode-emulated and ~2 orders of magnitude slower on AMD before
// Zen 3, and AArch64 has no single-instruction equivalent at all (it needs a NEON
// or bit-twiddling sequence) — and `inventory/items/` records a Mac Studio M2
// Ultra, i.e. arm64. "One instruction" is an x86-since-Zen-3 statement, not a
// portable one. Contiguous single-field extraction, which is what every field in
// `BitLayout.fs` actually is, needs no PEXT anywhere: shift-and-mask is one or two
// ALU ops on every architecture in the fleet.
//
// Beacon anchors: Crockford base32 (sort-preserving alphabet) via ULID; Intel
// Instruction Set Extensions Programming Reference (BMI2, PEXT/PDEP);
// Goguen & Meseguer 1982 (noninterference — an ordering must not depend on
// anything the caller did not declare).

import type { ZetaId } from "./types";
import { BIT_MASKS } from "./zeta-id.gen";

/** Versions this build knows how to interpret. MUST mirror `registry/id-versions.yaml`
 *  (asserted by a test). An id carrying any other version is uninterpretable HERE —
 *  it is not malformed, this build is simply older than it. */
export const KNOWN_ID_VERSIONS: ReadonlySet<number> = new Set([1]);

/**
 * The three bit layouts that currently share the 128-bit envelope. The
 * discriminator is (version, category) — NOT version alone. `zeta-id.ts`
 * `unpackPayload` is the authority for the category split; this mirrors it.
 */
export type LayoutClass =
  /** categories 0..8 — `pack`/`unpack`: Timestamp at [75,123), Randomness at [0,32). */
  | "observation"
  /** category 9 — `packGeneric`: 119-bit content payload, no timestamp. */
  | "content-address"
  /** categories 10..15 — `packGeneric`: 119-bit opaque payload, no timestamp. */
  | "generic"
  /** version outside `KNOWN_ID_VERSIONS`: this build cannot say where the fields are. */
  | "unknown-version";

const mask = (width: bigint): bigint => (1n << width) - 1n;

/** Extract any contiguous field. The primitive every "alternative sort" is built from. */
export function extractField(id: ZetaId, offset: bigint, width: bigint): bigint {
  return ((id as bigint) >> offset) & mask(width);
}

export function versionOf(id: ZetaId): number {
  return Number(extractField(id, BIT_MASKS.version.offset, BIT_MASKS.version.width));
}

/** Category lives at bits [65,69) in BOTH layouts — which is exactly why it can
 *  discriminate between them. */
export function categoryOf(id: ZetaId): number {
  return Number(extractField(id, BIT_MASKS.category.offset, BIT_MASKS.category.width));
}

export function layoutClassOf(id: ZetaId): LayoutClass {
  if (!KNOWN_ID_VERSIONS.has(versionOf(id))) return "unknown-version";
  const category = categoryOf(id);
  if (category < 9) return "observation";
  if (category === 9) return "content-address";
  return "generic";
}

/** True iff bits [75,123) of this id are a milliseconds-epoch Timestamp field. */
export function hasTimeField(id: ZetaId): boolean {
  return layoutClassOf(id) === "observation";
}

/** Thrown when a site asks for an ordering the id cannot supply. Loud beats plausible. */
export class ZetaIdSortError extends Error {
  readonly id: ZetaId;
  readonly layoutClass: LayoutClass;
  constructor(id: ZetaId, layoutClass: LayoutClass, detail: string) {
    super(
      `ZetaId sort-by-time refused: id has layout class '${layoutClass}' (version=${versionOf(id)}, ` +
        `category=${categoryOf(id)}), which ${detail}. Sort by identity (compareByIdentity) if any ` +
        `stable total order will do, or carry the time in the record and sort by that.`,
    );
    this.name = "ZetaIdSortError";
    this.id = id;
    this.layoutClass = layoutClass;
  }
}

/**
 * The declared TIME key: milliseconds since the Unix epoch, from the Timestamp field.
 *
 * REFUSES rather than returning a plausible number when the id's layout has no
 * timestamp there — an unknown future version, or any category >= 9 today.
 */
export function timeSortKey(id: ZetaId): bigint {
  const layoutClass = layoutClassOf(id);
  if (layoutClass !== "observation") {
    throw new ZetaIdSortError(
      id,
      layoutClass,
      layoutClass === "unknown-version"
        ? "this build cannot locate a Timestamp field in (it is newer than this code)"
        : "carries a content/opaque payload in the timestamp bit range, not a clock reading",
    );
  }
  return extractField(id, BIT_MASKS.timestamp.offset, BIT_MASKS.timestamp.width);
}

/**
 * The declared IDENTITY key: the whole 128-bit value.
 *
 * Total, deterministic, and defined for every id of every version — including
 * versions that do not exist yet. Use this when you need reproducible output
 * bytes and any total order will do. It carries NO claim about time.
 */
export function identitySortKey(id: ZetaId): bigint {
  return id as bigint;
}

/** Ascending time order. Throws on any id that cannot supply a time. */
export function compareByTime(a: ZetaId, b: ZetaId): number {
  const ka = timeSortKey(a);
  const kb = timeSortKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/** Ascending identity order — stable, arbitrary, version-agnostic. */
export function compareByIdentity(a: ZetaId, b: ZetaId): number {
  return (a as bigint) < (b as bigint) ? -1 : (a as bigint) > (b as bigint) ? 1 : 0;
}

/** Ascending order by any declared contiguous field (the general masked sort). */
export function compareByField(offset: bigint, width: bigint): (a: ZetaId, b: ZetaId) => number {
  return (a, b) => {
    const ka = extractField(a, offset, width);
    const kb = extractField(b, offset, width);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
}

/**
 * True iff a canonical 26-char Crockford string sort over `ids` agrees with time
 * order — the property `workitems/<zetaid>-*.md` filenames are documented to have.
 * Throws (via `timeSortKey`) if the set contains an id that has no time, which is
 * the point: a mixed-layout directory cannot have this property and should say so
 * rather than silently interleave.
 */
export function isTimeSortableSet(ids: readonly ZetaId[]): boolean {
  const byString = [...ids].sort(compareByIdentity);
  for (let i = 1; i < byString.length; i++) {
    if (timeSortKey(byString[i - 1]!) > timeSortKey(byString[i]!)) return false;
  }
  return true;
}
