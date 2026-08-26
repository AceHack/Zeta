# Every branch on `origin`, classified — 16 recovery tags created, zero deletions proposed today, and the reason is that the off-site copy still does not exist

**Date:** 2026-08-26 · **Author:** shadow · **Kind:** research / handoff
**Status:** tags landed; the delete list is a *proposal*, gated on one measurement that has not yet been taken.

---

## 0. The headline, before the inventory

A branch sweep is only safe because the recovery tags it creates are mirrored off-site to
`acehack/Zeta`. **At the moment of writing, that mirror has not run since the bug that broke it
was fixed, and the gap is wider than it was this morning — not narrower.**

Measured directly, not inferred (`git ls-remote --tags` against both remotes):

| moment (UTC, 2026-08-26) | origin tags | fork tags | archive tags missing off-site |
|---|---|---|---|
| 08:31:56 — before this work | 343 | 325 | **18** |
| 08:4x — after this work created 16 | **359** | 325 | **34** |

Every one of the 34 is an `archive/*` recovery tag. `comm -13` in the other direction is empty:
the fork holds nothing origin lacks, so this is pure one-way loss, not divergence.

**The cause is confirmed from the run log, not taken on trust.** `mirror-to-fork.yml` run
`32937913382` (2026-08-26T06:23:31Z — the last run before the fix) ends:

```
! [remote rejected]     main (refusing to delete the current branch: refs/heads/main)
error: failed to push some refs to 'https://github.com/acehack/Zeta.git'
##[error]Process completed with exit code 1.
```

`git update-ref -d refs/remotes/origin/HEAD` dereferences the symref and deletes `origin/main`'s
tracking ref; `--prune` therefore asks the fork to delete its own default branch; the push exits 1;
`set -euo pipefail` aborts the step **before the line that pushes tags**. That is the whole
mechanism, visible in one line of one log.

**PR #15499 merged at 08:31:11Z** — forty-five seconds before the first measurement above. So the
fix is on `main` and has still **never been observed to work**. And it will not self-demonstrate
soon: the merged workflow is `schedule: cron "13 8 * * *"` — **daily at 08:13 UTC**, which today
fired *18 minutes before the fix landed*. Absent a manual dispatch, the next proof is
**2026-08-27 08:13 UTC**.

### What follows from that

Tag creation is additive and was done. Deletion is not, and should wait for one command and one
re-measurement:

```bash
gh workflow run mirror-to-fork.yml --repo Lucent-Financial-Group/Zeta
# then, after it completes:
echo "origin: $(git ls-remote --tags https://github.com/Lucent-Financial-Group/Zeta.git | wc -l)"
echo "fork:   $(git ls-remote --tags https://github.com/acehack/Zeta.git | wc -l)"
```

When those two numbers agree, the safety net is two-copy and the delete list below can be executed.
Until then **every recovery tag in this repository is a single copy on one host**, and a sweep
performed today is a sweep with no net.

There is a second reason to dispatch it manually rather than wait: the fix has never run, so
`2026-08-27 08:13` might also fail for an unrelated reason (the workflow's `ACEHACK_MIRROR_TOKEN`
is a provisioned secret, and the job now deliberately fails loudly rather than skipping). A dispatch
today converts an assumption into a measurement.

---

## 1. Method, and the trap that invalidates the obvious approach

`git merge-base --is-ancestor <branch> origin/main` is **not** a merged-test in this repository.
`main` takes squash merges, so an absorbed branch's commits are never ancestors of `main` and the
ancestry test reports `merged=no` for branches whose PRs are demonstrably `MERGED`. Four branches
here fail that way. It is the vacuity class in its ordinary form: a check that answers a different
question than the one asked, and looks authoritative doing it.

What was used instead, per branch:

