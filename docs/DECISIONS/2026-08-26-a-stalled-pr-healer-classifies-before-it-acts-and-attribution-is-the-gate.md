# A stalled-PR healer classifies before it acts, and attribution is the gate

**Date:** 2026-08-26
**Status:** design; dry-run classifier shipped, no actuator wired
**Work item:** none (design pass over an existing, already-consented actuator lineage)

## The observation that started it

Nine open PRs had gone quiet. The operator's ask had three clauses, and the third
is the one that matters:

> *"more PRs that seem abandoned — we should try to push them through or figure
> out if they are still needed, and if they should have been auto-done in some way
> and it failed, and if our free agent society could be updated to help
> auto-resolve any of these if they happen again."*

Clearing nine PRs is worth a night. Making the fleet clear them is worth every
night after. This document is the second half.

## 1. What was actually wrong — measured, not assumed

All nine were **already armed** with auto-merge. Arming was never the blocker,
which kills the obvious healer ("find unarmed PRs, arm them") before it is built.

The nine sorted into four classes:

| Class | Meaning | PRs | Mechanical? |
|---|---|---|---|
| 1 | Undispatched — the PR never received a full check dispatch | 15588 | yes |
| 2 | Conflicted with `main`, no failures | 15585 | yes, with care |
| 3 | The fix landed on `main`; the PR needs a fresh event to see it | 15605, 15551 | yes |
| 4 | Real failures | 15657, 15610, 15592, 15583, 15636 | **no** |

### 1.1 The mergeability oracle was down, and that is a load-bearing detail

`mergeable_state` read `unknown` on all nine, and stayed `unknown` after a
re-poll. GitHub computes mergeability lazily, so one `unknown` means "not
computed yet" — but nine of nine, twice, means the service is not answering.

A healer that trusts `mergeable_state` would have concluded *nothing is
conflicted* and been wrong about 15585. The conflict was found instead with a
local `git merge-tree --write-tree` against `origin/main`, which needs no
GitHub service at all:

```text
15585  CONFLICT: flake.lock (add/add)
other  CLEAN
```

**This is the probe-over-a-different-transport rule paying out on its first
use.** The healer must not ask GitHub whether a merge is clean; it must perform
the merge locally. The local answer is also strictly more informative — it names
the conflicting paths.

### 1.2 Class 3 was a thirty-second race

`cross-verify (task-zetaid-resolves)` (AH006) checks that the `Task:` id in the
**PR body** resolves to a file under `workitems/`. Both heartbeat PRs named
`081M0ZWYF7R087G0R002RXA889`. That work-item was minted by #15671, which merged
at **21:10:37**. The two PRs' checks ran at **21:10:08** and **21:10:10** —
twenty-seven and twenty-nine seconds too early.

Nothing was broken. Two PRs sat red for two hours over a race with a fix that had
already landed.

A **re-run cannot fix this**, because `rerun-failed-jobs` replays the original
event payload and its pinned merge ref. Only a new `synchronize` event
regenerates the merge ref against current `main`. That is the whole reason class
3 needs a push and not a button.

### 1.3 Class 1 and the arming trap

PR #15588 carried 7 checks where a healthy PR carries ~95 — a dispatch that never
happened, which at rollup level is indistinguishable from a dispatch that passed.

Close/reopen produces a fresh `pull_request` event and preserves the head SHA,
but **it disarms auto-merge**. A push preserves arming. Measured tonight across
six pushes: `auto_merge != null` survived all six, and check counts went
7 → 78, 54 → 78, 66 → 92, 42 → 78.

**So the healer prefers a push and must verify arming after any close/reopen.**

## 2. What was cleared, and how

| PR | Class | Action | Result |
|---|---|---|---|
| 15588 | 1 | merged `origin/main`, pushed | 7 → 78 checks, armed |
| 15605 | 3 | merged `origin/main`, pushed | 54 → 78 checks, armed |
| 15551 | 3 | merged `origin/main`, pushed | 66 → 92 checks, armed |
| 15585 | 2 | resolved `flake.lock`, evaluated the flake by hand | 42 → 78 checks, armed |
| 15610 | 4→3 | merged `origin/main`, pushed | re-dispatched, armed |
| 15657 | 4→3 | merged `origin/main`, pushed | re-dispatched, armed |
| 15592 | 4 | diagnosed only | left for its author |
| 15583 | 4 | diagnosed only | left for its author |
| 15636 | 4 | **refused** — branch held by another worktree | left alone |

