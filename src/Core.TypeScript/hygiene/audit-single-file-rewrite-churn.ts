#!/usr/bin/env bun
// audit-single-file-rewrite-churn.ts -- unbounded growth is permitted only with a stated
// scaling and cost model. Without one it is unfounded, and it will fall over eventually.
//
// WHY THIS FILE EXISTS
// --------------------
// Aaron 2026-09-11, the observation that started it:
//
//   "any time a single file is getting written over and over and over on some cadence
//    that's a huge smell on github where history is forever"
//
// and the shape to prefer:
//
//   "one per event would be best, and they can be in dated folders so we don't end up with
//    too many files in one folder"
//
// Then, widening it, which is why this file's subject is bigger than its name:
//
//   "basically we are trying to track bounded vs unbounded growth per file / folder, and for
//    anything that is unbounded forever that's a huge smell. most things don't need to be
//    kept forever but this is the default of git."
//
//   "anything that is unbounded history, we need a scaling and cost model, or else it's
//    unfounded and will fall over eventually."
//
// A rewritten file is the SYMPTOM this check was commissioned for. The subject is BOUNDED vs
// UNBOUNDED growth, per file AND per directory, and the demand on the unbounded ones is a
// declared model. GIT'S DEFAULT IS UNBOUNDED, which is the whole reason this needs saying:
// "we never thought about it" and "we chose to keep it forever" produce byte-identical
// repositories.
//
// ============================================================================================
// THIS IS AN OPTIMIZATION, NOT A MORAL POSITION -- READ THE WHOLE FILE THAT WAY
// ============================================================================================
// Aaron 2026-09-11, and this frames everything below it:
//
//   "this is an optimization technique. in a perfect world it would be free to store all
//    history, or recalculate it forever. our generator functions over history are trying to
//    compress history like columnar storage but over TIME rather than SPACE -- but even this
//    reaches its limits. some change rates, i'd argue most, require windows only. few are
//    worth storing all bytes for history forever, unless it can't be compressed with high
//    accuracy."
//
// NOTHING HERE IS "WASTE IS BAD". In a perfect world you keep everything. Storage costs and
// recomputation costs are BOTH real, and this register is a record of WHERE WE CHOSE TO PAY.
// A register that reads as disapproval gets argued with; one that reads as a cost decision
// gets used. If a row here feels like an accusation, the row is worded wrong.
//
// The columnar analogy is exact and worth keeping verbatim: columnar storage compresses by
// exploiting similarity WITHIN A COLUMN; a generator over history compresses by exploiting
// similarity ACROSS TIME. Same technique, different axis.
//
// ============================================================================================
// THE DECISION PROCEDURE -- THREE STEPS, IN ORDER
// ============================================================================================
// Aaron 2026-09-11:
//
//   "anything we can come up with a rolling window that is roughly the same cost, that can all
//    stay fast. anything that is genuinely unbounded, we have to spread out over speed/cost
//    based on access methods, and the default being older data is accessed less."
//
//   STEP 1. ROLLING WINDOW AT ROUGHLY CONSTANT COST?
//           If yes -- bound it and stop. Constant cost is the thing tiering was trying to buy.
//           (But see the next section: in git a window bounds the TIP, not the HISTORY.)
//
//   STEP 2. REGENERABLE FROM A GENERATOR AT SUFFICIENT FIDELITY?
//           If yes -- KEEP THE GENERATOR, and window or drop the bytes. THE GENERATOR IS THE
//           COMPRESSION. This is the DBSP / Z-set move the whole repo is built on: the delta
//           stream plus the fold IS the compressed history.
//
//   STEP 3. NEITHER?
//           Genuinely unbounded and incompressible. Tier it BY ACCESS PATTERN -- with AGE AS
//           THE DEFAULT PROXY for access, older accessed less UNLESS MEASURED OTHERWISE -- and
//           price it with the five model fields below.
//
// TIERING IS THE LAST RESORT, NOT THE GOAL. A register that assigns tiers to things that could
// have been bounded, or regenerated, has solved the wrong problem more expensively.
//
//   >> CALIBRATION, AND IT IS A CHECK ON THIS REGISTER'S OWN OUTPUT: STEP 3 SHOULD BE RARE. <<
//
// Aaron's claim is that MOST change rates need windows only, and FEW deserve all bytes forever.
// So if this register fills with step-3 rows, the likeliest explanation is that GENERATORS WERE
// NOT LOOKED FOR -- not that the data is special. Read a long step-3 list as a finding about
// the reviewers, not about the repository. The audit prints that count on every run for exactly
// this reason.
//
// ============================================================================================
// THE SUBTLETY THAT MAKES STEP 1 INCOMPLETE INSIDE GIT
// ============================================================================================
//
//   >> A ROLLING WINDOW BOUNDS THE TIP. IT DOES NOT BOUND THE HISTORY.
//      IN GIT THOSE ARE DIFFERENT THINGS. <<
//
// `data/tick-latest.json` is the proof, measured here 2026-09-11: **251 bytes at tip** -- a
// window of size one, perfectly bounded -- and **1091 versions**. Bounded at tip, unbounded in
// history. Rewriting a small file forever is not a bounded design in a substrate that keeps
// every version; it is an unbounded one wearing a small file's clothes, and it is the worst
// shape for delta compression because each write REPLACES rather than appends.
//
//   rolling window + a FORGETTING substrate  ->  constant cost, stays fast     OK
//   rolling window + git                     ->  STILL UNBOUNDED IN HISTORY    tick-latest.json
//
// So inside git, "make it a rolling window" is NOT a complete answer. It must be paired with
// either a colder tier or a substrate that drops old versions -- which is exactly the gap
// `zetadb`/`zetafs` bounded history is meant to close. That is the difference between a fix
// and a fix-shaped gesture, and it is why every row here carries TIP and HISTORY as SEPARATE
// verdicts rather than one.
//
// The two paths that motivated this check are both unbounded-in-history for DIFFERENT reasons
// and want DIFFERENT answers, which is the clearest argument for the split columns:
//
//   data/tick-latest.json                      251 B at tip, 1091 versions
//       -> wants a forgetting substrate, or a colder tier. Retiring it is not the question.
//   docs/hygiene-history/loop-tick-history.md  648 KB at tip, 86 versions, dead 3 months
//       -> wanted retirement, and got it: frozen 2026-04-30, kept because 191 of its 212 rows
//          exist nowhere else (measured; see its own header).
//
// ============================================================================================
// THE ORGANISING FRAME -- DV2.0 WITH RECURSIVE SATELLITES; DEPTH *IS* THE TIER
// ============================================================================================
// Aaron 2026-09-11:
//
//   "yes this comes back to data vault 2.0, but with a twist where sats can have sats can have
//    sats etc... each one is slower than the next."
//
// DV2.0 as already carved in `.claude/rules/dv2-data-split-discipline-activated.md` partitions
// substrate by CHANGE RATE: hubs (stable keys), links (relationships), satellites
// (fast-changing attributes). The twist is that a satellite can itself have satellites, and
// each level down is COLDER AND SLOWER than the one above. The storage hierarchy is not a
// second mechanism bolted on; it IS DV2.0 applied recursively, so
//
//   >> DEPTH IN THE SATELLITE CHAIN IS THE TIER. <<
//
// which makes the `satelliteChain` field DERIVABLE rather than a number somebody picked.
//
// THIS IS NOT A NEW DEMAND ON ANYONE. DV2.0 is one of the seven always-active disciplines, and
// manifesto §9 (recursive -- same rules at every scale) and §10 (self-similar -- shape stays
// recognisable at every magnification) already require exactly this shape. A reviewer who
// accepts DV2.0 has already accepted this. Cite those, not first principles.
//
// AND THE REPO HAS BEEN BUILDING RECURSIVE SATELLITES FOR MONTHS WITHOUT NAMING THE RECURSION:
//
//   memory/MEMORY.md (hub, ~1.5 KB target, always loaded)
//       -> INDEX.md (satellite)
//       -> ~897 topic files (satellites of the satellite)                        3 levels
//
//   docs/SEED-VOCABULARY.md (cold-boot kernel)
//       -> docs/GLOSSARY.md (~13.6k tokens, on demand)
//       -> docs/research/* (satellite of the satellite)                          3 levels
//
//   .claude/rules/ (resident)
//       -> .claude/rules.bak/ (archived; the #6676 sweep was an explicit
//          cold-start-token reduction)
//       -> the docs each carved sentence points at                               3 levels
//
//   docs/github/prs/shards/ (key + metadata, small, bucketed)
//       -> docs/history/pr-reviews/ (the record, ~1.5 KB on disk each)
//       -> [ NOT BUILT: the full diff/comment payload, which is the thing that
//            should live coldest ]                                               2 of 3
//
// THE REPO TIERS ATTENTION RIGOROUSLY AND HAS NEVER TIERED STORAGE. Naming that asymmetry is
// this file's contribution: it makes the storage rule an EXTENSION of a discipline already
// accepted here rather than a new ask.
//
// WHERE NO CHAIN EXISTS, THE ABSENCE IS THE FINDING. An unbounded path with no satellite
// structure has NOWHERE TO DEMOTE TO, which is a sharper statement of "unfounded" than the
// word itself.
//
// HONEST CAVEAT ON THE MAPPING, because it is a proxy and not an identity: DV2.0 partitions by
// CHANGE rate; the tiering argument is about ACCESS rate. They correlate -- hot data tends to
// change and be read, cold data neither -- but they come apart: a rarely-changing config read
// on every boot is a slow-changing satellite that must stay HOT. So DEPTH IS THE DEFAULT PROXY
// FOR TIER exactly as AGE IS THE DEFAULT PROXY FOR ACCESS, and measured access beats both.
//
// ============================================================================================
// GIT IS AN EXPENSIVE HOT TIER BEING USED FOR COLD DATA
// ============================================================================================
// Aaron 2026-09-11:
//
//   "most things that need to be kept forever we need to think of like L1, L2, L3 cache,
//    L4 memory, L5 hdd/ssd, L6 distributed db, L7 s3-like storage, etc. this is not exact at
//    all, just an example of older = slower/cheaper storage. anything unbounded we need to
//    think of like this for economic reasons."
//
// The ladder is illustrative and he says so; the load-bearing half is OLDER = SLOWER AND
// CHEAPER. Something must get colder with age, because that is what makes "keep it forever"
// economically survivable.
//
// Every clone pays for every byte of history, on every machine, forever. Putting a
// 14,379-file archive corpus in git is putting archival data in the MOST-REPLICATED TIER
// AVAILABLE. That is the economic error -- not the file count. It also explains why splitting
// into multiple repos is a TIERING move rather than a tidying one (a separate repo is a colder
// tier, cloned only by whoever needs it), and why "some files can be overwritten without
// saving history" is demotion to a tier with no history at all.
//
// ============================================================================================
// THE TEST -- REGENERABLE? THE GENERATOR *IS* THE COMPRESSION
// ============================================================================================
//
//   >> Can this history be REGENERATED from a generator at acceptable fidelity?
//      If YES, keep the generator and window the bytes -- the generator IS the compression.
//      If NO, the bytes ARE the information, and that is what earns keeping them. <<
//
// This replaces an earlier phrasing of the same idea ("does this history answer a question
// nothing else can"), which was a judgement call where this is mechanical.
//
// IT IS ALREADY CARVED HERE. `.claude/rules/only-the-irreducible-is-primitive-generate-the-
// rest.md`: THE GENERATOR IS THE ERROR-CORRECTING CODE -- generation and correction are dual,
// and regenerating from the irreducible IS the correction. `derive-pr-manifest.ts` says the
// same thing in its own header: "regenerating must reproduce the checked-in content, so the
// generator IS the error-correcting code."
//
// THE WORKED EXAMPLE, AND IT IS THE ONE THAT MOTIVATED THIS CHECK. `docs/github/prs/
// manifest.jsonl` was fully derivable from the shard ledger, so its 433 committed versions
// were pure cost carrying no information. That is precisely why retiring it in PR #17279 lost
// nothing -- and why KEEPING `derive-pr-manifest.ts` was the right half to keep. Deleting the
// bytes and deleting the generator are completely different acts; only the first was done.
//
// FIDELITY IS A FIELD, NOT A YES/NO. Aaron says "high accuracy", not "exact", and the
// difference is load-bearing: a generator reproducing 99% of a telemetry series is fine for
// telemetry and unacceptable for a dependency lock. So a row records WHAT FIDELITY THE
// GENERATOR ACHIEVES (`generator`) and WHAT FIDELITY THE PURPOSE NEEDS (`fidelityNeeded`), and
// THE GAP BETWEEN THEM IS THE ARGUMENT FOR KEEPING BYTES. A row whose two fidelity fields match
// is a row whose bytes are not earning their keep.
//
// AND THE LIMIT, WHICH IS AARON'S OWN AND BELONGS IN THE SAME ROW RATHER THAN IN A FOOTNOTE:
// "even this reaches its limits." Generator-compression is NOT free. The generator must be
// KEPT, RUN, and VERIFIED, and A GENERATOR NOBODY RUNS IS A CHECK THAT DID NOT RUN WEARING A
// COMPRESSION ALGORITHM'S CLOTHES. `manifest.jsonl` is the proof of that too: its deriver was
// paused with the 2026-08-29 cadence batch, the file rotted, and the gate that would have said
// so was paused alongside it. So the `generator` field must name the generator's upkeep cost,
// not merely its existence.
//
// AND THE LOCK CASE IS NOT MERELY PERMITTED -- IT IS REQUIRED BY A CARVED RULE.
// `.claude/rules/clone-at-tag-stays-sufficient.md` demands the repo stay buildable and
// checkable from `git clone` at a pinned tag WITH NO PACKAGE MANAGER PRESENT. That is only
// true if the dependency closure is committed AT THAT TAG. Stripping a lock file's versioned
// history would break a rule this repo already holds. Cite that rule, not taste, when a lock
// row is questioned. It is also the one row with NO `liftsWhen` -- and it still needs a cost
// model. "Its history is the product" justifies keeping it; it does not exempt it from being
// priced.
//
// ============================================================================================
// A SCALING AND COST MODEL: FIVE FIELDS, NOT PROSE
// ============================================================================================
// Every row whose HISTORY is unbounded must state:
//
//   1. rate            -- growth per day or per event, MEASURED, not estimated.
//   2. costPerUnit     -- bytes and/or files per unit of growth. Use `--cost`.
//   3. breaksFirst     -- what fails first, and roughly when: clone time, a directory listing,
//                         a tree walk, a lint scan.
//   4. generator       -- STEP 2. The generator that can reproduce this history and the FIDELITY
//                         it achieves, PLUS the generator's own upkeep cost (kept, run,
//                         verified). `none -- <why>` is legal and marks the row STEP 3.
//   5. fidelityNeeded  -- what fidelity this data's PURPOSE requires. The gap between this and
//                         `generator` is the argument for keeping bytes; no gap means the bytes
//                         are not earning their keep.
//   6. satelliteChain  -- the DV2.0 chain this path sits in, and at what depth. This is the
//                         tier. "none --" is a legal and very loud answer.
//   7. demotionPlan    -- what moves colder, at what age, and what stays hot.
//
// A row that cannot state them is NOT exempt. It is UNFOUNDED, and that is the finding. Write
// `UNKNOWN -- <what you tried>` and the register reports it, loudly, on every run. "I do not
// know the growth rate" IS the report, and it is worth more than a confident guess.
//
// ============================================================================================
// CANONICAL ORDERING -- WHAT MAKES A LEGITIMATE EXCEPTION AFFORDABLE
// ============================================================================================
// Aaron 2026-09-11:
//
//   "our canonical ordering should have a sort algo attached, or else be first-in-wins.
//    first-in-wins should also try to have a stable sort order too."
//
// Generalised: AN ACCUMULATING FILE MUST DECLARE ITS ORDER. Two legitimate declarations, no
// third:
//
//   1. A NAMED COMPARATOR -- the file states which sort produces it, and regenerating with that
//      comparator reproduces the bytes.
//   2. FIRST-IN-WINS (insertion order) -- append-only, nothing reordered on write.
//
// And the half people skip: FIRST-IN-WINS IS ONLY STABLE IF ITS INPUT SEQUENCE IS. Insertion
// order inherits the determinism of whatever produced the insertions. A parallel fan-out, a
// `readdir()`, or `Object.keys()` iteration gives a different order per run or per machine, so
// a file that LOOKS append-only still produces a near-full-blob diff.
//
// AN UNDECLARED ORDER IS THE ACTUAL DEFECT, because it varies silently by runtime. Same
// failure `.claude/rules/culture-invariant-by-default.md` already names for strings -- a sort
// that varies by locale -- one level up, applied to file generation.
//
// THE REPO SOLVED THIS THREE TIMES AD HOC AND NEVER NAMED THE RULE. Naming it once, here, is
// the point. DO NOT BUILD A FOURTH SORTING LINT:
//
//   - `src/Core.TypeScript/ace/build-graph.ts` -- the ace dependency graph, the very file named
//     as the legitimate exception, already sorts with `ordinalCompare` at five sites. The
//     exception already complies: it is affordable BECAUSE it is canonically ordered.
//   - `src/Core.TypeScript/hygiene/sort-tick-history-canonical.ts` +
//     `check-tick-history-order.ts` -- `data/tick-history.json`, the worst churn offender
//     measured, is already canonically ordered AND checked.
//   - `src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.ts` -- the
//     `localeCompare` class.
//
// CANONICAL ORDERING DOES NOT REDUCE REWRITE COUNT. IT REDUCES THE SIZE OF EACH REWRITE. And
// the effect is enormous -- measured here 2026-09-11, on-disk sum over every distinct blob a
// path has ever had, against the sum of the same blobs' uncompressed sizes:
//
//   path                                   versions   raw       ON-DISK   ratio   per version
//   data/tick-history.json  (sorted appends)   1090   198.5 MB   241 KB    805x       226 B
//   docs/BACKLOG.md         (sorted, derived)   796   152.4 MB   966 KB    154x      1.24 KB
//   ace/build-graph.json    (ordinalCompare)     48     4.0 MB    27 KB    144x       583 B
//   memory/MEMORY.md        (hand-edited)       694   150.2 MB  1.06 MB    138x      1.57 KB
//   bun.lock                                     26     2.0 MB    72 KB     27x      2.80 KB
//   data/tick-latest.json   (full replace)     1089   264.0 KB    50 KB      5x        47 B
//
// 805x for canonically ordered appends against 27x for bun.lock is the whole argument, in one
// table. It also shows why COUNT ALONE MISLEADS IN BOTH DIRECTIONS: tick-history.json has the
// most versions in the repo and costs 241 KB, while bun.lock has 26 versions and costs 72 KB.
//
// AND A NOTE AGAINST DRAMATISING tick-latest.json: 1091 versions of a 251-byte pointer cost
// about 50 KB on disk in total. It is CHEAP IN BYTES and still the canonical wrong shape --
// because 1091 versions of a pointer answer no question, and because the pattern scales badly
// the moment the pointer stops being 251 bytes. The sin is the shape, not the bill. Saying
// otherwise here would be the same overstatement this file spends a section warning about.
//
// ============================================================================================
// IN-TREE PRIOR ART FOR A RETENTION POLICY -- SHAPE, NOT COVERAGE
// ============================================================================================
// `src/Core/SoftEmu.fs` carries `SoftPrunePolicy` / `SoftPruneFeedback` / `SoftPruneReport`: a
// bounded-growth policy with a TYPED choice between `NoForgetBackpressure` (refuse to exceed
// the budget, return typed backpressure, leave the caller's state untouched) and
// `KeepHighestWeight` (lossy by design, but EMITS THE DROPPED TAIL so the forgetting is loud).
// It bounds an ensemble width, not file history, so it is not reusable here -- but it is
// exactly the shape a retention policy should take, and it is in-tree rather than a proposal.
//
// `src/Core/ZetaFsPolicy.fs` carries the file-shaped version:
// `HistoryPolicy.Rolling of maxVersions * maxPhaseSpan * maxBytes`, volume default
// `maxVersions = 32`, decided in `ZetaFsFreeze.fs`, collected by the budgeted reclaim ferry in
// `ZetaFsReclaim.fs`. Its own source notes the caps are "named and unmetered" beyond
// `maxVersions`. `src/Core.TypeScript/zetadb/retention-policy.ts` carries the event-log version
// (event-count and checkpoint-byte limits, with `displacedEventIds` receipts so displacement is
// observable rather than silent).
//
// BOUNDED HISTORY FOR THIS REPO'S OWN FILES IS A DESIGN GOAL, NOT ENFORCED. Those mechanisms
// bound ZetaFs volumes and ZetaDb journals. NOTHING bounds a path in THIS git repository, and
// this check does not change that. Do not read the citations as coverage.
//
// ============================================================================================
// EVERY ROW CARRIES A `liftsWhen`, AND IT IS MANDATORY IN BOTH DIRECTIONS
// ============================================================================================
// Either an exit condition, or an explicit `none -- <why>`. Which one it is must be obvious at
// a glance, because two rows with the same shape and different permanence is exactly how an
// allowlist stops meaning anything. A row that says "forced, permanently" with no reasoning is
// where an exemption goes to die quietly, and where the next person learns that arguing is
// enough. A row that names its exit stays a DEBT somebody can check.
//
// ============================================================================================
// HOW THE COUNT IS TAKEN, AND WHY IT DISAGREES WITH HAND MEASUREMENTS
// ============================================================================================
// Counts come from ONE `git log --name-only HEAD` walk. No network. No refs beyond the commit
// graph reachable from the checked-out tip, so the verdict is a function of the repository.
//
// NOT `--all`, deliberately: `git log --all` includes whatever refs THIS CLONE happens to have
// fetched, so its answer differs per machine. Measured 2026-09-11, the gap is large and uneven:
//
//   docs/hygiene-history/loop-tick-history.md   HEAD  86   --all  703
//   memory/MEMORY.md                            HEAD 696   --all  941
//   docs/BACKLOG.md                             HEAD 800   --all 1227
//   src/Core.TypeScript/ace/build-graph.json    HEAD  49   --all   62
//
// So numbers quoted from `--all` elsewhere will not match this check, and this check is the
// reproducible one. `--follow` was also measured and changed nothing on these paths.
//
// ============================================================================================
// THE HONEST LIMITS -- ALL FIVE
// ============================================================================================
// 1. COUNT IS A PROXY FOR COST, AND A BAD ONE. See the 805x-vs-27x table above: an append-mostly
//    file delta-compresses beautifully, a full-rewrite snapshot does not. Count overstates some
//    paths and understates others. Use `--cost` when the number matters.
//
// 2. COUNT ANSWERS "HOW OFTEN", SIZE ANSWERS "HOW MUCH", AND NEITHER ANSWERS WHETHER IT IS
//    BOUNDED. Boundedness is a property of the WRITER, and no amount of history inspection
//    reveals it. This check measures growth and demands a declared model; it CANNOT verify
//    that a claimed bound is real.
//
// 3. IT CANNOT VERIFY A DEMOTION PLAN EITHER. It checks that `satelliteChain` and
//    `demotionPlan` are present and non-empty. Whether demotion HAPPENS is a property of a
//    process running elsewhere, and a declared plan nobody executes is precisely the shape this
//    repo calls a check that did not run. Prefer a `liftsWhen` naming the mechanism that would
//    make demotion OBSERVABLE over an unverifiable promise.
//
// 4. `--cost` MEASURES THIS CLONE'S PACKING. `%(objectsize:disk)` reflects how git happened to
//    pack these objects here; `git gc --aggressive` changes it. It measures a repository
//    instance, not a repository invariant. It is still the right number -- see limit 5.
//
// 5. NEVER QUOTE AN UNCOMPRESSED BLOB-SUM AS REPO SIZE. It was nearly done here once. The RAW
//    column above overstates by 5x to 805x depending on the path. Summing `%(objectsize)` over
//    a path's history is not repo growth and quoting it as such misleads by up to three orders
//    of magnitude.
//
// ============================================================================================
// WHAT FAILS, AND WHAT ONLY REPORTS
// ============================================================================================
// FAILS (exit 1):
//   - a register row whose measured value EXCEEDS its `ceiling` -- the ratchet;
//   - a malformed row (missing field, short reason, bad `ceiling`);
//   - a liveness floor breach. An empty walk is not a pass.
//
// REPORTS (exit 0):
//   - hot paths absent from the register, ranked. Findings, not verdicts. Several belong to
//     cadence lanes deliberately paused 2026-08-29 pending a redesign gated on hardware, and
//     redesigning those lanes is not this check's business.
//   - BOUNDED-AT-TIP, UNBOUNDED-IN-HISTORY rows -- the `tick-latest.json` class. A rolling
//     window that git still keeps every version of.
//   - UNFOUNDED rows -- history unbounded, model absent. Permitted to exist, visible every run.
//     This category BEING VISIBLE is the point.
//   - RETIRED rows -- a row naming a path that no longer exists. Retirement is the desired end
//     state, so failing on it would punish the success. Delete the row.
//   - OVER-PROVISIONED ceilings -- constraining nothing.
//
// DRIFT TIER. NOT wired into `gate (required)`: a live surface like `memory/MEMORY.md` would
// trip the ratchet on an ordinary day's work, and a check that blocks main for doing the
// expected thing gets disabled rather than obeyed.
//
// A SEEDED CEILING IS TIGHT ON PURPOSE. Most rows here are pinned at the count measured on
// 2026-09-11, so the FIRST crossing is the signal. Re-pinning costs one line plus a re-measured
// rate, and that re-measurement is the thing the ratchet is actually buying.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-single-file-rewrite-churn.ts [--root <dir>]
//        [--json] [--top N] [--report-threshold N] [--cost <path>...]
//
// Exit 0 = every register row is well-formed and inside its ceiling. Exit 1 = one is not.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { stringCompare } from "../collation/collation";

