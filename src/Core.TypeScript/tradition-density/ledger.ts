/**
 * ledger.ts — the append-only record of what each drawn tradition connected to.
 *
 * ## Why append-only is load-bearing here, not merely tidy
 *
 * The instrument's claim is that **density over independent draws** distinguishes real coupling
 * from per-draw confabulation: a pattern-matcher can manufacture *a* connection for any single
 * draw, but it cannot make the same connection recur across independent draws unless there is
 * structure. That argument survives only if the sample is complete. One revised entry — a null
 * quietly rewritten as a hit after the target looked good, a target retargeted to the one that was
 * already winning — and the distribution measures the revision policy instead of the coupling.
 *
 * So the ledger is a **G-Set** (`../g-set`): union only, idempotent, no removal, no overwrite.
 * Re-submitting a byte-identical entry is a no-op (safe retry / replay, discipline #6). Submitting
 * a *different* body under an existing key is **refused as a conflict** — never silently replaced.
 * Conflicts are surfaced to the caller, whose honest recourse is a new draw, not an edit.
 *
 * ## The null is data
 *
 * A draw that produced no specific in-tree target is recorded as `{ kind: "null" }`, and it counts
 * in the denominator of every rate the report prints. Dropping nulls is the classic file-drawer
 * effect (Rosenthal, *"The file drawer problem and tolerance for null results"*, Psychological
 * Bulletin 86(3), 1979): with only the hits retained, a corpus of pure noise reports universal
 * connection. Nulls are the only thing standing between this probe and that failure.
 *
 * ## Targets must be checkable, not evocative
 *
 * A coupled entry names an in-tree target — a path, a rule file, a registry row — that a supplied
 * resolver must confirm exists. "Resonates with the substrate" names nothing, so density cannot be
 * measured over it and it is refused at validation. `Result`-over-exception on the whole path.
 */
import { stringCompare } from "../collation/collation";
import { contains, ofArray, union, type GSet } from "../g-set/g-set";
import type { Draw } from "./draw";

// ── entries ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The submitter's own impression of how deep a connection is. **Captured and never folded.**
 *
 * This is the *fame* signal — a per-draw self-report — and the rule this probe is built under says
 * fame must not set depth (`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`: Kevin
 * Bacon is not the most connected actor; "appointment tracks fame; emergence tracks use"). It is
 * recorded because it is honest data about the *reporter*, and because keeping it lets the report
 * print the fame-vs-use rank gap. `density.ts` computes depth without reading this field, and
 * `density.test.ts` fails if that ever stops being true.
 */
export type SelfReportedDepth = "shallow" | "deep";

/** One named, checkable connection from a drawn tradition to something in this repo. */
export interface CouplingTarget {
  /** Repo-relative path or other resolver-checkable anchor. Must resolve, or the entry is refused. */
  readonly target: string;
  /** One line: what specifically couples. Prose only — never read by the fold. */
  readonly claim: string;
  /** Optional self-report. Recorded; excluded from depth by construction. */
  readonly selfReportedDepth?: SelfReportedDepth;
}

/**
 * What a draw produced. `null` is a first-class outcome, not an absence — an iteration with no
 * entry at all is an experiment that did not run, which is a different and worse thing.
 */
export type Coupling =
  | { readonly kind: "null"; readonly note: string }
  | { readonly kind: "coupled"; readonly targets: readonly CouplingTarget[] };

/** A ledger row: the draw that was made, and what it connected to. */
export interface LedgerEntry {
  readonly corpus: string;
  readonly corpusVersion: string;
  readonly seed: string;
  readonly iteration: number;
  readonly code: string;
  readonly title: string;
  readonly coupling: Coupling;
}

/** Result-over-exception; errors carry the key they concern. */
export type LedgerResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

/**
 * The identity of a row: corpus, revision, seed, iteration. **Not** the drawn code — the same code
 * drawn at two iterations is two independent observations and must not collapse into one.
 */
export function entryKey(e: Pick<LedgerEntry, "corpus" | "corpusVersion" | "seed" | "iteration">): string {
  return `${e.corpus}#${e.corpusVersion}#${e.seed}#${String(e.iteration)}`;
}

/**
 * Canonical serialization: fixed field order, fixed target order (by `target`, code-point order).
 * Two submissions of the same content produce the same bytes, so idempotent re-append is a
 * genuine G-Set no-op rather than a near-miss duplicate.
 */
export function canonicalEntry(e: LedgerEntry): string {
  const coupling =
    e.coupling.kind === "null"
      ? { kind: "null", note: e.coupling.note }
      : {
          kind: "coupled",
          targets: [...e.coupling.targets]
            .sort((a, b) => stringCompare(a.target, b.target))
            .map((t) => ({
              target: t.target,
              claim: t.claim,
              ...(t.selfReportedDepth === undefined ? {} : { selfReportedDepth: t.selfReportedDepth }),
            })),
        };
  return JSON.stringify({
    corpus: e.corpus,
    corpusVersion: e.corpusVersion,
    seed: e.seed,
    iteration: e.iteration,
    code: e.code,
    title: e.title,
    coupling,
  });
}