Each clean merge is a maintenance commit making no content decision and therefore
carries **no** AgencySignature block. The one conflict *resolution* carries its
author's own block, never a copy of the branch's.

### 2.1 #15585 — a green that never looked at the change

The 42 green checks on the root-flake upgrade contained **zero nix evaluation of
the changed artifact**. Both `nix flake check` invocations in the repo
(`.github/workflows/build-ai-cluster-iso.yml` lines 193 and 847) run with
`working-directory: full-ai-cluster`, and that workflow's `paths:` filter does
not list the root `flake.nix` or `flake.lock` at all. The job that once evaluated
the root was deleted in `afbac2ccd6`. Three `gate.yml` lints read the root flake
as *text*; none runs `nix`.

The repo already knew: `src/Core.TypeScript/hygiene/cluster-tree-consumers.json`
lines 119-122 say so in prose, written 2026-08-17.

So the missing falsifier was supplied by hand on the merged tree:

```text
nix flake check --no-build --no-update-lock-file   ->   rc=0
  nixosModules.{common,gpu,k3s-server,k3s-agent}   ok
  darwinConfigurations.zeta-mac                    ok (build skipped)
```

`darwinConfigurations.zeta-mac` is the load-bearing one — nix-darwin asserts at
eval time that its release branch matches nixpkgs', exactly what a 24.11 → 26.05
move can get wrong.

Two corrections to the record while here. The **root** flake was on nixpkgs
24.11, EOL 2025-06-30 — **~14 months** dead, and its lock's `lastModified` is
literally the EOL date. The "~2 months past EOL on 25.11" figure belongs to
`full-ai-cluster/`, which this PR does not touch and which is still stale.

### 2.2 The floor guard cannot tell propagation from authorship

Pushing the `main` merge into `heartbeat/alexa-flush` was **refused** by the
`pre-push[floor]` hook, because the merge range contained
`src/Core/golden-vectors-room-consultation.json`.

That file was not authored by the push. It is byte-identical to `origin/main`'s
copy (blob `0a51dbdb` on both sides) and arrived via #15537, already merged.

**The guard fires on "a floor file appears in this range", which conflates
authoring a floor change with propagating a reviewed one.** It is the same defect
family as the attribution hole in §3.2 — a predicate over *presence* standing in
for a predicate over *cause*. Acked only after verifying blob identity against
`main`; a healer must perform that verification, never blanket-set the ack.

## 3. The healer

### 3.1 Do not start from scratch — four of five pieces are on the shelf

| Piece | Where | Reuse as |
|---|---|---|
| Pure episode fold, commands-as-data, sticky refusal | `src/Core.TypeScript/hygiene/episode-protocol.ts` | the state machine shape |
| Certification: idempotence, closure `⊆`, convergence | `src/Core.TypeScript/hygiene/healer-harness.ts` | the write gate |
| A real causal "this red is not yours" classifier | `src/Core.TypeScript/ci/toolchain-install-stall.ts` | **the attribution model** |
| Idempotent park → PR → arm, `armed` as a neutral fact | `src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts` | the landing primitive |
| Undispatched-PR detection (reports, never acts) | `.github/workflows/pr-gate-presence.yml` | the class-1 detector |

The missing fifth piece is attribution, and it is missing on purpose (§3.2).

### 3.2 The hole this design must not inherit

`retraction-actuator.ts` has twelve golden-vector laws in
`episode-protocol.test.ts`. Classified exhaustively they cover trigger threshold,
deference, graph-slice uniqueness, at-most-once, DST replay, terminality,
non-retry, non-oscillation, and the byte-lock floor.

**None is about attribution.** Uniqueness is a property of the commit *graph*;
attribution is a property of the *failure*.