export const REGISTER_PATH = "registry/unbounded-growth-register.json";

export const RULE_ANCHORS = [
  ".claude/rules/dv2-data-split-discipline-activated.md (#5 DV2.0 -- recursive satellites ARE the tiers)",
  ".claude/rules/clone-at-tag-stays-sufficient.md (a lock file's history is load-bearing)",
  ".claude/rules/culture-invariant-by-default.md (an undeclared order varies silently)",
  ".claude/rules/manifesto-13-specifications.md (§9 recursive, §10 self-similar)",
] as const;

/** Default reporting threshold, in commits that touched the path. */
export const DEFAULT_REPORT_THRESHOLD = 100;

/** A history walk that finds fewer commits than this did not run. */
export const MIN_COMMITS_FOR_LIVENESS = 1000;

/** Directories whose contents are not ours to police. */
const EXCLUDED_PREFIXES = ["node_modules/", "references/"] as const;

// -- the register -----------------------------------------------------------------------

export type GrowthKind = "file" | "directory";
export type GrowthClass = "bounded" | "unbounded";

/**
 * TIP and HISTORY are separate verdicts on purpose. A rolling window bounds the tip and leaves
 * git's history unbounded -- `data/tick-latest.json` is 251 bytes at tip across 1091 versions.
 * Collapsing them into one field is what lets a fix-shaped gesture pass for a fix.
 */
