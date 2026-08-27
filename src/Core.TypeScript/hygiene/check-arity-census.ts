// check-arity-census.ts -- the shared census substrate for BOTH halves of the check-arity class.
//
// WHY THIS FILE EXISTS
// --------------------
// `audit-check-arity.ts` (R2, self-comparisons) and `audit-check-arity-nonequality.ts` (R5,
// absence-under-a-taint-claim) each ratchet a hand-maintained JSON census. Over 2026-08-26 that
// coupling red-lined `main` in three separate episodes, across BOTH audits:
//
//   08-26 14:51:19Z -> 20:18:33Z   R5, 5h27m, 8 consecutive failing runs and zero greens between.
//                                  Onset `880690e6` (frost HSM ceremony); cured by `f208f60a`, a
//                                  ONE-FILE +1/-0 commit adding a census row -- five hours later.
//   08-25 21:48:12Z -> 22:02:50Z   R2, cured by `d65a8f85` (#15446) FIXING the test instead.
//   08-27 00:37:16Z -> (open)      R2, onset `ed28cf9e` (#15718). Still red at `c6e264ba`.
//
// The shape is always the same: a change adds an assertion, the census row is not raised in the
// same commit, and the check goes red on job `lint-bash-retirement-inventory` -- which is NOT in
// `gate (required)`'s `needs` (that list names job IDs, and its `lint` entry is job `lint`, display
// name `lint (semgrep)`, a different job entirely). 20 PRs merged during the 5h27m window. So
// nothing forces anyone to clear it, and nobody did until someone read the check name.
//
// THE DEFECT IS THE COUPLING, NOT ANY INSTANCE: a check whose passing depends on a separate change
// remembering to hand-edit a registry file. Two live proofs were sitting on `main` when this file
// was written, and both are the coupling rather than the rule:
//
//   * `registry/check-arity-nonequality-census.json` carried the key
//     `tools/setup/persona-keys/frost-hsm-secrets.test.ts` TWICE, at lines 50 and 52. `f208f60a`
//     (#15662) and `0054459b33` (#15646) each added the identical row by hand, hours apart, neither
//     able to see the other's edit. `JSON.parse` keeps the last duplicate and discards the first
//     silently, so the audit read the file, saw the right counts, and passed -- while the checked-in
//     artefact was not the artefact the audit describes. A hand-maintained "byte-locked" file that
//     nothing round-trips is not byte-locked.
//   * `registry/check-arity-census.json` was MISSING `tests/Tests.FSharp/ZetaFsDualFold.Tests.fs`,
//     so `hygiene:check-arity` was red on `main` at that moment -- the third episode above, found by
//     running the audit rather than by reading the check name.
//
// WHAT THIS MODULE ADDS, AND WHAT IT DELIBERATELY DOES NOT
// -------------------------------------------------------
// It does NOT derive-and-accept. The census is MECHANICALLY derivable -- `--emit-census` already
// reproduces it exactly -- but its whole function is to make a human LOOK when the population
// changes. A CI step that re-derived and accepted would make R2/R5 a check that cannot fail, which
// is this class's own subject. So the fix is the other half of the pair: keep the ratchet, and make
// forgetting it impossible and cheap to clear.
//
//   1. CANONICAL FORM IS CHECKED (`isCanonical`). The census must round-trip: the bytes on disk
//      must equal `serializeCensus` of what `JSON.parse` returns. Duplicate keys, hand-inserted
//      rows out of ordinal order, and formatting drift all fail here, where before they were
//      invisible. This is a form check, not a content check -- it never touches the ratchet.
//   2. THE FIX COMMAND IS NAMED VERBATIM in every failure, and it is the SAME code path as the
//      check (`--emit-census --write`), so check and fix cannot disagree -- the property
//      `build-graph.ts derive --write` and `cross-verify-roster.ts --derive --write` already have.
//   3. THE FAILURE NAMES THE SITES, not just a count. `count rose 0 -> 3` sends a reader hunting;
//      `path:line -- <test name> -- <verb>` is the adjudication in one glance. Adjudication is what
//      the ratchet exists to force, so making it one glance is the whole point.
//   4. IT EMITS GITHUB ANNOTATIONS. Every one of the three episodes reported exactly
//      `Process completed with exit code 1` in the check-run -- the finding was only in the log.
//      Same defect #15692 fixed for `build-and-test`.
//   5. IT IS SELF-SCOPING (`corpusTouched`), so a `drift-check` mode can sit in preflight and cost
//      ~0.05 s on a change that touches no test file, and the full ~3 s only when it applies.
//
// THE GUARD ON THE FIX COMMAND -- the part that keeps this from becoming a silencer
// ---------------------------------------------------------------------------------
// A census row has TWO possible meanings and they are not interchangeable:
//
//   ACCEPT    the new site was adjudicated CORRECT -- typically because an exact-equality pin or a
//             positive assertion carries the claim beside it -- and the row records that judgement.
//   SILENCE   the new site is a TRUE finding, and the row makes it stop being reported.
//
// The artefact cannot tell them apart, so a `--write` that raises counts on demand would make
// SILENCE the path of least resistance -- strictly worse than the coupling it was built to remove.
// Measured on this tree before the guard existed: after the two seeding sweeps (`d7a5d2eb`, 109
// rows; `049f64b4`, 56 rows) there were TEN census edits, and all ten ADDED or raised a row. Not one
// ever lowered or removed one. A ledger you can only add to is a suppression list, whatever anyone
// intended. The other remedy does happen and leaves no trace here, which is why that count
// understates it: `d65a8f85` (#15446) cleared an R2 red by FIXING the test, so
// `FreeTimeAllocation.Tests.fs` appears in no census at all.
//
// So `--write` is split at exactly that seam:
//
//   `--write`                  applies only what carries NO judgement -- canonicalising the file,
//                              LOWERING counts, REMOVING rows for sites that are gone. It REFUSES
//                              every raise, prints the sites it refused, and exits non-zero: the
//                              tree is still failing and an exit 0 would be a lie.
//   `--write --accept-raises`  additionally records the raises, after printing every site under a
//                              banner naming both remedies. Deliberate, separately spelled, and
//                              legible in the diff.
//
// Removing a stale row is never a silencing, so the cheap command covers the whole MECHANICAL half
// of the coupling -- duplicates, ordering, formatting, rows for deleted tests -- and stops exactly
// where judgement begins.
//
// ANCHOR (Beacon): Dan Linstedt, Data Vault 2.0 -- the census is a satellite (fast-changing
// attributes) over a hub (the audit's rules). A satellite whose only writer is a human memory is
// the change-rate partition done wrong.