The live counterexample, from `docs/DECISIONS/2026-08-26-acting-on-a-verdict-about-a-commit-that-is-no-longer-the-tip.md`
§3.2: on 2026-08-26 `www.gnupg.org:443` stopped answering. Isolation was
perfectly unique — exactly one commit between last-green and first-red — and that
commit was #15683, a GraphQL-transport hygiene lint, causally unrelated. Had
BD001 been open two ticks, the actuator would have retracted an innocent commit
**confidently, with a correctly-formatted letter to its author.**

So the rule for anything built here:

> **A remedy may only be applied to a PR when the failure it is remedying is
> attributable to that PR.** Uniqueness, staleness, and "it is the only candidate"
> are not attribution.

Tonight produced three more instances of the same shape:

- `drift (loud)` failed on #15551 and #15592 while reporting **repo-wide** drift
  (`build-and-test (windows-2025)` failing 39/40 on `main`, publication stale).
  None of it caused by those branches.
- `lint (bash retirement inventory)` is **flapping at 13% on `main`**
  (7/54 executions, clean streak 9) — by its own drift annotation.
- The floor guard in §2.2.

### 3.3 Classification, and the refusal to guess

The healer classifies first and acts second. Every input is a fact it gathered
itself, over a transport it is not saturating:

1. **Local merge probe** — `git merge-tree` against fetched `origin/main`.
   Never `mergeable_state`.
2. **Check census by REST** — `commits/{sha}/check-runs`, counting *presence*,
   not only conclusions. A required check that never ran contributes zero to a
   failure count and must be read as `unknown`, never as pass.
3. **Root-failure extraction** — the aggregator (`gate (required)`) is dropped;
   only its causes are considered. Per-step names come from the jobs API, since
   the check-run id *is* the job id.
4. **Attribution** — for each root failure, does the failing step's subject
   intersect the PR's own diff? If not, the failure is not the PR's.
5. **Ownership** — a branch checked out in another worktree, or named by another
   agent, is refused untouched. This fired tonight on #15636.

If any step yields `unknown`, the PR is classified `UNKNOWN` and **nothing
happens**. Fail closed: a healer that cannot classify must do nothing and say so.

### 3.4 Remedies

| Class | Remedy | Why safe |
|---|---|---|
| 1 undispatched | merge `main`, push | additive commit; preserves arming; regenerates the event |
| 2 conflicted, no failures | merge `main`; **auto-resolve only generated files with a declared regeneration recipe**, else refuse | a lock file has a generator; prose does not |
| 3 fix-landed | merge `main`, push | the fix is already reviewed on `main` |
| 4 real failures | **refuse; report** | requires judgement about someone else's design |

Class 2 is deliberately the narrowest. Tonight's conflict was `flake.lock`, a
generated artifact whose correct resolution is "regenerate from the merged
`flake.nix`". That generalises to lock files and nothing else. **Never `--ours`,
never `--theirs`, never a whole-file pick on hand-authored content** — a silent
discard eats someone's landed change.

### 3.5 Loop discipline, earned the hard way

- **Stop when the GOAL is met, however it was met** — not when this attempt
  succeeds. A retry loop that arms an already-merged PR drained the org's
  GraphQL budget for forty minutes.
- **Probe the goal over a different transport than the one being consumed.**
  That loop *had* a `state=MERGED` stop condition, read via `gh pr view` — the
  same GraphQL channel it was saturating — with a silent no-op failure branch. It
  could never observe its own goal.
- **A failed probe is `unknown`, never a negative.** `catch → not-done` is an
  infinite loop; `catch → done` is a false success.
- **One attempt per PR per tick**, then move on. No polling.
- **Never** `--admin`, never force-push, never merge a PR whose required checks
  have not run.

### 3.6 What it will not touch

- `gate.yml`, `required_status_checks`, any `needs:` key.
- Class 4. Not now, not with a bigger predicate. Diagnosing why someone's test
  fails and changing their code is authorship.
- Any branch it does not exclusively hold.
- Anything requiring `--admin` or force-push.
- Reverts. This healer moves PRs forward; retraction is the actuator's job and
  the actuator is blocked on attribution.

Every action is a normal commit and push by a named identity, reversible by
`git revert`, and states its reason in the commit body.

