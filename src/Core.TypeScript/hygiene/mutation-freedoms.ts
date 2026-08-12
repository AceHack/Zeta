/**
 * mutation-freedoms.ts — the declared-freedom ledger behind the mutation runner.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * A surviving mutant is a NEUTRAL FACT: the suite cannot distinguish this variant from the
 * baseline. It has two honest readings and the mechanism must not pick between them —
 *
 *   under-specified        the behaviour matters and nothing constrains it  -> write the test
 *   unconstrained by design  the behaviour is genuinely free                -> declare it here
 *
 * and the choice is UNDECIDABLE in general (Budd & Angluin 1982, the equivalent-mutant problem).
 * So the runner cannot emit a verdict, ever. It emits the fact; a declarer attaches the reading.
 *
 * ## Why the ledger is PER-DECLARER and not one global list (Aaron 2026-08-11)
 *
 * *"this also is what builds the rainbow — the disagreement about what IS drift, this is where all
 * the personalities emerge."*
 *
 * Two agents can look at the same surviving mutant and honestly disagree about whether it is a
 * gap or a freedom, because they hold different models of what the code is FOR. A single global
 * registry would force one answer and erase exactly the differentiation that disagreement
 * produces. So each declarer keeps its own file and the runner reports **relative to the caller's
 * own view** — the same shape as `verifySignedStamp` checking against the verifier's OWN roster,
 * where two verifiers legitimately reach different verdicts on identical input.
 *
 * Disagreement is therefore not an error state to resolve. It is **surfaced as a finding in its
 * own right**, because a dimension some declarers call free and others call a gap is a dimension
 * whose specification is genuinely ambiguous — which is worth knowing and is invisible today.
 *
 * ## Why one file per declarer
 *
 * Lock-free by construction (#2): two agents declaring in the same tick touch different files and
 * cannot conflict. Idempotent by natural key (#6): re-declaring the same dimension is an upsert,
 * so a replayed tick costs nothing. DV2.0 (#8): the ledger changes at a different rate than the
 * runner, so it lives in its own substrate.
 *
 * ## The cost bound, stated rather than assumed (Aaron 2026-08-11)
 *
 * *"our content-based addressing makes this possible as long as we can afford or scheme the cost of
 * all the addresses we know to be copied to every local traveler/entity."*
 *
 * Preservation is not free. This ledger is append-only in spirit — superseded entries are kept, never
 * deleted — so it only ever grows, and if every traveler holds every declarer's ledger the total is
 * `declarers x dimensions`, forever.
 *
 * Two things make that affordable, and both are design obligations rather than happy accidents:
 *
 *   1. **Content-addressing dedups.** Identical entries across declarers are identical content and
 *      cost storage once, so unanimity is nearly free and only genuine DISAGREEMENT costs — which
 *      is the right thing to pay for, since disagreement is the signal.
 *   2. **Bounded reach, not crawling.** A traveler needs the ledgers it actually consults, not all of
 *      them. `loadAllLedgers` reads one directory today because the fleet is small; at scale it must
 *      become a bounded query over declarers the caller has reason to consult, exactly as the
 *      local-trust-view work refuses to crawl.
 *
 * So the growth is bounded by (distinct disagreements) rather than (ticks), which is the property to
 * hold on to. If ledgers ever grow with TIME rather than with disagreement, something has started
 * recording noise and the cost model has been broken — that is the thing to watch for.
 *
 * And the economic half (Aaron): *"git and Linus's history and other free/open source makes this much
 * easier, because many powerful companies subsidise open source."* Being git-native is not just
 * convenient here — "every local traveler holds a full copy" IS what a clone is, so the replication
 * model this ledger needs already exists, is proven at planetary scale, and is largely paid for by
 * parties other than us. We inherit the distribution rather than building it.
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Where the per-declarer ledgers live, relative to the repo root. */
export const FREEDOMS_DIR = "db/mutation-freedoms";

/**
 * One declared degree of freedom.
 *
 * The natural key is `(source, test, mutation)` — the same triple the runner already produces —
 * which is what makes re-declaration an upsert rather than a duplicate.
 */