import { spawnSync } from "node:child_process";

/** The census artefact: one ordinal-sorted `path -> count` map, plus a provenance note. */
export interface Census {
  readonly note?: string | undefined;
  readonly counts: Record<string, number>;
}

/** The note both audits stamp, so the artefact says which command produced it. */
export function censusNote(script: string): string {
  return `generated by ${script} --emit-census`;
}

/**
 * Canonical bytes for a census.
 *
 * Ordinal key order (UTF-16 code units, which is `Array.prototype.sort`'s default and is what
 * `.claude/rules/culture-invariant-by-default.md` requires -- `localeCompare` would make the same
 * tree emit different files on different machines). The trailing newline is part of the artefact:
 * prettier owns this path and emits one, so omitting it would put the writer and the formatter in
 * a permanent fight.
 */
export function serializeCensus(note: string, counts: Readonly<Record<string, number>>): string {
  const ordered: Record<string, number> = {};
  for (const k of Object.keys(counts).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) ordered[k] = counts[k]!;
  return `${JSON.stringify({ note, counts: ordered }, null, 2)}\n`;
}

/** Tally a list of sites into the `path -> count` shape the census stores. */
export function tally(sites: readonly { readonly path: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of sites) counts[s.path] = (counts[s.path] ?? 0) + 1;
  return counts;
}

/**
 * Is the file on disk the canonical rendering of its own parsed content?
 *
 * THE POINT: `JSON.parse` is lossy on duplicate keys -- it keeps the last and discards the rest
 * without a word. So an audit that only ever reads the PARSED census can never see a duplicated
 * row, which is exactly how one lived on `main` undetected. Round-tripping is the cheapest sound
 * detector: a duplicate cannot survive `parse -> serialize`, so the comparison fails.
 *
 * It is form-only and deliberately so. It says nothing about whether the counts are right; the
 * ratchet still owns that, and this function must never be able to substitute for it.
 */
export function isCanonical(text: string, census: Census): boolean {
  return text === serializeCensus(census.note ?? "", census.counts);
}

export type CensusRead =
  | { readonly ok: true; readonly census: Census; readonly canonical: boolean }
  | { readonly ok: false; readonly error: string };

/** Parse a census, reporting BOTH a parse failure and a non-canonical (e.g. duplicated-key) file. */
export function readCensusText(text: string): CensusRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `not valid JSON: ${String(e)}` };
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: false, error: "top level is not an object" };
  const counts = (parsed as { counts?: unknown }).counts;
  if (typeof counts !== "object" || counts === null)
    return { ok: false, error: "`counts` is missing or not an object" };
  for (const [k, v] of Object.entries(counts)) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
      return { ok: false, error: `counts[${JSON.stringify(k)}] is not a non-negative integer` };
    }
  }
  const note = (parsed as { note?: unknown }).note;
  const census: Census = {
    note: typeof note === "string" ? note : undefined,
    counts: counts as Record<string, number>,
  };
  return { ok: true, census, canonical: isCanonical(text, census) };
}

// ---------------------------------------------------------------------------
// the ratchet
// ---------------------------------------------------------------------------

export interface Drift {
  readonly path: string;
  readonly was: number;
  readonly now: number;
}

const byPath = (a: Drift, b: Drift): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/**
 * The ratchet, in BOTH directions.
 *
 * A count that goes UP is an unadjudicated new site. A count that goes DOWN is a stale row that
 * has stopped constraining anything -- equally a failure, because a census nobody lowers converges
 * on a suppression list. Unchanged is silent.
 */