export interface RegisterRow {
  readonly path: string;
  readonly kind: GrowthKind;
  readonly tip: GrowthClass;
  /** Required when `tip` is "bounded": the mechanism that caps the working-tree size. */
  readonly tipBoundedBy: string | null;
  readonly history: GrowthClass;
  /** Required when `history` is "bounded": what stopped it accumulating versions. */
  readonly historyBoundedBy: string | null;
  /** The model fields. Required when `history` is "unbounded". `UNKNOWN -- ...` is legal. */
  readonly rate: string | null;
  readonly costPerUnit: string | null;
  readonly breaksFirst: string | null;
  /** STEP 2: the generator + the fidelity it achieves + its own upkeep cost, or `none -- ...`. */
  readonly generator: string | null;
  /** What fidelity this data's purpose requires. The gap vs `generator` justifies the bytes. */
  readonly fidelityNeeded: string | null;
  readonly satelliteChain: string | null;
  readonly demotionPlan: string | null;
  /** The ratchet: commits touching the file, or files under the directory. */
  readonly ceiling: number;
  /** An exit condition, or `none -- <why>`. Never absent. */
  readonly liftsWhen: string;
  readonly reason: string;
}

/** A model field beginning with UNKNOWN is a declared gap, not a model. */
export function isUnknown(field: string | null): boolean {
  return field === null || field.trimStart().startsWith("UNKNOWN");
}