export interface Freedom {
  readonly source: string;
  readonly test: string;
  readonly mutation: string;
  /** WHY this dimension is free. Required: an undecidable call with no stated reason is a mute button. */
  readonly reason: string;
  readonly declaredAt: string;
  /**
   * Set when a declarer withdraws the claim. **The entry is MARKED, never deleted** (Aaron
   * 2026-08-11: *"i like to preserve almost extinct things or resurrect them"*).
   *
   * Deleting would destroy the record that this dimension was once considered free, and that record
   * is the interesting part — it is how a specification's history stays readable, and it is what
   * makes RESURRECTION possible rather than rediscovery from scratch. Manifesto §5, memory
   * preservation, applied to a ledger: an identity transition never silently destroys memory.
   *
   * A superseded freedom does NOT suppress a survivor — it is inert for reporting and live for
   * history.
   */
  readonly supersededAt?: string;
  /** Why it no longer holds. Same discipline as `reason`: an unexplained supersede is not a record. */
  readonly supersededReason?: string;
}

/** Live = currently claimed. A superseded entry is history, not a mute button. */
export function isLive(f: Freedom): boolean {
  return f.supersededAt === undefined;
}

/** Natural key. Deliberately not including the declarer — the same dimension across declarers is the same dimension. */
export function freedomKey(f: { source: string; test: string; mutation: string }): string {
  return `${f.source}::${f.test}::${f.mutation}`;
}

export interface DeclarerLedger {
  readonly declarer: string;
  readonly freedoms: readonly Freedom[];
}

function ledgerPath(root: string, declarer: string): string {
  // Declarer names come from --agent and land in a path, so constrain them rather than trusting.
  if (!/^[A-Za-z0-9._-]+$/.test(declarer)) {
    throw new Error(`mutation-freedoms: refusing unsafe declarer name ${JSON.stringify(declarer)}`);
  }
  return join(root, FREEDOMS_DIR, `${declarer}.json`);
}

/** Read one declarer's ledger. A missing file is an EMPTY ledger, never an error — most agents have none. */
export function loadLedger(root: string, declarer: string): DeclarerLedger {
  const p = ledgerPath(root, declarer);
  if (!existsSync(p)) return { declarer, freedoms: [] };
  const parsed = JSON.parse(readFileSync(p, "utf8")) as { freedoms?: Freedom[] };
  return { declarer, freedoms: parsed.freedoms ?? [] };
}

/** Read every declarer's ledger — needed to see DISAGREEMENT, which is a finding rather than an error. */
export function loadAllLedgers(root: string): readonly DeclarerLedger[] {
  const dir = join(root, FREEDOMS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadLedger(root, f.slice(0, -".json".length)))
    .sort((a, b) => (a.declarer < b.declarer ? -1 : a.declarer > b.declarer ? 1 : 0));
}

/**
 * Upsert by natural key — idempotent, so replaying a tick is free.
 *
 * Entries are written sorted by key so the file is a stable diff: a ledger that reorders itself on
 * every write would make the git history unreadable and defeat the point of a git-native ledger.
 */