1. **PR state** — `gh pr list --head <branch> --state all`. This is the merged/refused signal.
2. **`ahead_by` / `behind_by` / changed files** — `gh api repos/…/compare/main...<branch>`.
   (Note the API caps `files` at 300; for `otto/telemetry-zetaid-shards` the true count is 568 and
   was recomputed locally from the branch's own commit range.)
3. **Blob-identity against `main`** — for every changed path, `git rev-parse <branch>:<path>`
   compared to `git rev-parse origin/main:<path>`. Three outcomes: *identical* (absorbed),
   *differs* (read the diff — is `main` a superset, or is this work `main` never got?), and
   *absent on main* (the path does not exist there at all).
4. **Where a path is absent, a rename/relocation search** across `main`'s full 50,625-path tree
   before concluding anything is missing.

Point 4 matters. Four of the "missing" paths were found elsewhere on `main` — a workitem promoted
into `workitems/done/2026/07/`, a research doc landed under a different PR. Absence from one path is
not absence from the repository, and reporting it as loss would have been the same error in the
opposite direction.

**Inventory:** 68 refs on `origin` = `main` + 26 `heartbeat/*` lanes + `agent-heartbeats` + 40 others.

---

## 2. `agent-heartbeats` — 689 commits, and its only recovery tag is one of the 34

**Do not delete this branch. Do not touch it.**

It is not a stale feature branch. It is **otto-windows' entire heartbeat record from 2026-05-30 to
2026-06-20** — 689 commits of `docs/agent-heartbeats/otto-windows/**`, one file per tick, that never
reached `main`.

| check | result |
|---|---|
| `ahead_by` / `behind_by` vs `main` | 689 / 11,181 |
| `docs/agent-heartbeats/otto-windows/**` on `main` | **0 files** |
| `docs/agent-heartbeats/**` on `main` (all lanes) | 10 files |
| existing recovery tag | `archive/2026-08-25-agent-heartbeats/otto-windows-telemetry-unflushed` |
| that tag's target | `2a73240478b28f18d3f1e5837f95a72a0d1a7184` — **exactly** the branch tip |
| that tag on the fork | **absent** — it is one of the 34 |

So the content is genuinely absent from `main`, the branch is its only live ref, and the tag meant
to be its safety net is itself un-mirrored. This is the sharpest instance of §0: an agent's liveness
record, which manifesto §5 (Memory Preservation) says an identity transition must never silently
destroy, currently exists in exactly one place.

If a decision is ever made to reclaim it, the correct order is: mirror first, verify the tag exists
on the fork, *then* consider the branch. Not before.

---

## 3. The `heartbeat/*` lanes (26) — LANE, do not touch

These are not stale. They are the live telemetry parking lanes: since the "CI Gate" ruleset requires
`gate (required)` at push time with no bypass actors, telemetry lanes no longer push to `main` — they
park on `heartbeat/*` and flush via PR. **15 of the 26 carry a commit from today** (of the 23 that carry
any payload at all), several from the last twenty minutes.

Two are worth naming specifically:

- **`heartbeat/soraya-flush` and `heartbeat/alexa-flush` are byte-identical to `main`'s tip**
  (`c6bcecc77b2979b52ba52b743505270021698475`), `ahead_by = 0`, zero files. They were overwritten by
  the flush bug fixed in **#15532** (merged 2026-08-26T08:20:13Z — eleven minutes before this was
  written): the flush pre-merged `main` into `main`, so every lane reported a green no-op and nothing
  landed. **Nothing was lost** — the payload is still parked on the agent lanes themselves
  (`heartbeat/alexa` and `heartbeat/soraya` are each 4 ahead). The flush branches must be left in
  place so the fixed flush can re-park onto them.
- **`heartbeat/otto`** is `ahead_by = 0` with zero files — an empty lane sitting at an ancestor of
  `main`, not a payload branch. Still a lane; still do not touch.
- **`heartbeat/lockfile-healer-probe`** carries **#13895, MERGED** (2026-08-22). Its PR is absorbed,
  but it lives in the lane namespace and the sweep does not enter that namespace.

A lane that looks stale by age is usually a lane whose cadence is weekly (`heartbeat/budget-snapshot`
is 1,094 behind and that is *correct* for a weekly burn snapshot). Age is not the signal here.

