---
id: 081M243P7N2087G0R001541V8M
type: bug
state: backlog
priority: P1
slug: rolling-tla2tools-pin-upstream-republishes-faster-than-a-re
title: "rolling tla2tools pin: upstream republishes faster than a re-pin can merge, so CI is red repo-wide"
created: 2026-09-09T22:12:50.978Z
depends_on: []
composes_with: []
---

# rolling tla2tools pin: upstream republishes faster than a re-pin can merge, so CI is red repo-wide

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M243P7N2087G0R001541V8M-*.md` glob. -->

**Timeline (UTC, 2026-09-09). Every row is measured, not inferred.**

| time | event | evidence |
| --- | --- | --- |
| 18:42 | `0985a2ae9a` (#17154) lands: `src/Core.TLA/tla2tools.jar` de-vendored onto `rolling=tlaplus-v1.8.0-prerelease`, pinned `bb82311b...` | `git show 0985a2ae9a:tools/setup/manifests/from-url` |
| ~21:2x | upstream republishes the asset behind `releases/download/v1.8.0/tla2tools.jar` | the re-pin below exists |
| 21:29 | `5bc5042fcb` "fix(setup): re-pin tla2tools.jar after tlaplus-v1.8.0-prerelease rebuild" moves that branch to `f629a67c...` | `git log 0985a2ae9a..5bc5042f -- tools/setup/manifests/from-url` |
| 21:40 | that same branch CI run 34407237296 fetches and gets `8836549e...` -- **the re-pin was already stale when CI ran** | job 102654384302 log |
| 21:50 | run 34409080634 (a branch on `main` pin `bb82311b...`) fails the same step | job 102659008445 |
| 22:11 | independent measurement of upstream: `8836549e83db7f0b3f9fdde679ab56270d18e06198366d217d960738c02b9dbe` | `curl -sL <url> \| shasum -a 256` |

**Three distinct digests for one URL inside about three hours**, and a re-pin that went
stale between the local measure and the CI fetch.

## The mechanism is NOT broken

081M23ESC5B087G0R002HJ39DG says it outright: *"the point of a pin under a mutable tag is
DETECTION, never permission"*, and detection is exactly what happened. `from-url` refused,
named the rebuild, printed both digests and the re-pin command. Reported here as an
operational fact, not a defect: nobody did anything wrong, and the failure is the design
behaving as specified.

## What IS a defect: the remedy has a shorter half-life than the merge latency

`repin-rolling.ts` measures upstream locally, then the pin has to survive review + gate +
merge before any other PR benefits. Measured above, upstream moved inside that window, so
the re-pin merged (or would have merged) already wrong. A loop whose fixed point requires
upstream to hold still cannot converge while upstream is republishing on this cadence.

## Blast radius

- **Who is affected:** every open PR in the repository, every agent.
- **What they observe:** 15-21 red checks whose annotation is only `Process completed with
  exit code 1`. The step that fails is `Install toolchain ... (GOVERNANCE 24)`; the check
  the job exists to run is `skipped`. Measured on run 34409080634: 13 jobs failed at that
  step, 3 at its Unix variant, 1 at `Install toolchain (all 7 languages + E-prover)`.
  **The red X does not say "toolchain install", so this reads as "my PR broke 20 things".**
  Confirmed independently on #17173 (21 failures), #17174 (21), #17172 (18).
- **What they should do:** nothing. Do not repair your branch, do not repin on your own
  branch (that is the 21:29 attempt above, and it did not hold). Leave auto-merge armed.
- **SLA:** merge-blocking for the whole repo, so same-day.

## Not fired here, and why

The remedy is `bun tools/setup/repin-rolling.ts src/Core.TLA/tla2tools.jar`. It is NOT run
by this report because moving the pin re-measures a **verifier**: the row itself declares
`remeasure=src/Core.TypeScript/formal-verification/run-tlc.ts:--all` and
`pinsurfaces=registry/tlc-models.json,docs/INSTALLED.md,docs/dependency-status.md`. Every
claim the old jar established has to be re-measured before the pin moves; that is a
verification-claim decision for the row owner, not a CI unblock. And on the evidence above
a fourth re-pin is a bet with a three-hour half-life.

## The question for the row owner

Not "re-pin again" but: does this row keep chasing `tlaplus-v1.8.0-prerelease`, or move to
an immutable release asset? 081M23ESC5B087G0R002HJ39DG has a section named "Why the
rolling tag and not immutable v1.7.4" -- that reasoning is what this measurement bears on.
A third option nobody has priced: re-vendor, which is what #17142 deliberately kept and
#17154 undid.

## Second-order finding, independent of the pin decision

A shared prerequisite step failing turns into N red checks with an annotation that names
neither the step nor the cause, while the checks those jobs exist to run report `skipped`.
Sixteen jobs reporting failure for one install is an attribution problem of exactly the
class the per-language lint split solved once already. Worth its own row.

## Correction, 22:21 UTC — a rate I inferred from a count

| time (UTC) | upstream digest |
| --- | --- |
| 21:40 | `8836549e83db7f0b...` (CI job 102654384302) |
| 22:11 | `8836549e83db7f0b...` (independent measurement) |
| 22:21 | `8836549e83db7f0b...` (independent measurement) |

Upstream has held ONE digest for about 40 minutes.

The section above called a fourth re-pin *"a bet with a three-hour half-life."* That was an
extrapolation from three digests inside three hours — two intervals — and the measurements
since do not support it. **A count is not a rate.** Withdrawn. Upstream most likely
republished twice in one prerelease build burst and has been stable since, so **a re-pin to
`8836549e...` may well hold**, and nothing here should be read as an argument against firing
the documented remedy.

Unchanged, because none of it rested on the cadence claim: the 21:29 re-pin **was already
stale when its own CI ran at 21:40** (measured, not projected); the block is repo-wide;
moving the pin still re-measures a verifier and stays the row owner.s call; and the
attribution finding stands on its own.

Re-measure before acting — including not taking the 22:21 reading here on trust.
