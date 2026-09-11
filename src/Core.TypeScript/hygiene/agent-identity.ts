/**
 * agent-identity.ts — group the attribution corpus by WHO actually wrote a commit.
 *
 * ## Why this exists
 *
 * Every commit carries an AgencySignature v1 block naming `Agent-Model` and `Agent-Runtime`.
 * Coverage is 100%: measured 2026-09-10, 425 blocks across the last 300 commits, every one of
 * them populated. The fields were nonetheless UNUSABLE, because both were free text and the
 * values fragmented:
 *
 *   claude-opus-5 · Claude Opus 5 · claude-opus-5[1m] · Claude      1538 commits, ONE model
 *   claude-code · Claude Code · claude-code/cli · (remote container) 1489 commits, ONE harness
 *   bun + git + gh CLI                                              1324 commits, NOT A MODEL
 *
 * A corpus that cannot be GROUPED cannot be correlated, so the data collected to answer
 * "does this defect class cluster by model?" could not answer it. That question is the point:
 * if agents drawing on a shared prior fail together, the evidence is in this corpus, and
 * `Agent-Model` is the only column that could show it.
 *
 * ## Aliases, not rewrites
 *
 * History is immutable and rewriting 3000 commit messages to tidy a label would be the
 * laundering this repo refuses elsewhere. So the aliases are RECORDED and normalisation
 * happens at read time. The roster is data (`registry/agent-identity-roster.json`), so adding
 * a model is a reviewed diff rather than a code change.
 *
 * ## `none-automation` is a value, not a gap
 *
 * A workflow with no model in the loop needs somewhere honest to say so. Left free, those
 * lanes wrote their toolchain into the model field and became a phantom sixth model family in
 * every grouping. Naming the absence is what stops absence from looking like presence — the
 * same discipline this repo applies to `unknown` versus a negative result.
 */

export interface IdentityEntry {
  readonly canonical: string;
  readonly aliases: readonly string[];
}

export interface IdentityRoster {
  readonly models: readonly IdentityEntry[];
  readonly harnesses: readonly IdentityEntry[];
}

/** The sanctioned value for "no model was in the loop", never a missing field. */
export const NO_MODEL = "none-automation";

/**
 * Canonical name for a raw field value, or `null` when the roster does not know it.
 *
 * `null` is deliberately NOT a fallback to the raw string: an unrecognised value must be
 * VISIBLE, because the whole failure this module exists for is values drifting unnoticed.
 * Matching is ordinal and case-insensitive — these are ASCII identifiers, and a linguistic
 * compare would drift with the reader's locale (`culture-invariant-by-default`).
 */
export function canonicalize(raw: string, entries: readonly IdentityEntry[]): string | null {
  const want = raw.trim().toLowerCase();
  if (want === "") return null;
  for (const e of entries) {
    if (e.canonical.toLowerCase() === want) return e.canonical;
    for (const a of e.aliases) if (a.toLowerCase() === want) return e.canonical;
  }
  return null;
}

export interface AttributionRow {
  readonly model: string | null;
  readonly harness: string | null;
  readonly rawModel: string;
  readonly rawHarness: string;
}

/** Normalise one signature block's two identity fields. */
export function attributionOf(
  rawModel: string,
  rawHarness: string,
  roster: IdentityRoster,
): AttributionRow {
  return {
    model: canonicalize(rawModel, roster.models),
    harness: canonicalize(rawHarness, roster.harnesses),
    rawModel,
    rawHarness,
  };
}

/**
 * Group rows by canonical model. Unrecognised values collect under `null` so an analysis
 * REPORTS its own blind spot rather than silently dropping the rows or, worse, inventing a
 * category per spelling.
 */
export function groupByModel(rows: readonly AttributionRow[]): Map<string | null, number> {
  const out = new Map<string | null, number>();
  for (const r of rows) out.set(r.model, (out.get(r.model) ?? 0) + 1);
  return out;
}