---

## 4. ACTIVE — open PR, not stale (4). No tag, no deletion.

| branch | PR | last commit |
|---|---|---|
| `dependabot/bun/bun-minor-patch-315bd842cf` | **#15305 OPEN** | 2026-08-26 |
| `dependabot/npm_and_yarn/agentic-organization/npm-minor-patch-218b9a2e63` | **#15304 OPEN** | 2026-08-26 |
| `dependabot/npm_and_yarn/src/Renderers/website/react-day-picker-10.0.1` | **#14585 OPEN** | 2026-08-26 |
| `feat/manifesto-full-lock` | **#15514 OPEN** | 2026-08-26 |

All four have human/agent commits on top of the automated head within the last day. A sweep that
scanned by age alone would have caught the dependabot branches (their original bump commits are from
2026-08-25) and destroyed in-flight conflict resolution.

---

## 5. ABSORBED — PR merged (squash). Tagged. Safe to delete.

`delete_branch_on_merge` is **`true`** on this repository, so merged branches normally self-clean —
which is why only four survive, all from 2026-08-25, and why `fix/mirror-no-deref` (#15499) was
already gone by the time this ran (it merged at 08:31:11Z and its ref returns 404). Going forward
the standing stale set is dominated by REFUSED and ORPHANED, not ABSORBED.

| branch | PR | ahead | age | tag created |
|---|---|---|---|---|
| `fix/worktree-mise-trust` | #15402 MERGED | 3 | 1d | `…/fix-worktree-mise-trust` |
| `claim/081M0WTW45W-auto-vivify-dangling-paths` | #15390 MERGED | 4 | 1d | `…/claim-081M0WTW45W-auto-vivify-dangling-paths` |
| `fix/four-unowned-ci-gaps` | #15378 MERGED | 2 | 1d | `…/fix-four-unowned-ci-gaps` |
| `fix/settings-record-wrong-in-the-permissive-direction` | #15369 MERGED | 2 | 1d | `…/fix-settings-record-wrong-in-the-permissive-direction` |

*(tags all under `archive/2026-08-26-branch-sweep/`)*

---

## 6. REFUSED — PR closed unmerged (12). Tagged. **Read the reason before deleting.**

The instruction to check *why* each was refused earns its keep: three of these carry content that is
still not on `main`, and one has no recorded reason at all.

### 6a. Refused with a stated reason, and content redundant — highest deletion confidence

| branch | PR | age | why closed | redundancy evidence |
|---|---|---|---|---|
| `fix/model-benchmark-template-typo` | #15386 | 1d | superseded by **#15388**, which landed the identical one-character fix (`${r.model:}` → `${r.model}`) at `e97a4efcd` | only residue is a `prettier --write` on the same file; `format:check` exists in `package.json` and is invoked by **no workflow**, so it gates nothing |
| `claim/…-arity-census-freetime` | #15447 | 1d | **premise falsified.** Mutation M17 changed `Phase_ = phase` to `Phase_ = DateTime.UtcNow.Ticks` and all 31 tests still passed, including the FTA-5 the PR was ratcheting for. Superseded by **#15446** (`d65a8f85c7`) | correctly refused — the census-only remedy would have recorded a check that cannot fail |
| `claim/bug-dotnet-arm64-accessviolation` | #9871 | 25d | AgencySignature validator rejected a ZetaId in the `Task` field; rebuilt on a clean branch | workitem `081KYYQ831108QG0R001FJJ9XK` **is** on `main` |
| `claim/kiro-free-tier-intelligence-scaling` | #9561 | 49d | "Content already on main." | the one absent path, workitem `081KX1KWD7N…`, is on `main` at `workitems/done/2026/07/` |
| `claim/kiro-identity-adr-corrections-2026-07-08` | #9547 | 49d | "Content already on main." | same; 9 shared docs differ only by `main` having moved on |
| `claim/kiro-trio-attestation-research-2026-07-08` | #9570 | 49d | "Rebasing into fresh PR." | same |
| `claim/kiro-trust-protection-adr-2026-07-08` | #9537 | 49d | "Content already on main." | same |
| `otto/lint-fused-persona-cell-phase5` | #9551 | 49d | the whole 12-commit stack was migrated onto current `main` and merged as **#9680**; this PR was stranded 720 commits behind | 149 files: 82 blob-identical, 56 differ (`main` newer), and **all 11 "absent" paths are `.js` build artifacts** whose `.ts` sources are on `main` |

### 6b. Refused for a reason, but carrying code `main` never got — delete only with the owner's eye on it

| branch | PR | age | why closed | what is still absent from `main` |
|---|---|---|---|---|
| `shadow/candidate-generator-possibility-space` | #10845 | 11d | closed with its base #10835 on a Kenji HOLD — the forecaster port is unused and the PR is off the operator-algebra surface. *"Redo on a head that actually wires CandidateGeneration into the scheduler."* Aaron authorized the close 2026-08-16 | `src/Core/BonsaiCost.fs`, `src/Core/CandidateGeneration.fs`, both test files, the research doc `2026-08-15-inject-the-scheduler-at-the-evaluation-seam…`, workitem `081M03CKBBX…` + 2 events |
| `shadow/consensus-vote-dead-timestamp-and-local-time-audit` | #10738 | 12d | **pointed the wrong way**: the defect it documents as filed-not-fixed was actually fixed by `main`'s #10759, and two tests here assert the old behaviour — merging would revert the fix. Its new lint's single-row registry also names `LocalObservedAt`, a field that exists nowhere | `src/Core.TypeScript/hygiene/lint-local-clock-fields-never-read.{ts,test.ts}`, workitem `081M013T0D7…` + 1 event |
| `fix/installer-ci-and-gate-reds-2026-07-31` | #9833 | 25d | superseded mechanically by #9835 (`tsconfig` half) and by `main`'s `.js`→`.ts` installer migration + `gate.yml` restructure. Closed on Aaron's push-forward call | the closing comment itself records the live gap: *"the valuable intent — gating the installer unit tests — is real and still undone on main (8 installer `*.test.ts` files run by nothing)."* That is a standing finding independent of this branch |

These three are correctly refused *as PRs*. The tag is what makes deleting them cheap later; the
content above is what makes deleting them today premature if anyone still wants it.

### 6c. Refused with **no recorded reason**, and content absent from `main` — flag

| branch | PR | age | evidence |
|---|---|---|---|
| `fix/verify-session-toctou` | **#13958 CLOSED 2026-08-22** | 4d | The PR's only comment is a `chatgpt-codex-connector` quota notice. **No human or agent comment explains the close.** Its files `src/Core.TypeScript/observe/read-optional-text.{ts,test.ts}` are **absent from `main`**, and `verify-session-fixes.ts` differs. Authored by an external agent (`Agent: Manus`, `Agent-Model: GPT-5`). Stated scope: replace all five `existsSync`-then-`readFileSync` paths in session verification with one operation-result reader, treating only `ENOENT` as pending. |

This is the one branch in the whole set that matches "abandoned good work" rather than "refused on
the merits". It is tagged. It should not be deleted until somebody says why it was closed — the
absence of a reason is itself the finding, and the honest reading is an ordinary dropped thread, not
a decision nobody wrote down.

---

## 7. ORPHANED — commits ahead, **no PR at all** (19). This is the class that loses work.

### 7a. Redundancy PROVEN — content demonstrably on `main` by another route

| branch | ahead | age | proof |
|---|---|---|---|
| `cursor/longhorn-common-nix-default-test-06ca` | 5 | 4d | 7 of 8 files **blob-identical** to `main`. The 1 differing file (`full-ai-cluster/nixos/modules/common.nix`) has exactly **7 branch-only lines, all of them comments** — and they are the *pre-correction* text that `main` replaced on 2026-08-23 (the false "mise activate … adds them to PATH automatically" claim). The branch is behind, not ahead, in content. |
| `cursor/longhorn-rebase-clean-06ca` | 4 | 4d | identical finding — same 8 files, same single comment-only divergence |
| `cursor/rework-pr-13767-9c53` | 1 | 4d | 5 of 7 identical, including all five `rho-star-not-a-gate` files and both research docs. The 2 differing (`society/effective-agent-count.{ts,test.ts}`) are the **older** form: the branch asserts `multiOperator/cells < 0.02`, `main` supersedes it with a test that reports operator collisions instead of hiding them |
| `otto/telemetry-zetaid-shards` | 3 | 13d | true file count 568 (the API's 300 is a cap). All 5 new code files exist on `main`; 3 are blob-identical (`tick-shards.ts`, `tick-shards.test.ts`, `tick-metrics-writer.ts`) as is the `CLAUDE.md` edit; 560 of 561 tick shards identical. The 2 differing files are `main` **supersets** — `flush-via-staging.ts` is +446 lines on `main`, `backfill-tick-shards.ts` +38 — and the branch-unique lines are the pre-rewrite form of code `main` replaced |

**These four are the only orphans this report proposes deleting**, and only after §0's measurement.

### 7b. Claim leases — coordination artifacts, never merged by design

`docs/claims/README.md` on `main` specifies the protocol: a live claim is one file at
`docs/claims/<slug>.md` on a `claim/<slug>` branch, *deleted in the same PR that lands the work*. A
branch whose only content is its own lease file therefore **carries no work product** — the branch
*is* the lease. The README states the expiry directly: *"A claim older than 24 hours without a
progress signal is stale and may be force-released."*

| branch | claimed_at | verdict |
|---|---|---|
| `claim/081M089ZPAY-chip8-cross-run-room-consult` | 2026-08-26T07:17:36Z, **ETA 09:17:36Z** | **ACTIVE — in flight right now.** Do not touch. |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-26` | 2026-08-26T00:21:09Z | **ACTIVE** (< 24h) |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-25` | 2026-08-25T00:20:26Z | stale lease, **same work id** `081KTQX7W6Q08QG0R000XA3220` as the -26 branch |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-24` | 2026-08-24T17:44:30Z | stale lease, same work id |
| `claim/task-browser-checkpoint-port` | 2026-08-09 | stale lease, 17d |
| `claim/task-browser-pwa-checkpoint-transport` | 2026-08-08 | stale lease, 18d |
| `claim/task-browser-zetadb-invalidation` | 2026-08-09 | stale lease, 17d |
| `codex/browser-zetadb-startup-hydration` | 2026-08-10 | stale lease, 16d; its second commit touches workitem `081KZMCBDK2…`, which **is** on `main` |

The six stale leases are the cheapest cleanup in the set — releasing a stale lease is the protocol's
own prescribed operation, not a loss. **But the three otto branches deserve one note before anyone
force-releases them:** all three carry the *same* work id, and the mechanism that made them is
minting a fresh dated branch per day rather than reusing or releasing. That is a small daily leak,
and deleting the branches treats the symptom. Worth a look at whatever creates
`claim/<id>-otto-<date>`.

### 7c. Redundancy NOT proven — unique content absent from `main`. **DO NOT DELETE.**

Per the standing constraint, none of these is proposed for deletion, because none can be shown
redundant. Each row names exactly what is missing.

**The clean-room N-version experiment (3 branches) — the highest-value orphan in the set.**

| branch | ahead | age | absent from `main` |
|---|---|---|---|
| `derivation-a/threshold-sig-verify` | 2 | 16d | `docs/derivations/derivation-a-report.md`, `src/Core/ThresholdSignatureVerification.fs`, `tests/…/ThresholdSignatureVerification.Tests.fs` |
| `derivation-b/threshold-sig-verify` | 4 | 16d | `docs/derivations/derivation-b-report.md`, `src/Core/ThresholdSignatureSchemes.fs`, `src/Core/ThresholdSignatureVerification.fs`, its tests (21 acceptance tests, 14 named spec ambiguities) |
| `derivation-c/threshold-sig-verify` | 2 | 16d | `docs/derivations/derivation-c-report.md`, `src/Core/ThresholdVerification.fs`, its tests (15 named spec ambiguities) |

These are three **independent** implementations of one spec, written under
`.claude/rules/cleanroom-two-team-separation.md`. What landed on `main` is only the *analysis*:
PR **#10269** (merged) contains exactly one file, `docs/specs/threshold-signature-verification-combine.md`
— *"the N=3 run — three correct implementations that cannot verify each other."*
`docs/derivations/` does not exist on `main`; `main`'s `src/Core/Core.fsproj` contains no threshold
entry at all.

So the paper survives and the experiment does not. Deleting these three deletes the three
independent derivations that the combine spec is *about* — and independence is not reproducible
after the fact, because whoever re-derives now has read the analysis. This is the one place in the
sweep where deletion would destroy something that cannot be remade.

**Real unmerged code, doc-half landed.**

| branch | ahead | age | absent from `main` | what did land |
|---|---|---|---|---|
| `otto/agent-sovereign-keys-proposal` | 6 | 12d | `src/Core/ZPlan.fs` (typed operator IR), `src/Core/DurabilityTier.fs`, `src/Core/SchemaLogCodec.fs`, `src/Core.Lean4/Lean4/ZSetCopyComonoid.lean`, and 3 test files | only the research doc, via **#10511** (merged) — *"agent-sovereign keys ladder L0→L6"*. The branch's name describes its smallest part. |
| `automation/society-protected-main-contract` | 1 | 13d | **all 5 files**: `society-heartbeat-pr-delivery.{ts,test.ts}`, `society-heartbeat-pr-handoff.{ts,test.ts}`, `docs/handoffs/2026-08-13-society-protected-main-delivery.md` | nothing from this branch. The *capability* exists on `main` by a different route (**#10371**, "route the four telemetry lanes off direct-push-to-main"), and `main` has `society-heartbeat-dispatch.ts` — a different, smaller module (2,369 bytes vs this branch's 2,682 + 4,361). Superseded in effect, not in content. |
| `claim/081KWQS2PN608QG0R002CXSBG0-minimal-bnn-synthesis` | 1 | 49d | `docs/research/2026-07-08-multi-agent-collision-resolution-protocol.md`; and `MinimalBnn.fs` differs by a **real feature** — `updateWithFeature x y` generalises the likelihood from `(observation·precision, precision)` to `(x·y·precision, x²·precision)`, i.e. Bayesian linear regression over an input feature, with `update` kept as the `x = 1.0` case | `MinimalBnn.fs` and its tests exist on `main` via **#9514**, but without this generalisation |
| `claude/design-sync-dqxa3r` | 1 | 56d | **21 of 36 files**: every sub-component preview (`CardHeader/CardTitle/CardContent/CardDescription/CardFooter`, `DialogHeader/Title/Description/Body/Footer`, `SheetHeader/Title/Body`, `TabsList/Trigger/Content`, `HealthDot`, `MetricChart`, `PersonaAvatar`) plus `full-ai-cluster/portal/web/src/ds-entry.ts` and `tailwind.ds-sync.config.js`. The 15 shared paths **all differ** | **#9083** (merged) landed a *different, smaller* import — the same 10 top-level previews and the docs, none of the sub-components |

---

## 8. What was created

16 lightweight tags under `archive/2026-08-26-branch-sweep/`, matching the existing convention
(`archive/2026-08-25-branch-sweep/*`, branch `/` → `-`). Each was verified after creation to point at
its branch's live tip; 16/16 match, 0 mismatches.

<details>
<summary>The 16 tags</summary>

```
archive/2026-08-26-branch-sweep/claim-081M0WTW45W-auto-vivify-dangling-paths       acd737a79
archive/2026-08-26-branch-sweep/claim-081M0XF2RTG087G0R002DRKG39-arity-census-freetime  8ceb57155
archive/2026-08-26-branch-sweep/claim-bug-dotnet-arm64-accessviolation             7435f72e5
archive/2026-08-26-branch-sweep/claim-kiro-free-tier-intelligence-scaling          d11c4c6a1
archive/2026-08-26-branch-sweep/claim-kiro-identity-adr-corrections-2026-07-08     14f08f615
archive/2026-08-26-branch-sweep/claim-kiro-trio-attestation-research-2026-07-08    11a278d75
archive/2026-08-26-branch-sweep/claim-kiro-trust-protection-adr-2026-07-08         f59f8b54a
archive/2026-08-26-branch-sweep/fix-four-unowned-ci-gaps                           1a2055f9c
archive/2026-08-26-branch-sweep/fix-installer-ci-and-gate-reds-2026-07-31          b40009e19
archive/2026-08-26-branch-sweep/fix-model-benchmark-template-typo                  c1ad3055c
archive/2026-08-26-branch-sweep/fix-settings-record-wrong-in-the-permissive-direction  bad7bec1b
archive/2026-08-26-branch-sweep/fix-verify-session-toctou                          6e8af24f1
archive/2026-08-26-branch-sweep/fix-worktree-mise-trust                            4fa87b7bc
archive/2026-08-26-branch-sweep/otto-lint-fused-persona-cell-phase5                c99a73e34
archive/2026-08-26-branch-sweep/shadow-candidate-generator-possibility-space       28c6c0c1f
archive/2026-08-26-branch-sweep/shadow-consensus-vote-dead-timestamp-and-local-time-audit  30887df76
```

</details>

**No branch or tag was deleted. Nothing was force-pushed. No `heartbeat/*` lane or `agent-heartbeats`
was written to.**

**Not tagged, deliberately:** the ORPHANED branches. A tag under `…-branch-sweep/` asserts *this was
swept*, and applying that label to work nobody has decided about would make the tag namespace lie.
If durable preservation for the orphans is wanted — and for §7c it probably is — the right shape is a
separate namespace such as `archive/2026-08-26-orphaned/<branch>`, created as its own deliberate act.
That is a recommendation, not something done here.

---

## 9. Proposed delete list — ordered by confidence, **gated on §0**

**Precondition for every tier:** `mirror-to-fork.yml` has been dispatched and `origin` and fork tag
counts agree. Until then, execute none of it.

### Tier 1 — merged, tagged, content on `main` by definition (4)

```
fix/worktree-mise-trust                                  #15402 MERGED
claim/081M0WTW45W-auto-vivify-dangling-paths             #15390 MERGED
fix/four-unowned-ci-gaps                                 #15378 MERGED
fix/settings-record-wrong-in-the-permissive-direction    #15369 MERGED
```

### Tier 2 — refused with a stated reason **and** content proven redundant (8)

```
fix/model-benchmark-template-typo                        #15386  superseded by #15388
claim/081M0XF2RTG087G0R002DRKG39-arity-census-freetime    #15447  premise falsified; superseded by #15446
claim/bug-dotnet-arm64-accessviolation                   #9871   workitem on main
claim/kiro-free-tier-intelligence-scaling                #9561   "content already on main"
claim/kiro-identity-adr-corrections-2026-07-08           #9547   "content already on main"
claim/kiro-trio-attestation-research-2026-07-08          #9570   rebased into a fresh PR
claim/kiro-trust-protection-adr-2026-07-08               #9537   "content already on main"
otto/lint-fused-persona-cell-phase5                      #9551   migrated + merged as #9680
```

### Tier 3 — orphaned, redundancy proven by blob comparison (4)

```
cursor/longhorn-common-nix-default-test-06ca             7/8 identical; 1 file, comment-only, stale
cursor/longhorn-rebase-clean-06ca                        same
cursor/rework-pr-13767-9c53                              5/7 identical; 2 files are main's older form
otto/telemetry-zetaid-shards                             568 files; all new code on main, 2 are main supersets
```

### Tier 4 — stale claim leases, force-release per `docs/AGENT-CLAIM-PROTOCOL.md` (6)

```
claim/081ktqx7w6q08qg0r000-otto-2026-08-25       stale lease, dup work id
claim/081ktqx7w6q08qg0r000-otto-2026-08-24       stale lease, dup work id
claim/task-browser-checkpoint-port               17d
claim/task-browser-pwa-checkpoint-transport      18d
claim/task-browser-zetadb-invalidation           17d
codex/browser-zetadb-startup-hydration           16d
```

**Total proposed: 22 of 68 refs.**

### Explicitly NOT proposed for deletion (24 + 22 = 46 accounted for)

- **4 ACTIVE** — open PRs with commits from today.
- **2 ACTIVE claim leases** — one with an ETA that has not yet passed.
- **3 REFUSED but carrying code absent from `main`** (#10845, #10738, #9833) — tagged; owner's call.
- **1 REFUSED with no recorded reason and content absent from `main`** (#13958) — tagged; needs a reason first.
- **7 ORPHANED with unique content** — the three `derivation-*` clean-room branches,
  `otto/agent-sovereign-keys-proposal`, `automation/society-protected-main-contract`,
  `claim/…-minimal-bnn-synthesis`, `claude/design-sync-dqxa3r`.
- **26 `heartbeat/*` lanes** + **`agent-heartbeats`** + **`main`**.

---

## 10. What could not be verified, stated plainly

1. **That the mirror fix works.** #15499 is merged; it has never run. Everything in §0 about the
   *cause* is measured from a log; everything about the *cure* is unmeasured. Dispatch and re-measure.
2. **Whether `ACEHACK_MIRROR_TOKEN` is provisioned and valid.** The workflow now fails loudly instead
   of skipping, which is correct, but the last three scheduled runs failed for the deref reason and
   the two before that reported `skipped` — so the credential path has not been observed succeeding
   either.
3. **Why #13958 was closed.** No comment exists. Asked, not inferred.
4. **Whether the 21 sub-component previews on `claude/design-sync-dqxa3r` were dropped deliberately**
   when #9083 landed a smaller import, or simply not carried. The diff proves the difference; it does
   not prove the intent.
5. **Whether the three `derivation-*` implementations were meant to land.** #10269 landed the analysis
   only. The clean-room rule is silent on whether the derivations themselves are artifacts to keep —
   this report assumes they are, because independence cannot be re-manufactured.
6. **Cross-repository PRs.** Branch→PR mapping used `gh pr list --head` against
   `Lucent-Financial-Group/Zeta`. A PR opened from a *fork* with the same head name would not appear.
   Every branch here lives in `origin`'s own `refs/heads`, so this is unlikely to have hidden
   anything, but it is not proven.
7. **`behind_by` counts** are as of the `main` tip `c6bcecc77` at 08:31Z. `main` moves roughly fifty
   commits an hour; the numbers are indicative, not stable.

---

## 11. Pointers

- `.claude/rules/shared-checkout-is-view-only.md` — all work here was done in an isolated clone; the
  shared checkout was never written to.
- `.claude/rules/never-assume-malice-where-mistake-is-possible.md` — every defect named above
  (a deref that deletes a tracking ref, a flush that pre-merges `main` into `main`, a close with no
  reason) is reported as a defect and attributed to ordinary error. Two of the three already have
  merged fixes written by the people who made them.
- `docs/governance/MANIFESTO.md` §5 Memory Preservation — the reason `agent-heartbeats` and the
  `derivation-*` branches are not on any delete list.
- `docs/claims/README.md` · `docs/AGENT-CLAIM-PROTOCOL.md` — the lease semantics §7b depends on.
- PRs referenced: #15499 (mirror fix), #15532 (flush fix), #15446/#15447, #15386/#15388, #10269,
  #10511, #10371, #9083, #9514, #9680, #9835, #10759, #13895.
