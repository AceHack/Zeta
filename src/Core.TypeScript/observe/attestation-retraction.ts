/**
 * attestation-retraction.ts — the disposition for a polluted attestation record: **superseded in
 * the corpus, never removed from it.**
 *
 * ## What happened, and what the options were
 *
 * Eleven committed records in `docs/observe-events/` hold a filesystem path where a persona name
 * belongs — `/tmp/attest-0rHTQr`, `/tmp/attest-4EC3oi`, `/tmp/attest-hqFnhO`, `mkdtempSync` fixture
 * directories from this module's own end-to-end tests, written by a real run and merged on
 * 2026-08-17. Three personas that do not exist and never could now permanently attest `alexa`, and
 * each other. `verify-attestation-events.test.ts` pins all eleven by name and asserts each is
 * REFUSED, which is deliberate: they are the falsifier for the persona check.
 *
 * A disposition was proposed and explicitly not decided. Three were weighed:
 *
 * | option | what it costs |
 * |---|---|
 * | leave-and-annotate as-is | the correction lives only in a TEST. A future consumer that reads the folder and does not run this verifier sees eleven ordinary-looking attestations and gets three phantom personas, ~4.58 strength, and `hasTrioAttestation: true`. The data says nothing about itself. |
 * | **a recorded retraction that supersedes without removing** | a new event kind, and consumers must be taught to honour it — a consumer that ignores retractions is no better off than under option 1. But the correction is IN the corpus, discoverable by anyone reading the data, and **the eleven files are not touched at all**. |
 * | quarantine into a fixture path | breaks the falsifier — the pinning test asserts those filenames exist *in the corpus directory* — and moving a committed event is itself an edit to the history of where it lived. |
 *
 * **Taken: the recorded retraction.** It is the repo's own Z-set discipline — emit a `-1`, never
 * delete the `+1` — and manifesto §5 (Memory Preservation) applied to embarrassing history, which
 * is the only kind that tests it. The eleven files are byte-identical to what merged; the
 * falsifier survives verbatim; the correction is a fact in the same store as the error.
 *
 * ## One record naming eleven, not eleven records
 *
 * The work-item that raised this weighed *"writing nine or eleven `-1` facts into the shared
 * log"*. One is taken instead, for reasons that are not aesthetic: the eleven share **one cause**
 * (a single leaked fixture run) and therefore **one basis**, and eleven copies of the same basis
 * string is eleven places for it to drift. A retraction is also keyed by what it retracts, so
 * re-issuing it is an upsert rather than a double-count — one record makes that idempotence
 * obvious where eleven make it a claim about a set. `retracts` is a list precisely so a second
 * cause gets a second record rather than an amendment to this one.
 *
 * ## The retraction claims no authority, and that is the design
 *
 * The finding that produced all this is that `by` is a **self-claim** — the corpus holds zero
 * bound records, so no name in it is authenticated. A retraction asserted by an unauthenticated
 * `by` would inherit exactly that weakness, and pretending otherwise would be the same defect
 * wearing a correction's clothes.
 *
 * So the retraction does not ask to be believed. It carries a `basis`: the name of the **check**
 * that re-derives it. Anyone can run `verifyAttestationRecord` over the eleven ids and observe an
 * identity-band refusal for each; the retraction's truth rests on that re-derivation, not on who
 * wrote it. It is a **signpost to a mechanical fact**, not a testimony. If a signed retraction is
 * ever wanted, `attestation-record.ts`'s signing path is the one to use and this record is not in
 * its way.
 *
 * ## Coverage is checked in BOTH directions
 *
 * `retractionCoverage` fails on an identity-band refusal with no retraction (the corpus grew a new
 * polluted record and nobody said so) **and** on a retraction naming a record that is absent or is
 * not actually refused (over-retraction — a correction that erases a fact that was never wrong).
 * Over-retraction is exactly as wrong as under-retraction, for the same reason a ledger that
 * over-charges is still a ledger nobody can reconcile.
 *
 * Anchors (Beacon): Z-set retraction as recorded correction (Budiu et al., DBSP) — the `-1` is a
 * fact, not a deletion; Shapiro et al. 2011 (G-Set) — an append-only store never removes, so a
 * correction must be an append.
 */

import {
  loadEventJson,
  type LoadedEventJson,
} from "./verify-attestation-events.ts";
import {
  verifyAttestationRecord,
  type AttestationRecord,
  type AttestationRefusalReason,
  type PersonaKeyRoster,
} from "./attestation-record.ts";

/** The envelope `kind` of a retraction. Deliberately NOT `"attestation"`. */
export const RETRACTION_KIND = "attestation-retraction";

/** The `action.kind` of a retraction. Not in `load-world.ts`'s `KNOWN_KINDS`, so folds skip it. */
export const RETRACTION_ACTION_KIND = "retract_attestation";

/**
 * The IDENTITY band of refusal reasons — the ones that mean *this record names something that is
 * not a persona*, as opposed to *this record is missing evidence*.
 *
 * The distinction is load-bearing and is the same one `verify-attestation-events.test.ts` makes:
 * the eleven polluted records ALSO lack a digest, and reporting them as `missing-digest` would
 * file an impersonation under "needs a migration". A retraction is owed to the identity band and
 * to nothing else — every record in the corpus is `unbound` and most lack a digest, and retracting
 * those would be retracting the entire corpus for being old.
 */
export const IDENTITY_BAND_REASONS: ReadonlySet<AttestationRefusalReason> = new Set([
  "malformed-attestor",
  "malformed-attested",
  "malformed-participants",
  "envelope-attestor-mismatch",
]);