/**
 * UNFOUNDED: history unbounded AND at least one model field missing. Permitted to exist,
 * reported every run, carrying no exit. A history-bounded row is never unfounded -- its bound
 * is its model.
 */
export function isUnfounded(row: RegisterRow): boolean {
  if (row.history === "bounded") return false;
  return [
    row.rate,
    row.costPerUnit,
    row.breaksFirst,
    row.generator,
    row.fidelityNeeded,
    row.satelliteChain,
    row.demotionPlan,
  ].some(isUnknown);
}

/**
 * STEP 3 of the decision procedure: unbounded, and no generator can reproduce it. These are the
 * rows that genuinely earn their bytes -- and Aaron's calibration says they should be RARE. A
 * long step-3 list is evidence that generators were not looked for.
 */
export function isStepThree(row: RegisterRow): boolean {
  return row.history === "unbounded" && (row.generator ?? "").trimStart().toLowerCase().startsWith("none");
}

/** The `tick-latest.json` class: a rolling window that git still keeps every version of. */
export function isBoundedTipUnboundedHistory(row: RegisterRow): boolean {
  return row.tip === "bounded" && row.history === "unbounded";
}

function requireString(v: unknown, where: string, minLen: number): string {
  if (typeof v !== "string" || v.trim().length < minLen) {
    throw new Error(`${where}: must be a string of at least ${minLen} characters`);
  }
  return v;
}

