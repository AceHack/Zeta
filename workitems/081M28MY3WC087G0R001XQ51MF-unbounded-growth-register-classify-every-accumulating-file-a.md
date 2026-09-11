---
id: 081M28MY3WC087G0R001XQ51MF
type: task
state: backlog
priority: P2
slug: unbounded-growth-register-classify-every-accumulating-file-a
title: "Unbounded-growth register — classify every accumulating file and folder bounded vs unbounded, and demand a cost model for the rest"
created: 2026-09-11T16:31:12.780Z
depends_on: []
composes_with: []
---

# Unbounded-growth register — classify every accumulating file and folder bounded vs unbounded, and demand a cost model for the rest

## What landed

`src/Core.TypeScript/hygiene/audit-single-file-rewrite-churn.ts` +
`registry/unbounded-growth-register.json`, wired as a **drift-tier** step in
`gate.yml` (reports on every PR, blocks nothing) and as
`bun run hygiene:unbounded-growth-register`.

The commissioned subject was "a single file rewritten on a cadence". Aaron
widened it twice while it was being built, and the wider frame is the one
shipped:

> *"basically we are trying to track bounded vs unbounded growth per file /
> folder ... anything that is unbounded history, we need a scaling and cost
> model, or else it's unfounded and will fall over eventually."*

> *"this is an optimization technique. in a perfect world it would be free to
> store all history, or recalculate it forever."*

So this is an **optimization record, not a disapproval list**, and the header
says so first — a register that reads as disapproval gets argued with.

## The decision procedure the guard encodes

1. **Rolling window at roughly constant cost?** Bound it and stop.
2. **Regenerable from a generator at sufficient fidelity?** Keep the
   **generator**, window the bytes. The generator IS the compression
   (`only-the-irreducible-is-primitive-generate-the-rest.md`: the generator is
   the error-correcting code).
3. **Neither?** Genuinely unbounded and incompressible — tier it by access
   pattern, age as the default proxy, and price it.

**Step 3 should be rare.** The guard prints the step-3 count every run
precisely so a long list reads as *generators were not looked for*, not as
*this data is special*. Our own register comes out 8-of-10, and the reasons say
so: 5 are the single dependency-lock class Aaron named, 2 are honest
"nobody looked" admissions, 1 is a paused lane.

## The subtlety that earned a second column

> **A rolling window bounds the TIP. It does not bound the HISTORY.**

`data/tick-latest.json` is **251 bytes at tip** across **1091 versions** —
perfectly bounded window, perfectly unbounded history. So `tip` and `history`
are separate verdicts on every row. Collapsing them is what lets a fix-shaped
gesture pass for a fix.

## Tier = DV2.0 satellite depth

Aaron: *"sats can have sats can have sats ... each one is slower than the
next."* That makes the tier **derivable** rather than invented per path, and it
is already carved — DV2.0 is one of the seven always-active disciplines and
manifesto §9/§10 require the recursion. The repo has built recursive satellites
for months without naming them (`MEMORY.md` → `INDEX.md` → 897 topic files;
`SEED-VOCABULARY` → `GLOSSARY` → research; `rules/` → `rules.bak/` → docs).
**It tiers attention rigorously and has never tiered storage** — and git is an
expensive HOT tier holding cold data.

Where no chain exists, the absence is the finding: an unbounded path with no
satellite has nowhere to demote TO.

## Measurements that are the actual contribution

**Never quote an uncompressed blob-sum as repo size.** On-disk sum over every
distinct blob a path ever had, against the raw sum of the same blobs:

| path | versions | raw | ON-DISK | ratio | per version |
|---|---:|---:|---:|---:|---:|
| `data/tick-history.json` (sorted appends) | 1090 | 198.5 MB | **241 KB** | **805x** | 226 B |
| `docs/BACKLOG.md` (sorted, derived) | 796 | 152.4 MB | 966 KB | 154x | 1.24 KB |
| `ace/build-graph.json` (ordinalCompare) | 48 | 4.0 MB | 27 KB | 144x | 583 B |
| `memory/MEMORY.md` (hand-edited) | 694 | 150.2 MB | 1.06 MB | 138x | 1.57 KB |
| `bun.lock` | 26 | 2.0 MB | 72 KB | **27x** | 2.80 KB |
| `data/tick-latest.json` (full replace) | 1089 | 264 KB | 50 KB | 5x | 47 B |

**805x against 27x is the canonical-ordering argument in one table** — and it
shows count misleads in *both* directions: the most-rewritten file in the repo
costs 241 KB while a 29-version lock costs 72 KB. Canonical ordering does not
reduce the NUMBER of rewrites, it reduces the SIZE of each one. `--cost`
produces this table for any path.

**Counting convention, and why it disagrees with hand measurements.** HEAD-only,
never `--all`: `--all` includes whatever refs *this clone* fetched, so its
verdict varies per machine. The gap is large and uneven — `loop-tick-history.md`
HEAD 86 vs `--all` 703; `MEMORY.md` 696 vs 941; `BACKLOG.md` 800 vs 1227.

## Proof it can fail

13 hand-applied mutations, **13/13 killed**, control 38 pass / 0 fail:
ratchet disabled · retired-fails-instead-of-reports · node_modules exclusion
removed · liveness floor always-passes · retired-paths-hot filter removed ·
`generator` field not required · bare `none` liftsWhen accepted · step-3
classifier always-false · unfounded classifier always-false · directory prefix
loosened · duplicate-path refusal removed · reason floor removed ·
tip/history class never fires.

## Honest limits, stated in the file

1. Count is a proxy for cost, and a bad one (see 805x vs 27x).
2. Count answers *how often*, size answers *how much*, **neither answers whether
   it is bounded** — that is a property of the WRITER, invisible to history.
3. It cannot verify a demotion plan. It checks the fields are present; whether
   demotion happens is a process elsewhere, and a declared plan nobody runs is a
   check that did not run.
4. `--cost` measures *this clone's* packing; a repack changes it.
5. Never quote the raw sum.

Also stated: bounded history for this repo's own files is a **design goal, not
enforced**. `ZetaFsPolicy.HistoryPolicy.Rolling` (maxVersions=32 default) and
`zetadb/retention-policy.ts` are real and bound ZetaFs volumes and ZetaDb
journals — **neither bounds a path in this git repository**. Do not read the
citations as coverage.

## Ceilings

Seeded at the counts measured 2026-09-11 and therefore **tight on purpose** —
the first crossing is the signal, and re-pinning costs one line plus a
re-measured rate. Two rows carry justified headroom instead, and say why:
`memory/MEMORY.md` (800, ~6 months, because its exit is a substrate that does
not exist yet and a monthly red teaches people to ignore the check) and
`docs/history/pr-reviews` (20,000, ~2 months, because bucketing work is in
flight).

## Deliberately not done

- **No fourth sorting lint.** `build-graph.ts` (ordinalCompare at 5 sites),
  `sort-tick-history-canonical.ts`, and `lint-no-culture-sensitive-collation.ts`
  already cover it; the rule is *named* here, not re-implemented.
- **No paused lane redesigned.** The 2026-08-29 cadence batch stays paused;
  `tick-history.json` and `tick-latest.json` are registered so the redesign
  starts from measurements, not impressions.
- **Not in `gate (required)`.** A live surface would trip the ratchet on an
  ordinary day, and a check that blocks main for the expected thing gets
  disabled rather than obeyed.