export function censusDrift(
  was: Readonly<Record<string, number>>,
  now: Readonly<Record<string, number>>,
): { readonly rose: readonly Drift[]; readonly fell: readonly Drift[] } {
  const rose: Drift[] = [];
  const fell: Drift[] = [];
  for (const p of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const a = was[p] ?? 0;
    const b = now[p] ?? 0;
    if (b > a) rose.push({ path: p, was: a, now: b });
    else if (b < a) fell.push({ path: p, was: a, now: b });
  }
  rose.sort(byPath);
  fell.sort(byPath);
  return { rose, fell };
}

/**
 * What `--write` would do, split at the judgement seam.
 *
 * `applied` is everything that carries no judgement: rows lowered, rows removed, and (implicitly,
 * because the whole file is re-serialised) canonicalisation. `refused` is the raises, held back
 * unless `acceptRaises` is set. `next` is the counts to write, which is why a refused raise leaves
 * the OLD value in place: the ratchet must still fire on the next run, or the refusal would have
 * silenced the finding by another door.
 */
export interface WritePlan {
  readonly next: Record<string, number>;
  readonly applied: readonly Drift[];
  readonly refused: readonly Drift[];
  readonly accepted: readonly Drift[];
}

export function planWrite(
  was: Readonly<Record<string, number>>,
  now: Readonly<Record<string, number>>,
  acceptRaises: boolean,
): WritePlan {
  const { rose, fell } = censusDrift(was, now);
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(was)) if (v > 0) next[k] = v;
  for (const d of fell) {
    if (d.now === 0) delete next[d.path];
    else next[d.path] = d.now;
  }
  if (acceptRaises) for (const d of rose) next[d.path] = d.now;
  return {
    next,
    applied: fell,
    refused: acceptRaises ? [] : rose,
    accepted: acceptRaises ? rose : [],
  };
}

// ---------------------------------------------------------------------------
// GitHub annotations
// ---------------------------------------------------------------------------

/**
 * Escape a workflow-command DATA payload. GitHub's own parser requires `%`, CR and LF encoded;
 * without this a multi-line finding is truncated at the first newline, which is the difference
 * between an annotation that names the site and one that names nothing.
 */
function escapeData(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/** Property values additionally need `:` and `,` encoded -- they are the field separators. */
function escapeProp(s: string): string {
  return escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

export interface Annotation {
  readonly file?: string | undefined;
  readonly line?: number | undefined;
  readonly title: string;
  readonly message: string;
}

/**
 * Render one `::error ...::` workflow command.
 *
 * This is what puts the finding in the CHECK-RUN, where `Process completed with exit code 1`
 * currently sits alone. Measured on the three 2026-08-25/26 episodes of this exact check: the only
 * annotation on every one of them was that sentence, and the actual finding
 * (`frost-hsm-secrets.test.ts: R5 count rose 0 -> 3`) was reachable only by opening the log.
 */
export function annotation(a: Annotation): string {
  const props: string[] = [];
  if (a.file !== undefined) props.push(`file=${escapeProp(a.file)}`);
  if (a.line !== undefined) props.push(`line=${String(a.line)}`);
  props.push(`title=${escapeProp(a.title)}`);
  return `::error ${props.join(",")}::${escapeData(a.message)}`;
}

// ---------------------------------------------------------------------------
// self-scoping (the preflight / pre-push half)
// ---------------------------------------------------------------------------

/**
 * The paths whose change can move a census: any file in the scanned corpus, the census artefact
 * itself, and the audit that derives it. `isCorpusPath` is supplied by the caller because the two
 * audits scan different corpora (one is `tests/` F# + repo-wide `*.test.ts`, the other `tests/`
 * only), and duplicating that predicate here would create a second, approximate notion of scope
 * to disagree with the first.
 */
export function corpusTouched(
  changed: readonly string[],
  isCorpusPath: (p: string) => boolean,
  ownPaths: readonly string[],
): readonly string[] {
  const out = new Set<string>();
  for (const raw of changed) {
    const p = raw.trim().replace(/\\/g, "/");
    if (p === "") continue;
    if (isCorpusPath(p) || ownPaths.includes(p)) out.add(p);
  }
  return [...out].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Files changed against `base`, or `undefined` when the base cannot be resolved.
 *
 * `undefined` means CHECK ANYWAY, never SKIP. An unscoped guard that stays silent because it could
 * not work out its scope is the skipped-check-wearing-a-passed-check's-face failure this whole
 * file exists to refuse -- and it is the same decision `build-graph.ts drift-check` makes, for the
 * same reason.
 */
export function changedAgainst(root: string, base: string): readonly string[] | undefined {
  const merge = spawnSync("git", ["merge-base", base, "HEAD"], { cwd: root, encoding: "utf8" });
  if (merge.status !== 0) return undefined;
  const from = merge.stdout.trim();
  if (from === "") return undefined;
  const diff = spawnSync("git", ["diff", "--name-only", from], { cwd: root, encoding: "utf8" });
  if (diff.status !== 0) return undefined;
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  const text = diff.stdout + (untracked.status === 0 ? untracked.stdout : "");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}