/** The ledger itself: a G-Set of canonical entry lines, ascending in code-point order. */
export type Ledger = GSet<string>;

export const emptyLedger: Ledger = [];

export function ledgerOfLines(lines: readonly string[]): Ledger {
  return ofArray(stringCompare, lines);
}

export function entriesOf(l: Ledger): readonly LedgerEntry[] {
  return l.map((line) => JSON.parse(line) as LedgerEntry);
}

// ── validation ──────────────────────────────────────────────────────────────────────────────────

/** Does this named target exist in the tree? Injected, so the fold stays pure and testable. */
export type TargetResolver = (target: string) => boolean;

/**
 * An entry is admissible when it matches its own draw, its nulls carry a stated reason, and every
 * coupled target resolves.
 *
 * The draw check is what stops post-hoc substitution: a submitter cannot answer iteration 4 with a
 * tradition that was never drawn there, because the seed says which one was.
 */
export function validateEntry(entry: LedgerEntry, draw: Draw, resolve: TargetResolver): LedgerResult<LedgerEntry> {
  const key = entryKey(entry);
  if (entry.corpus !== draw.corpus || entry.corpusVersion !== draw.corpusVersion) {
    return { ok: false, error: `${key}: corpus mismatch — entry says ${entry.corpus}/${entry.corpusVersion}, draw says ${draw.corpus}/${draw.corpusVersion}` };
  }
  if (entry.seed !== draw.seed || entry.iteration !== draw.iteration) {
    return { ok: false, error: `${key}: not the draw at that key` };
  }
  if (entry.code !== draw.code || entry.title !== draw.title) {
    return { ok: false, error: `${key}: seed drew ${draw.code} "${draw.title}", entry claims ${entry.code} "${entry.title}"` };
  }
  if (entry.coupling.kind === "null") {
    if (entry.coupling.note.trim() === "") return { ok: false, error: `${key}: a null must say what was looked for and not found` };
    return { ok: true, value: entry };
  }
  if (entry.coupling.targets.length === 0) {
    return { ok: false, error: `${key}: a coupled entry with no targets is a null wearing a hit's label — record it as a null` };
  }
  for (const t of entry.coupling.targets) {
    if (t.target.trim() === "") return { ok: false, error: `${key}: empty target` };
    if (t.claim.trim() === "") return { ok: false, error: `${key}: target ${t.target} has no claim` };
    if (!resolve(t.target)) return { ok: false, error: `${key}: target ${t.target} does not resolve — density cannot be measured over a name with no referent` };
  }
  return { ok: true, value: entry };
}

// ── append ──────────────────────────────────────────────────────────────────────────────────────

/**
 * G-Set union of one entry.
 *
 * - identical line already present → no-op, `ok` (idempotent replay)
 * - **different** line under the same key → **refused**; the existing line is left untouched
 * - otherwise → unioned in
 *
 * There is deliberately no update, upsert, or delete in this module. `ledger.test.ts` pins the
 * refusal, so a future "just overwrite it" convenience fails the suite rather than the science.
 */
export function appendEntry(ledger: Ledger, entry: LedgerEntry): LedgerResult<Ledger> {
  const line = canonicalEntry(entry);
  if (contains(stringCompare, ledger, line)) return { ok: true, value: ledger };
  const key = entryKey(entry);
  const clash = entriesOf(ledger).find((e) => entryKey(e) === key);
  if (clash !== undefined) {
    return {
      ok: false,
      error: `${key}: already recorded with different content — the ledger is append-only, so a revision is refused. Draw again at a fresh iteration instead.\n  have: ${canonicalEntry(clash)}\n  new:  ${line}`,
    };
  }
  return { ok: true, value: union(stringCompare, ledger, [line]) };
}

/** Append many, stopping at the first refusal and reporting it. */
export function appendAll(ledger: Ledger, entries: readonly LedgerEntry[]): LedgerResult<Ledger> {
  let acc = ledger;
  for (const e of entries) {
    const r = appendEntry(acc, e);
    if (!r.ok) return r;
    acc = r.value;
  }
  return { ok: true, value: acc };
}

/** JSONL text — one canonical line per entry, ascending. Text in the proof lineage, per the rule. */
export function serializeLedger(l: Ledger): string {
  return l.length === 0 ? "" : `${l.join("\n")}\n`;
}

export function parseLedger(text: string): Ledger {
  return ledgerOfLines(text.split("\n").filter((s) => s.trim() !== ""));
}