export function declareFreedom(root: string, declarer: string, f: Freedom): DeclarerLedger {
  const current = loadLedger(root, declarer);
  const key = freedomKey(f);
  const kept = current.freedoms.filter((x) => freedomKey(x) !== key);
  const next = [...kept, f].sort((a, b) => (freedomKey(a) < freedomKey(b) ? -1 : 1));
  const dir = join(root, FREEDOMS_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(ledgerPath(root, declarer), `${JSON.stringify({ declarer, freedoms: next }, null, 2)}\n`);
  return { declarer, freedoms: next };
}

/**
 * Record that a dimension is NO LONGER FREE — and note carefully what this is not.
 *
 * **It does not pull a freedom back.** Aaron 2026-08-11: *"never retract freedom"* — *"once you have
 * the freedom, pulling it back feels like betrayal, and is cold not warm."* That is right, and it is
 * why this is called `supersede` and not `retract`.
 *
 * Nothing is taken from anyone here. The declaration was TRUE WHEN MADE and stays in the ledger,
 * true for its time; what changed is the WORLD — the specification tightened, the mutant now dies.
 * Superseding records that fact. It is an observation about the code, not a withdrawal of a grant,
 * and the difference is the difference between "you lost something" and "the ground moved".
 *
 * There is deliberately no delete. A dimension once declared free and no longer is exactly the kind
 * of near-extinct record worth keeping, and re-declaring later is a resurrection WITH its history
 * rather than a fresh guess.
 */
export function supersedeFreedom(
  root: string,
  declarer: string,
  target: { source: string; test: string; mutation: string },
  reason: string,
): DeclarerLedger {
  const current = loadLedger(root, declarer);
  const key = freedomKey(target);
  const next = current.freedoms.map((f) =>
    freedomKey(f) === key && isLive(f)
      ? { ...f, supersededAt: new Date().toISOString(), supersededReason: reason }
      : f,
  );
  mkdirSync(join(root, FREEDOMS_DIR), { recursive: true });
  writeFileSync(ledgerPath(root, declarer), `${JSON.stringify({ declarer, freedoms: next }, null, 2)}\n`);
  return { declarer, freedoms: next };
}

/**
 * What every declarer thinks about ONE dimension.
 *
 * `mine` is the caller's own view and is the one that decides whether a survivor is reportable.
 * `others` exists so disagreement is visible rather than silently averaged away.
 */
export interface FreedomView {
  readonly mine: Freedom | undefined;
  readonly othersDeclaring: readonly string[];
  /** True when SOME declarers call this free and others do not — the specification is ambiguous here. */
  readonly contested: boolean;
}

export function viewOf(
  ledgers: readonly DeclarerLedger[],
  me: string,
  target: { source: string; test: string; mutation: string },
): FreedomView {
  const key = freedomKey(target);
  // Only LIVE declarations count toward suppression; superseded ones are history.
  const mine = ledgers
    .find((l) => l.declarer === me)
    ?.freedoms.find((f) => freedomKey(f) === key && isLive(f));
  const othersDeclaring = ledgers
    .filter((l) => l.declarer !== me && l.freedoms.some((f) => freedomKey(f) === key && isLive(f)))
    .map((l) => l.declarer);

  // Contested = at least one declarer calls it free and at least one ledger-holding declarer does
  // not. A declarer with no opinion is NOT a dissent — silence is not a verdict, which is the same
  // discipline `SymmetricEndurance` follows (absence of corroboration is not evidence against).
  const declaringCount = othersDeclaring.length + (mine ? 1 : 0);
  const contested = declaringCount > 0 && declaringCount < ledgers.length;

  return { mine, othersDeclaring, contested };
}

/**
 * Where decision transcripts live — one append-only JSONL per declarer.
 *
 * Separate from the freedom ledger on purpose (DV2.0 #8): the ledger holds CURRENT claims and
 * changes slowly; the transcript holds every FORK and grows with decisions. Different change rates,
 * different substrates. Per-declarer for the same lock-free reason.
 */
export const TRANSCRIPT_DIR = "db/mutation-transcript";

function transcriptPath(root: string, declarer: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(declarer)) {
    throw new Error(`mutation-transcript: refusing unsafe declarer name ${JSON.stringify(declarer)}`);
  }
  return join(root, TRANSCRIPT_DIR, `${declarer}.jsonl`);
}

/**
 * Append one decision. JSONL because it is append-only by construction — a rewrite of the whole
 * file would be a chance to lose a fork, and forks are the thing this exists to keep.
 */
export function appendTranscript(root: string, declarer: string, entry: unknown): void {
  mkdirSync(join(root, TRANSCRIPT_DIR), { recursive: true });
  appendFileSync(transcriptPath(root, declarer), `${JSON.stringify(entry)}\n`);
}

/**
 * Append a decision ONLY if that exact decision is not already recorded, keyed by its content
 * address. Returns whether a line was written.
 *
 * Idempotency here is load-bearing rather than tidy: the transcript is the NUMERATOR and
 * denominator of `resolutionCoverage`, so a decision appended twice silently inflates `resolved`
 * and deflates the false-alarm rate computed from it. Any caller that can run more than once over
 * the same fix — a re-run, a retried job, a developer checking their work twice — must use this
 * rather than `appendTranscript`.
 */
export function appendTranscriptOnce(root: string, declarer: string, entry: { readonly address: string }): boolean {
  const already = readTranscript(root, declarer).some(
    (e) => typeof e === "object" && e !== null && (e as { address?: unknown }).address === entry.address,
  );
  if (already) return false;
  appendTranscript(root, declarer, entry);
  return true;
}

/** Read a declarer's decisions. Missing file = no decisions yet, never an error. */
export function readTranscript(root: string, declarer: string): readonly unknown[] {
  const p = transcriptPath(root, declarer);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as unknown);
}