/** The body of a retraction record. */
export interface AttestationRetraction {
  /** The event ids being superseded. Never removed — these files stay exactly where they are. */
  readonly retracts: readonly string[];
  /**
   * The re-derivable check that establishes the retraction, named so a reader never has to trust
   * the retractor. Free text by design: it points at a mechanism, it is not one.
   */
  readonly basis: string;
  /** Fixed. There is deliberately no value here meaning "removed". */
  readonly disposition: "superseded-not-removed";
}

/** The on-disk retraction record — the same envelope every observe event uses. */
export interface AttestationRetractionRecord {
  readonly id: string;
  readonly at: string;
  readonly by: string;
  readonly kind: typeof RETRACTION_KIND;
  readonly action: { readonly kind: typeof RETRACTION_ACTION_KIND; readonly reason: string };
  readonly retraction: AttestationRetraction;
}

const HEX_ID = /^[0-9a-f]{32}$/;

/**
 * Schema-on-read parse. Returns `null` rather than throwing — this folder holds three naming
 * schemes and several unrelated file kinds, and a reader that throws on a neighbour's file is a
 * reader that fails for a reason that has nothing to do with it.
 *
 * A retraction that retracts nothing is refused: an empty `retracts` is the vacuity class, a
 * correction that corrects nothing while looking like compliance.
 */
export function parseRetraction(raw: unknown): AttestationRetractionRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== RETRACTION_KIND) return null;
  if (typeof r.id !== "string" || !HEX_ID.test(r.id)) return null;
  if (typeof r.at !== "string" || typeof r.by !== "string" || r.by.length === 0) return null;

  const action = r.action;
  if (typeof action !== "object" || action === null) return null;
  const a = action as Record<string, unknown>;
  if (a.kind !== RETRACTION_ACTION_KIND || typeof a.reason !== "string") return null;

  const body = r.retraction;
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.disposition !== "superseded-not-removed") return null;
  if (typeof b.basis !== "string" || b.basis.trim().length === 0) return null;
  if (!Array.isArray(b.retracts) || b.retracts.length === 0) return null;
  if (!b.retracts.every((x) => typeof x === "string" && HEX_ID.test(x))) return null;

  return {
    id: r.id,
    at: r.at,
    by: r.by,
    kind: RETRACTION_KIND,
    action: { kind: RETRACTION_ACTION_KIND, reason: a.reason },
    retraction: {
      retracts: b.retracts as readonly string[],
      basis: b.basis,
      disposition: "superseded-not-removed",
    },
  };
}

/** A parsed retraction plus the file it came from. */
export interface LoadedRetraction {
  readonly file: string;
  readonly record: AttestationRetractionRecord;
}

/**
 * Read the retraction records out of an event directory.
 *
 * Selection is by parsed `kind`, never by filename — the same rule `loadAttestationRecords`
 * follows, and for the same reason: lexical order here is not time order and three naming schemes
 * coexist, so any filename-derived selection silently reads the wrong subset.
 */
export function loadRetractions(dir: string): readonly LoadedRetraction[] {
  return selectRetractions(loadEventJson(dir));
}

/**
 * Select the retractions out of already-parsed event JSON — the companion to
 * `selectAttestationRecords`, so a caller that needs both views reads the directory once.
 */
export function selectRetractions(entries: readonly LoadedEventJson[]): readonly LoadedRetraction[] {
  const out: LoadedRetraction[] = [];
  for (const { file, raw } of entries) {
    const rec = parseRetraction(raw);
    if (rec !== null) out.push({ file, record: rec });
  }
  return out;
}

/** Every event id named by any retraction. */
export function retractedIds(retractions: readonly LoadedRetraction[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const { record } of retractions) for (const id of record.retraction.retracts) out.add(id);
  return out;
}

/** What a coverage check found. No aggregate boolean — each failure mode reports under its own name. */
export interface RetractionCoverage {
  /** Records refused for an identity-band reason and covered by a retraction. The good case. */
  readonly covered: readonly string[];
  /**
   * Records refused for an identity-band reason that **no retraction names**. A new polluted
   * record reached the corpus and nothing recorded the correction.
   */
  readonly uncovered: readonly { readonly id: string; readonly reason: AttestationRefusalReason }[];
  /**
   * Ids named by a retraction that are absent from the corpus, or present and NOT refused for an
   * identity-band reason. Over-retraction: a correction aimed at a fact that was never wrong.
   */
  readonly overreach: readonly string[];
}

/**
 * Check retraction coverage in both directions over a loaded corpus.
 *
 * `records` are the attestation records (`loadAttestationRecords`); `retractions` are the
 * retraction records (`loadRetractions`). The roster decides signature binding and does not affect
 * the identity band, which is checked structurally before any key is consulted.
 */
export function retractionCoverage(
  records: readonly { readonly file: string; readonly record: AttestationRecord }[],
  retractions: readonly LoadedRetraction[],
  roster: PersonaKeyRoster,
): RetractionCoverage {
  const retracted = retractedIds(retractions);
  const covered: string[] = [];
  const uncovered: { id: string; reason: AttestationRefusalReason }[] = [];
  const identityBand = new Set<string>();

  for (const { record } of records) {
    const v = verifyAttestationRecord(record, { roster });
    if (v.status !== "refused" || !IDENTITY_BAND_REASONS.has(v.reason)) continue;
    identityBand.add(record.id);
    if (retracted.has(record.id)) covered.push(record.id);
    else uncovered.push({ id: record.id, reason: v.reason });
  }

  const overreach = [...retracted].filter((id) => !identityBand.has(id)).sort();

  return {
    covered: covered.sort(),
    uncovered: uncovered.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    overreach,
  };
}
