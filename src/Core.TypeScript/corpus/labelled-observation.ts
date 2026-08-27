/**
 * labelled-observation.ts — one domain-agnostic type for every corpus we keep.
 *
 * WHY. Aaron 2026-08-27, on the PR archives / shadow logs / decorrelation records:
 *
 *   "we can now make this generic and reusable and have well defined types that work in any domain,
 *    where today each one of our corpuses are a little bit adhoc, our agency signature stuff is half
 *    of the labling too, we've been labling the crap out of things but i'm sure they will [be] even
 *    more we didn't think of."
 *
 * Three asks in that sentence, and the third is the hard one:
 *
 *   1. GENERIC — one type across domains, not a schema per corpus.
 *   2. WELL-DEFINED — a real type, not a bag of strings.
 *   3. EXTENSIBLE IN THE LABEL DIMENSION — labels nobody has thought of yet must be expressible
 *      WITHOUT a schema change, because the ones we would design for today are exactly the ones we
 *      already know about.
 *
 * (2) and (3) pull against each other, and collapsing either way is how corpora rot: a closed label
 * enum needs a migration for every new question, and a free-form blob is not a type at all. The
 * resolution is Data Vault 2.0 — partition by CHANGE RATE:
 *
 *     HUB       the observation. Stable, content-addressed, domain-agnostic. Rarely changes.
 *     SATELLITE the labels. Open set, many asserters, added constantly.
 *
 * The hub is closed and typed; the label SPACE is open while the label SHAPE is closed. A new label
 * kind needs no migration; it still cannot be anonymous, undated, or unattributed.
 *
 * THE PROPERTY THAT MAKES THIS OUR CORPUS AND NOT A GENERIC ONE. Standard labelled datasets carry
 * ONE label per row — a prompt and its accepted answer — because their consumer wants a supervised
 * target. That format cannot represent a disagreement, so pipelines built on it discard the
 * disagreement before storage. Ours is disagreement-shaped on purpose, so:
 *
 *     CONFLICTING LABELS COEXIST. Nothing here picks a winner, and there is no API that can.
 *
 * That is the raw vault sentence — *a single version of the FACTS, never a single version of the
 * TRUTH* — expressed as a type. `labelsFor` returns every assertion including the contradictory
 * ones; resolution, if a consumer wants one, happens downstream where the choice is visible and
 * attributable. A `resolvedLabel()` helper is deliberately ABSENT: adding one would make collapse
 * the path of least resistance, and the collapse is the thing this corpus exists to avoid.
 *
 * AGENCYSIGNATURE IS HALF OF THIS ALREADY. Its ten keys are provenance labels on a commit — who
 * acted, under what credential, with what review. `Provenance` below is that idea generalised off
 * commits and onto any observation, which is why an AgencySignature block maps onto labels with no
 * information lost (`labelsFromSignatureBlock`).
 *
 * NO AMBIENT ANYTHING. No clock, no filesystem, no network. Time is a supplied logical tick, so two
 * readers of the same rows agree regardless of when they read (§13 noninterference).
 */

/** Who asserted a label. An agent, a human handle, or a named automated check. */
export type Asserter = string;

/**
 * A label's fully-qualified name: `namespace/name`. The namespace is what keeps an open set from
 * becoming a collision space — `review/verdict` and `perf/verdict` are different questions.
 */
export interface LabelKey {
  readonly namespace: string;
  readonly name: string;
}

/**
 * A single assertion about an observation.
 *
 * `value` is `string` rather than a union on purpose: the union would have to be edited for every
 * new question, which is the extensibility requirement failing. What is NOT optional is who said
 * it and when — an unattributed label is an opinion with no owner, and a corpus of those cannot
 * support disagreement at all, because you cannot disagree with nobody.
 */
export interface Label {
  readonly key: LabelKey;
  readonly value: string;
  readonly assertedBy: Asserter;
  /** Logical tick. Supplied, never read from a clock. */
  readonly at: number;
  /** Optional free-text justification. Cheap to carry, expensive to reconstruct later. */
  readonly because?: string;
}

/**
 * Provenance — the generalisation of the AgencySignature block off commits and onto observations.
 * Every field is `unknown`-able because a measured absence beats a convenient assumption.
 */
export interface Provenance {
  readonly agent: string;
  readonly runtime: string;
  readonly model: string;
  readonly credentialIdentity: string;
  readonly credentialMode: string;
}

/** Where an observation came from. Open by the same argument as labels. */
export interface Origin {
  /** `pr-archive`, `shadow-log`, `decorrelation`, `peer-call`, ... */
  readonly corpus: string;
  /** Stable identifier WITHIN that corpus — a PR number, a tick id, a commit sha. */
  readonly ref: string;
}

