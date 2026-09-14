---
id: 081M2E7ZHYC087G0R000NDNQ2F
type: bug
state: in-progress
priority: P2
slug: exclusive-lock-stale-takeover-admitted-3-of-8-concurrent-win
title: "exclusive-lock stale-takeover admitted 3 of 8 concurrent winners on Linux CI"
created: 2026-09-13T20:40:15.052Z
depends_on: []
composes_with: []
---

# exclusive-lock stale-takeover admitted 3 of 8 concurrent winners on Linux CI

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2E7ZHYC087G0R000NDNQ2F-*.md` glob. -->

## Evidence

`test (TS hermetic)`, PR #17402, run 2026-09-13T20:15Z, ubuntu runner:

```
251 |   const winners = await raceForLock(join(root, "run.lock.d"), 8, true);
252 |   expect(winners).toHaveLength(1);
error: expect(received).toHaveLength(expected)
Expected length: 1
Received length: 3
  at src/Core.TypeScript/io/exclusive-lock.test.ts:252:23
```

**Three of eight processes simultaneously held what is meant to be an exclusive
lock.** 3267ms, well inside the test's 30s budget — an assertion failure, not a
timeout, so "the runner was slow" does not explain it.

## What narrows it

| observation | what it rules out |
|---|---|
| the sibling **fresh-lock** race passed in the same run (`exactly one wins`, 3256ms) | the `O_EXCL` claim itself, and the harness's winner-counting |
| only the **stale-takeover** path failed | a general concurrency defect |
| 12 of the last 12 `main` commits green | a standing break; it is intermittent |
| macOS, 8 runs under 8-way CPU saturation: 8/8 pass | slowness as the trigger; the platform is the remaining difference |

## Leading hypothesis — NOT yet tested

The takeover path judges the incumbent stale via an `isHeld` predicate. If a
racer's freshly-claimed generation is judged **stale by a later racer** — because
that racer's pid is not recognised as live — takeover cascades: A takes gen 1, B
reads gen 1, calls it stale, takes gen 2, C takes gen 3. Three holders, each
having followed the protocol correctly. That would place the defect in the
**staleness oracle**, not in the `O_EXCL` claim — consistent with every row above,
including why the fresh-lock race (no staleness judgement) passes.

If that is right, the same cascade is reachable in production whenever a live
holder is misjudged as dead, which is the property worth testing directly rather
than through an 8-process race.

## Why this matters beyond the flake

`exclusive-lock` is a mutual-exclusion primitive and this test is the falsifier
for alerts #955/#811. A falsifier that fails intermittently is worse than one
that fails always: the failure is attributed to flakiness and the finding is
discarded. It also sits inside `gate (required)`, so an intermittent red here
blocks unrelated PRs — which is the pressure that gets a real signal muted.

**Do not "fix" this by retrying the test or widening the timeout.** Neither
touches the measured fact, and both would convert a true alarm into silence.

## Next step

Reproduce on Linux (container or CI) with the racers' pids instrumented, and
record which generations the three winners held. Generations 1/2/3 confirm the
cascade; three claims of the *same* generation refute it and move the defect back
into the claim.

## ROOT CAUSE — CONFIRMED, and it was not the staleness oracle

The hypothesis above was wrong in its mechanism and right that the defect is in the
takeover path. The actual cause is in `claimGeneration`:

```ts
fd = openSync(path, "wx", 0o600);   // the NAME now exists — ZERO BYTES
writeSync(fd, JSON.stringify(owner)); // the CONTENT arrives one syscall later
```

`O_EXCL` is atomic about the **name** and says nothing about the **content**. Between
those two calls the generation exists and is unparseable. `ownerOf` does
`JSON.parse(readFileSync(...))`, so a concurrent scanner in that window gets
`undefined` — and this module's own documented rule is that an unparseable generation
is *"treated as not-held and SUPERSEDED"*. The scanner claims the generation above.

**Every claim manufactured the exact corruption the protocol was designed to tolerate.**
Three racers, three windows, three holders.

Reproduced with **no concurrency at all**: plant a zero-byte generation owned by a LIVE
process (`isHeld: () => true`), call `takeExclusiveLock` — the second caller acquires the
lock and collects the live holder's generation away.

## FIX — stage-then-link

Build the file complete under a non-generation-shaped staging name, publish with
`link()`. `link` is atomic and fails `EEXIST` exactly as `O_EXCL` did, so exclusion is
unchanged, and no observer can see a half-written generation because the content exists
before the name does. Staging names are not `^\d+\.lock$`, so a crash-stranded one is
invisible to `generations()`; success and lost-claim paths both clean up, which matters
because `releaseGeneration` only rmdirs an EMPTY directory.

## STILL OPEN: there is no deterministic falsifier for the window

Measured, not assumed: reverting `claimGeneration` to create-then-write leaves
`exclusive-lock.test.ts` at **21 pass / 0 fail**. The four tests added alongside the fix
pin invariants of the new implementation (content-with-name, no residue) — **they do not
fail without the fix**, and the file now says so.

Writing a real one needs either a test-only seam in the claim path (making the tested
path differ from the shipped one) or a concurrent observer that can only produce false
GREENS. Neither is acceptable without a decision, so this stays open rather than being
quietly marked done. The end-to-end evidence remains the Linux CI failure plus the
deterministic mechanism demonstration.