## 4. Honest status of the lineage this builds on

The brief for this work said the auto-revert RFC sits at *"assents with
conditions, awaiting operator."* **That is stale.** The consent bar cleared:
`retraction-actuator.ts` lines 3-5 record the operator's *"lets do it"*, and the
2026-08-26 decision doc line 170 says the same.

What is unfinished is not consent. It is:

1. **Attribution** — no predicate exists (§3.2).
2. **Three wiring defects.** The actuator is wired **live** in
   `.github/workflows/drift-sweep.yml` lines 255-269 with no dry-run flag and no
   `if:` guard. Yet (a) `drift-sweep.yml` lines 277-283 still claim the actuator
   is "deliberately not here", 22 lines below the step that runs it; (b) the
   retraction PR would open **unarmed**, because `ZETA_FLUSH_ARM_AUTOMERGE=1` is
   set on twelve workflow steps but not this one; (c) the job declares
   `contents: write` and `actions: read` but **not** `pull-requests: write`, so
   the PR-create call likely 403s, which the edge catches into `pushed=false` and
   the machine turns into a **sticky refusal**. First real fire most likely
   leaves a pushed revert branch, no PR, and a permanently refused episode.
3. **Soraya's condition (a)** — that the revert run the scoped drift detectors so
   closure is `⊆` over all classes rather than build-green alone — **appears
   nowhere in the shipped code.** Silently dropped, not discharged.
4. **Vera's measurement clause** — MTTH with the actuator on versus the fleet's
   2-tick norm — has never been performed.

It has never fired: `docs/drift-events/retraction-episodes.json` has never
existed on any branch, and is not gitignored, so absence is absence.

## 5. What the operator must decide

1. **Does the PR healer get a write token at all**, or does it stay a reporter
   like `pr-gate-presence.yml`? Everything above is designed to be safe; none of
   it is safe *enough* to self-authorize.
2. **Is class 2 auto-resolution acceptable at all**, restricted to generated
   files with a declared regeneration recipe? This is the only place the healer
   would resolve a conflict rather than refuse.
3. **The three wiring defects in §4.2** — the retraction actuator is live with no
   dry-run guard and, by inspection, cannot currently complete its own happy
   path. Fix forward, or gate it off until attribution exists?
4. **Soraya's dropped condition** — discharge it, or record it as deliberately
   dropped. Right now it is neither.
5. **The floor guard's propagation blindness** (§2.2). Should
   `ZETA_FLOOR_VECTORS_ACK` be unnecessary when the floor blobs are byte-identical
   to `main`? A healer that must ack on every merge-main is a healer with a
   standing blanket exemption, which is worse than the guard.
6. **`full-ai-cluster/flake.nix`** is ~2 months past EOL on 25.11 and, unlike the
   root, *is* evaluated by CI. Separate work, not filed.

## 6. Falsifiers

The dry-run classifier at
`src/Core.TypeScript/ci/stalled-pr-classifier.ts` writes no state and takes no
action. Its tests pin, at minimum:

- an `unknown` mergeability from GitHub never produces a merge verdict
- a check census with a missing required check classifies `UNKNOWN`, not `PASS`
- a root failure not intersecting the PR diff never yields an actionable class
- the aggregator check is excluded from root-failure extraction
- a branch held elsewhere classifies `REFUSED_OWNERSHIP`
- classification is a pure function of gathered facts (DST replay)

## Pointers

- `docs/DECISIONS/2026-08-26-acting-on-a-verdict-about-a-commit-that-is-no-longer-the-tip.md`
  §3.2 — the attribution gap, its counterexample, three costed predicates
- `docs/letters/to-roster-auto-revert-healer-design-rfc.md` — the RFC (status line stale)
- `src/Core.TypeScript/hygiene/episode-protocol.ts` — twelve laws, none about attribution
- `.github/workflows/lockfile-healer.yml` lines 19-35 — the repo's own five-property
  test for "may this be automated at all"; the yardstick this design is held to
- `.claude/rules/never-assume-malice-where-mistake-is-possible.md` — every defect
  named here is ordinary error under budget, and is reported as such