/**
 * The hub. Domain-agnostic: `content` is whatever the exchange was, and this module never parses it.
 * Refusing to interpret the payload is what makes one type serve every corpus.
 */
export interface Observation {
  /** Stable identity. Content-addressed by the caller; this module treats it as opaque. */
  readonly id: string;
  readonly origin: Origin;
  readonly content: string;
  readonly provenance: Provenance | null;
}

export interface CorpusRow {
  readonly observation: Observation;
  readonly labels: readonly Label[];
}

/** Refusals are data. A malformed row must not stop a fold over a million of them. */
export interface LabelRefusal {
  readonly label: Label;
  readonly why: string;
}

const NS_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Validate a label's SHAPE. Note what is not checked: the namespace and name are not compared
 * against any roster. That absence is the extensibility requirement — a label nobody has thought of
 * is accepted on the day it is invented, and is still attributed, dated, and namespaced.
 */
export function labelRefusalReason(l: Label): string | null {
  if (!NS_RE.test(l.key.namespace)) {
    return `namespace '${l.key.namespace}' must be lowercase kebab-case — namespaces stop an open label set becoming a collision space`;
  }
  if (!NS_RE.test(l.key.name)) return `name '${l.key.name}' must be lowercase kebab-case`;
  if (l.value.length === 0) return "value is empty";
  if (l.assertedBy.length === 0) {
    return "label has no asserter — an unattributed label cannot be disagreed with, which defeats the corpus";
  }
  if (!Number.isInteger(l.at) || l.at < 0) return `at ${String(l.at)} is not a non-negative tick`;
  return null;
}

/** `namespace/name`, the canonical rendering. */
export function renderLabelKey(k: LabelKey): string {
  return `${k.namespace}/${k.name}`;
}

/** Ordinal — never `localeCompare`, which would order differently per machine. */
function compareOrdinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * EVERY assertion under `key`, including mutually contradictory ones, in assertion order.
 *
 * This returning a list rather than a value is the whole design. A `resolvedLabel()` that picked
 * latest-wins or majority-wins would be one keystroke away and would silently convert a corpus of
 * facts into a corpus of verdicts.
 */
export function labelsFor(row: CorpusRow, key: LabelKey): readonly Label[] {
  const k = renderLabelKey(key);
  return row.labels.filter((l) => renderLabelKey(l.key) === k);
}

/**
 * True when two or more asserters gave DIFFERENT values under one key.
 *
 * Not an error condition — a retained disagreement is the highest-value row in this corpus, and
 * this predicate exists to FIND those rows, never to reject them.
 */
export function isContested(row: CorpusRow, key: LabelKey): boolean {
  const vs = new Set(labelsFor(row, key).map((l) => l.value));
  return vs.size > 1;
}

/** Every key on which this row carries a disagreement, ordinal-sorted. */
export function contestedKeys(row: CorpusRow): readonly string[] {
  const byKey = new Map<string, Set<string>>();
  for (const l of row.labels) {
    const k = renderLabelKey(l.key);
    const s = byKey.get(k) ?? new Set<string>();
    s.add(l.value);
    byKey.set(k, s);
  }
  return [...byKey.entries()]
    .filter(([, vs]) => vs.size > 1)
    .map(([k]) => k)
    .sort(compareOrdinal);
}

/** Add labels, keeping every prior one. Append-only: nothing here can overwrite an assertion. */
export function addLabels(
  row: CorpusRow,
  incoming: readonly Label[],
): { readonly row: CorpusRow; readonly refused: readonly LabelRefusal[] } {
  const refused: LabelRefusal[] = [];
  const accepted: Label[] = [];
  for (const l of incoming) {
    const why = labelRefusalReason(l);
    if (why !== null) refused.push({ label: l, why });
    else accepted.push(l);
  }
  return { row: { ...row, labels: [...row.labels, ...accepted] }, refused };
}

/** The ten AgencySignature keys that are provenance rather than free-form. */
const SIGNATURE_LABEL_NS = "agency-signature";

/**
 * Map an AgencySignature block onto labels — the concrete demonstration that the existing labelling
 * is half of this one. Nothing is dropped and nothing is interpreted: an unrecognised key becomes a
 * label under the same namespace, which is the open-label property doing its job on real data.
 */
export function labelsFromSignatureBlock(
  block: Readonly<Record<string, string>>,
  assertedBy: Asserter,
  at: number,
): readonly Label[] {
  return Object.entries(block)
    .map(([k, value]) => ({
      // `Credential-Mode` -> `credential-mode`; ordinal lowercasing, not locale-aware.
      key: { namespace: SIGNATURE_LABEL_NS, name: k.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") },
      value,
      assertedBy,
      at,
    }))
    .filter((l) => labelRefusalReason(l) === null)
    .sort((a, b) => compareOrdinal(renderLabelKey(a.key), renderLabelKey(b.key)));
}