export function validateRegister(parsed: unknown): RegisterRow[] {
  if (!Array.isArray(parsed)) throw new Error(`${REGISTER_PATH} must be a JSON array`);
  const seen = new Set<string>();
  return parsed.map((raw, i): RegisterRow => {
    const r = raw as Record<string, unknown>;
    const at = `${REGISTER_PATH}[${i}]`;
    const path = requireString(r["path"], `${at}: 'path'`, 1);
    if (seen.has(path)) throw new Error(`${at}: duplicate row for '${path}' -- one row per path`);
    seen.add(path);
    const where = `${at} (${path})`;

    const kind = r["kind"];
    if (kind !== "file" && kind !== "directory") throw new Error(`${where}: 'kind' must be "file" or "directory"`);

    // TIP and HISTORY are narrowed one at a time rather than in a loop, because a loop cannot
    // narrow two separate bindings -- and they must stay separate bindings: collapsing them is
    // the exact mistake that lets a rolling window inside git read as "bounded".
    const growthClassOf = (v: unknown, name: string): GrowthClass => {
      if (v === "bounded" || v === "unbounded") return v;
      throw new Error(
        `${where}: '${name}' must be "bounded" or "unbounded". These are SEPARATE verdicts -- a ` +
          `rolling window bounds the tip and leaves git's history unbounded.`,
      );
    };
    const tip = growthClassOf(r["tip"], "tip");
    const history = growthClassOf(r["history"], "history");

    const ceiling = r["ceiling"];
    if (typeof ceiling !== "number" || !Number.isInteger(ceiling) || ceiling < 1) {
      throw new Error(`${where}: 'ceiling' must be a positive integer -- the ratchet needs a number to cross`);
    }

    // A row with no reason is a row nobody can refuse. 40 characters is a floor, not a bar.
    const reason = requireString(
      r["reason"],
      `${where}: 'reason' must say WHY this path grows the way it does, in at least 40 characters. ` +
        `An unreasoned row is an escape hatch`,
      40,
    );

    const liftsWhen = requireString(
      r["liftsWhen"],
      `${where}: 'liftsWhen' must name an exit condition, or begin with "none --" and say why there ` +
        `is none. A row with no stated permanence stops being checkable`,
      20,
    );
    if (liftsWhen.trimStart().toLowerCase().startsWith("none") && !liftsWhen.includes("--")) {
      throw new Error(`${where}: 'liftsWhen' of "none" must be written "none -- <why there is no exit>"`);
    }

    const tipBoundedBy =
      tip === "bounded"
        ? requireString(
            r["tipBoundedBy"],
            `${where}: a tip-bounded row must name the MECHANISM capping the working-tree size ` +
              `(a rolling window, a retention policy, a natural ceiling), in at least 20 characters`,
            20,
          )
        : null;

    const historyBoundedBy =
      history === "bounded"
        ? requireString(
            r["historyBoundedBy"],
            `${where}: a history-bounded row must say what STOPPED it accumulating versions ` +
              `(retired, frozen, moved to a forgetting substrate), in at least 20 characters`,
            20,
          )
        : null;

    let rate: string | null = null;
    let costPerUnit: string | null = null;
    let breaksFirst: string | null = null;
    let generator: string | null = null;
    let fidelityNeeded: string | null = null;
    let satelliteChain: string | null = null;
    let demotionPlan: string | null = null;

    if (history === "unbounded") {
      const m = `${where}: history is unbounded, so it needs a scaling and cost model. `;
      rate = requireString(r["rate"], `${m}'rate' (per day or per event, MEASURED) -- or "UNKNOWN -- <what you tried>"`, 5);
      costPerUnit = requireString(r["costPerUnit"], `${m}'costPerUnit' (bytes and/or files; use --cost) -- or "UNKNOWN -- ..."`, 5);
      breaksFirst = requireString(r["breaksFirst"], `${m}'breaksFirst' (what fails first, roughly when) -- or "UNKNOWN -- ..."`, 5);
      generator = requireString(
        r["generator"],
        `${m}'generator' -- STEP 2 of the decision procedure. Name the generator that can reproduce ` +
          `this history, THE FIDELITY IT ACHIEVES, and its own upkeep cost (a generator nobody runs ` +
          `is a check that did not run). "none -- <why none exists>" is legal and marks the row ` +
          `STEP 3, which should be rare`,
        5,
      );
      fidelityNeeded = requireString(
        r["fidelityNeeded"],
        `${m}'fidelityNeeded' -- what fidelity this data's PURPOSE requires. 99% is fine for ` +
          `telemetry and unacceptable for a dependency lock. The gap between this and 'generator' ` +
          `is the argument for keeping the bytes`,
        5,
      );
      satelliteChain = requireString(
        r["satelliteChain"],
        `${m}'satelliteChain' -- the DV2.0 chain this sits in and at what depth; depth IS the tier. ` +
          `"none -- ..." is legal and very loud: an unbounded path with no satellite structure has ` +
          `nowhere to demote TO`,
        5,
      );
      demotionPlan = requireString(
        r["demotionPlan"],
        `${m}'demotionPlan' (what moves colder, at what age, what stays hot) -- or "UNKNOWN -- ...". ` +
          `Unbounded and never demoted is the unfounded case`,
        5,
      );
    }

    return {
      path, kind, tip, tipBoundedBy, history, historyBoundedBy,
      rate, costPerUnit, breaksFirst, generator, fidelityNeeded, satelliteChain, demotionPlan,
      ceiling, liftsWhen, reason,
    };
  });
}

export function loadRegister(root: string): RegisterRow[] {
  const p = join(root, REGISTER_PATH);
  // READ, THEN INTERPRET ENOENT. `existsSync` gating `readFileSync` leaves a
  // window the answer is already stale in, and the read reports absence itself --
  // the refusal below is identical, one syscall earlier. An audit that lectures
  // other files about check-then-use had better not open with one.
  let text: string;
  try {
    text = readFileSync(p, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${REGISTER_PATH} is missing -- this audit refuses to pass with no register to check against`);
    }
    throw err;
  }
  return validateRegister(JSON.parse(text) as unknown);
}

// -- the history walk -------------------------------------------------------------------

export interface PathStat {
  readonly path: string;
  /** Commits touching this path, reachable from HEAD. */
  readonly touches: number;
  readonly first: string;
  readonly last: string;
}

export interface HistoryStats {
  readonly commits: number;
  readonly paths: Map<string, PathStat>;
}

/**
 * Parse `git log --pretty=format:"C %H %ad" --date=short --name-only` output.
 *
 * Pure, so the audit can be proven to fire on synthetic history with no repository. Git emits
 * newest-first, which is why `last` is captured on first sight and `first` on every sight.
 */
export function parseHistory(raw: string): HistoryStats {
  const paths = new Map<string, { touches: number; first: string; last: string }>();
  let commits = 0;
  let date = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("C ")) {
      date = line.split(" ")[2] ?? "";
      commits += 1;
      continue;
    }
    if (line.length === 0) continue;
    if (EXCLUDED_PREFIXES.some((pre) => line.startsWith(pre))) continue;
    const seen = paths.get(line);
    if (seen === undefined) paths.set(line, { touches: 1, first: date, last: date });
    else {
      seen.touches += 1;
      seen.first = date; // newest-first, so the LAST sighting carries the earliest date
    }
  }
  const out = new Map<string, PathStat>();
  for (const [path, v] of paths) out.set(path, { path, touches: v.touches, first: v.first, last: v.last });
  return { commits, paths: out };
}

export function readHistory(root: string): HistoryStats {
  return parseHistory(
    execFileSync("git", ["log", "--pretty=format:C %H %ad", "--date=short", "--name-only", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
    }),
  );
}

export function trackedPaths(root: string): Set<string> {
  const out = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  return new Set(out.split("\n").filter((p) => p.length > 0));
}

// -- measurement per register row -------------------------------------------------------

export interface Measured {
  readonly row: RegisterRow;
  /** Touches for a file row; live file count for a directory row. */
  readonly actual: number;
  readonly present: boolean;
  /** Distinct paths ever seen under a directory prefix (0 for files). */
  readonly everSeen: number;
}

function normalisePrefix(p: string): string {
  return p.endsWith("/") ? p : `${p}/`;
}

export function measure(row: RegisterRow, history: HistoryStats, tracked: Set<string>): Measured {
  if (row.kind === "file") {
    return { row, actual: history.paths.get(row.path)?.touches ?? 0, present: tracked.has(row.path), everSeen: 0 };
  }
  const prefix = normalisePrefix(row.path);
  let live = 0;
  for (const p of tracked) if (p.startsWith(prefix)) live += 1;
  let ever = 0;
  for (const p of history.paths.keys()) if (p.startsWith(prefix)) ever += 1;
  return { row, actual: live, present: live > 0, everSeen: ever };
}

// -- the audit --------------------------------------------------------------------------

export interface AuditResult {
  readonly commits: number;
  readonly trackedCount: number;
  readonly measured: Measured[];
  /** Ceiling breaches -- these fail. */
  readonly failures: string[];
  /** Everything else -- these report. */
  readonly windowInsideGit: string[];
  readonly stepThree: string[];
  readonly unfounded: string[];
  readonly retired: string[];
  readonly overProvisioned: string[];
  readonly unregisteredHotPaths: PathStat[];
}

export function audit(
  history: HistoryStats,
  register: readonly RegisterRow[],
  tracked: Set<string>,
  reportThreshold: number,
): AuditResult {
  const measured = register.map((row) => measure(row, history, tracked));

  const failures: string[] = [];
  const windowInsideGit: string[] = [];
  const stepThree: string[] = [];
  const unfounded: string[] = [];
  const retired: string[] = [];
  const overProvisioned: string[] = [];

  for (const m of measured) {
    const unit = m.row.kind === "file" ? "commit(s) touching it" : "file(s) under it";

    if (!m.present) {
      // Retirement is the GOAL. Failing on it would punish the success -- the "RETIRED is not
      // DRIFTED" distinction PR #17279 had to teach a gate after the fact.
      retired.push(
        `${m.row.path}: RETIRED -- the register names a path no longer in the tree. That is the ` +
          `desired end state, not a failure. Delete the row; its history is unchangeable now and ` +
          `no ceiling can constrain it.`,
      );
      continue;
    }

    if (m.actual > m.row.ceiling) {
      failures.push(
        `${m.row.path}: ${m.actual} ${unit}; the register pins a ceiling of ${m.row.ceiling}.\n` +
          `    This path crossed a bound somebody consciously set. Two honest moves, in this order:\n` +
          `      1 BOUND IT -- a rolling window at roughly constant cost, one file per event in\n` +
          `        dated folders, or a retention policy. Bounding beats everything below it.\n` +
          `      2 REGENERATE IT -- if a generator reproduces it at sufficient fidelity, keep the\n` +
          `        generator and window the bytes. The generator IS the compression.\n` +
          `      3 TIER IT -- genuinely unbounded and incompressible: spread it by access pattern\n` +
          `        (age is the default proxy); deepen 'satelliteChain' and 'demotionPlan'.\n` +
          `    Failing both, raise the ceiling WITH a re-measured model a reviewer can refuse.\n` +
          `    Raising it silently is the move this register exists to make visible.\n` +
          `    tip=${m.row.tip} history=${m.row.history} | rate=${m.row.rate ?? m.row.historyBoundedBy ?? "-"}\n` +
          `    satelliteChain: ${m.row.satelliteChain ?? "-"}\n` +
          `    liftsWhen: ${m.row.liftsWhen}`,
      );
    } else if (m.row.ceiling > m.actual * 4 && m.actual > 0) {
      overProvisioned.push(
        `${m.row.path}: ceiling ${m.row.ceiling} vs actual ${m.actual} -- more than 4x headroom, so the ` +
          `ratchet constrains nothing. Lower it to something this path could plausibly cross.`,
      );
    }

    if (isBoundedTipUnboundedHistory(m.row)) {
      windowInsideGit.push(
        `${m.row.path}: BOUNDED AT TIP, UNBOUNDED IN HISTORY -- ${m.actual} ${unit}. A rolling window ` +
          `inside git is not a bounded design: git keeps every version, so the window bounds the ` +
          `working tree and nothing else. Pair it with a colder tier or a forgetting substrate.\n` +
          `      tip bounded by: ${m.row.tipBoundedBy ?? "-"}\n` +
          `      liftsWhen: ${m.row.liftsWhen}`,
      );
    }

    if (isStepThree(m.row)) {
      stepThree.push(
        `${m.row.path}: STEP 3 -- unbounded and no generator reproduces it, so the bytes ARE the ` +
          `information.\n      fidelity needed: ${m.row.fidelityNeeded ?? "-"}\n` +
          `      generator:       ${m.row.generator ?? "-"}`,
      );
    }

    if (isUnfounded(m.row)) {
      const gaps = (
        [
          ["rate", m.row.rate],
          ["costPerUnit", m.row.costPerUnit],
          ["breaksFirst", m.row.breaksFirst],
          ["generator", m.row.generator],
          ["fidelityNeeded", m.row.fidelityNeeded],
          ["satelliteChain", m.row.satelliteChain],
          ["demotionPlan", m.row.demotionPlan],
        ] as const
      )
        .filter(([, v]) => isUnknown(v))
        .map(([k]) => k);
      unfounded.push(
        `${m.row.path}: UNFOUNDED -- unbounded history with no model for ${gaps.join(", ")}. ` +
          `Permitted to exist; a debt with no exit named. Measured now: ${m.actual} ${unit}.`,
      );
    }
  }

  const registered = new Set(register.map((r) => r.path));
  const prefixes = register.filter((r) => r.kind === "directory").map((r) => normalisePrefix(r.path));
  // Only paths STILL IN THE TREE. A retired path's history is unchangeable, so listing it as a
  // finding is asking for an action nobody can take -- the same "RETIRED is not DRIFTED" mistake
  // in the other direction. `docs/github/prs/manifest.jsonl` (433 versions, retired in #17279)
  // is the worked example: it is correctly absent from this list.
  const unregisteredHotPaths = [...history.paths.values()]
    .filter((s) => s.touches >= reportThreshold)
    .filter((s) => tracked.has(s.path))
    .filter((s) => !registered.has(s.path))
    .filter((s) => !prefixes.some((pre) => s.path.startsWith(pre)))
    .sort((a, b) => b.touches - a.touches || stringCompare(a.path, b.path));

  return {
    commits: history.commits,
    trackedCount: tracked.size,
    measured,
    failures,
    windowInsideGit,
    stepThree,
    unfounded,
    retired,
    overProvisioned,
    unregisteredHotPaths,
  };
}

// -- `--cost`: the honest number ---------------------------------------------------------

export interface CostReport {
  readonly path: string;
  readonly versions: number;
  readonly distinctBlobs: number;
  readonly rawBytes: number;
  readonly onDiskBytes: number;
}

/**
 * Sum `%(objectsize:disk)` over every distinct blob a path has ever had. This is the number to
 * quote; `%(objectsize)` is also returned, for the contrast, and overstates by 5x to 805x
 * because git delta-compresses near-identical versions.
 *
 * Limit stated plainly: this is THIS CLONE'S packing. A repack changes it. It measures a
 * repository instance, not a repository invariant.
 */
export function costOf(root: string, path: string): CostReport {
  const commits = execFileSync("git", ["rev-list", "HEAD", "--", path], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  })
    .split("\n")
    .filter((c) => c.length > 0);

  const blobs = new Set<string>();
  for (const c of commits) {
    try {
      blobs.add(execFileSync("git", ["rev-parse", `${c}:${path}`], { cwd: root, encoding: "utf8" }).trim());
    } catch {
      // The path did not exist at that commit (a delete, or a rename boundary). Not an error.
    }
  }

  const sum = (format: string): number => {
    if (blobs.size === 0) return 0;
    const out = execFileSync("git", ["cat-file", `--batch-check=${format}`], {
      cwd: root,
      input: [...blobs].join("\n"),
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
    });
    let total = 0;
    for (const line of out.split("\n")) {
      const n = Number.parseInt(line.trim(), 10);
      if (Number.isFinite(n)) total += n;
    }
    return total;
  };

  return { path, versions: commits.length, distinctBlobs: blobs.size, rawBytes: sum("%(objectsize)"), onDiskBytes: sum("%(objectsize:disk)") };
}

// -- liveness ------------------------------------------------------------------------------

/**
 * A walk that saw nothing must never read as success. Extracted so the floor is unit-testable
 * without constructing a repository -- a liveness check that itself cannot be tested is the
 * failure it exists to catch.
 */
export function livenessProblem(commits: number, trackedCount: number): string | null {
  if (commits >= MIN_COMMITS_FOR_LIVENESS && trackedCount >= 100) return null;
  return (
    `the history walk saw ${commits} commit(s) over ${trackedCount} tracked path(s). This repo has ` +
    `tens of thousands of both; a near-empty walk means enumeration broke, and a check that ` +
    `inspected nothing is not a check that passed.`
  );
}

// -- cli ----------------------------------------------------------------------------------

function flagValue(argv: readonly string[], name: string): string | null {
  const i = argv.indexOf(name);
  return i < 0 ? null : (argv[i + 1] ?? null);
}

function kb(n: number): string {
  return `${(n / 1024).toFixed(1)} KB`;
}

export function main(argv: readonly string[]): number {
  const root =
    flagValue(argv, "--root") ?? execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const asJson = argv.includes("--json");
  const top = Number.parseInt(flagValue(argv, "--top") ?? "25", 10);
  const reportThreshold = Number.parseInt(flagValue(argv, "--report-threshold") ?? String(DEFAULT_REPORT_THRESHOLD), 10);

  const costIdx = argv.indexOf("--cost");
  if (costIdx >= 0) {
    const paths = argv.slice(costIdx + 1).filter((a) => !a.startsWith("--"));
    if (paths.length === 0) {
      console.error("--cost needs at least one path");
      return 1;
    }
    console.log("ON-DISK is the number to quote. RAW is the sum nobody should ever call repo growth.");
    console.log("(This clone's packing; a repack changes it.)\n");
    for (const p of paths) {
      const c = costOf(root, p);
      const ratio = c.onDiskBytes > 0 ? (c.rawBytes / c.onDiskBytes).toFixed(0) : "-";
      const per = c.distinctBlobs > 0 ? kb(c.onDiskBytes / c.distinctBlobs) : "-";
      console.log(
        `${c.path}\n  versions ${c.versions} (${c.distinctBlobs} distinct blobs)\n` +
          `  raw      ${kb(c.rawBytes)}\n  ON-DISK  ${kb(c.onDiskBytes)}  (${ratio}x smaller; ${per} per version)`,
      );
    }
    return 0;
  }

  let register: RegisterRow[];
  try {
    register = loadRegister(root);
  } catch (e) {
    console.error(`FAIL: ${(e as Error).message}`);
    return 1;
  }

  const r = audit(readHistory(root), register, trackedPaths(root), reportThreshold);

  if (asJson) console.log(JSON.stringify(r, null, 2));

  const liveness = livenessProblem(r.commits, r.trackedCount);
  if (liveness !== null) {
    console.error(`FAIL: ${liveness}`);
    return 1;
  }

  console.log(`scanned ${r.commits} commits, ${r.trackedCount} tracked paths; ${register.length} register row(s).\n`);

  if (r.unregisteredHotPaths.length > 0) {
    console.log(
      `HOT PATHS NOT IN THE REGISTER (>= ${reportThreshold} touches, still in the tree) -- reported, not failed:`,
    );
    for (const s of r.unregisteredHotPaths.slice(0, top)) {
      console.log(`  ${String(s.touches).padStart(5)}  ${s.path}  (${s.first} .. ${s.last})`);
    }
    const rest = r.unregisteredHotPaths.length - Math.min(top, r.unregisteredHotPaths.length);
    if (rest > 0) console.log(`  ... and ${rest} more (raise --top to see them)`);
    console.log(
      `\n  Findings, not verdicts. Run the three steps on each, in order:\n` +
        `    1 rolling window at roughly constant cost?  -> bound it and stop.\n` +
        `    2 regenerable from a generator at sufficient fidelity? -> keep the GENERATOR and\n` +
        `      window the bytes. The generator IS the compression.\n` +
        `    3 neither? -> tier it by access pattern (age is the default proxy) and price it.\n` +
        `  Step 3 should be RARE. If a path lands there, check that step 2 was actually tried.\n` +
        `  Several of these belong to cadence lanes paused 2026-08-29 pending a redesign;\n` +
        `  redesigning those is not this check's job. This is an optimization record, not a\n` +
        `  disapproval list -- in a perfect world we would keep everything.\n`,
    );
  }

  for (const group of [
    { title: "BOUNDED AT TIP, UNBOUNDED IN HISTORY -- a rolling window git keeps every version of", lines: r.windowInsideGit },
    { title: "STEP 3 (unbounded, no generator) -- these should be RARE; a long list means generators were not looked for", lines: r.stepThree },
    { title: "UNFOUNDED (unbounded history, no model) -- visible every run, by design", lines: r.unfounded },
    { title: "RETIRED rows -- the goal reached; delete the row", lines: r.retired },
    { title: "OVER-PROVISIONED ceilings -- constraining nothing", lines: r.overProvisioned },
  ]) {
    if (group.lines.length === 0) continue;
    console.log(`${group.title}:`);
    for (const l of group.lines) console.log(`  ${l}`);
    console.log("");
  }

  if (r.failures.length > 0) {
    console.error(`FAIL: ${r.failures.length} register row(s) past their ceiling.\n`);
    for (const f of r.failures) console.error(`  ${f}\n`);
    console.error(`Rule anchors: ${RULE_ANCHORS.join(" | ")}`);
    return 1;
  }

  const unboundedCount = register.filter((row) => row.history === "unbounded").length;
  console.log(
    `OK: ${register.length} register row(s) well-formed and inside their ceilings ` +
      `(${unboundedCount} unbounded in history; ${r.stepThree.length} step-3; ` +
      `${r.unfounded.length} unfounded).\n` +
      `This register is an OPTIMIZATION RECORD, not a disapproval list -- in a perfect world we ` +
      `keep everything.\nCount answers "how often"; --cost answers "how much"; neither answers ` +
      `whether it is bounded, which is a property of the WRITER.`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
