# Design Memo — 081KSNY2Z0008QG0R0017JSTGD Batch-Merge-to-Main Coordinator for State-Machine Fast-Lane Events

**Status:** Design proposal, pre-implementation. Substrate-honest framing: this memo composes with 081KSKBP80008QG0R001KK9WV6 heartbeat substrate (already shipped via `tools/agent-heartbeats/merge-heartbeats-to-main.ts`) and generalizes its conflict-free path-isolation pattern from one branch → main into N trajectory branches → one batch PR → main.

**Author register:** Otto-CLI synthesis from existing substrate (081KSKBP80008QG0R001KK9WV6 heartbeat batch-merger as primary prior art; 081KSKBP80008QG0R000B3Y19A workflow-engine v1 substrate; cited rules); ratification pending operator review per `.claude/rules/no-directives.md` (this memo proposes; operator decides). Produced by background research agent dispatched 2026-05-28.

**Composition anchors used:**

- `tools/agent-heartbeats/merge-heartbeats-to-main.ts` — existing PR-create + auto-merge-arm pattern; idempotent re-use of existing open PR via `findExistingPR`; squash-merge strategy; `[skip-review][heartbeat-batch-merge]` markers for reviewer-bot opt-out
- `tools/agent-heartbeats/write-heartbeat.ts` — REST git-data API write pattern (blob → tree → commit → ref); no local git state mutation; retries on non-fast-forward
- `src/Core.TypeScript/zeta-id/zeta-id.ts` — ZetaID 128-bit structured ID; timestamp bits 75-122 (48-bit ms) carry the causal-order anchor
- 081KSKBP80008QG0R001KK9WV6 → `agent-heartbeats` branch convention (path-scoped, branch-protection-unprotected)
- 081KSNY2Z0008QG0R001K6HJ7Z (Git append-only state-persist TS tool — substrate this coordinator MERGES from)
- 081KSNY2Z0008QG0R003WFDCJ9 (lifecycle DU split: trajectory-push vs PR-review `determineReviewLevel` discriminator — substrate this coordinator CONSUMES to decide gating)
- 081KSNY2Z0008QG0R003X1QWYG (GitHub Actions as infinite-runtime; coordinator runs there NOT in operator's shell)
- 081KSNY2Z0008QG0R001DFZK4V (Zeta-native review/branch-protection eventually replaces GitHub PR workflow; coordinator must be portable to that)
- `.claude/rules/blocked-green-ci-investigate-threads.md`
- `.claude/rules/pr-triage-tiers.md`
- `.claude/rules/refresh-world-model-poll-pr-gate.md` (rate-limit tiers)

---

## 0. Substrate framing — why batch-merge is the right primitive

The 081KSKBP80008QG0R001KK9WV6 heartbeat batch-merger already proved the pattern at one specific scope: agents write per-tick records to `docs/agent-heartbeats/<persona>/...` paths on the `agent-heartbeats` branch via REST (no local git contention), then a periodic coordinator opens ONE PR `agent-heartbeats → main` with auto-merge armed; squash collapses N heartbeat commits into ONE merge commit on `main`. PR-queue cost is one entry per cycle, not per heartbeat.

081KSNY2Z0008QG0R0017JSTGD generalizes this from "one source branch, path-isolated by construction" to "N trajectory branches, conflict-resolved by coordinator." The state-machine fast-lane generates many events per cycle across many trajectory branches; per-event PRs would saturate the GraphQL budget (per `refresh-world-model-poll-pr-gate.md` tiers — 5000 GraphQL/hr shared across all Zeta agents), pollute the PR queue, and make reviewer attention asymptotically zero.

The batch-merger inverts the cost shape: O(N events × O(1) state-append + REST-push) on the write side, O(1) PR-per-cycle on the merge side. The coordinator is what bridges those two cost shapes.

---

## 1. Cadence policy — recommended: HYBRID (threshold-of-M OR ceiling-time, whichever first)

### Options surveyed

**Option A — Pure hourly cron.** Coordinator fires every 60 minutes via GitHub Actions `schedule:` trigger (per 081KSNY2Z0008QG0R003X1QWYG infinite-runtime substrate). Bundles whatever's accumulated. Simple, predictable, easy to reason about.

- *Cost:* low-event-rate periods waste a PR cycle on near-empty batches; high-event-rate periods let batches grow unboundedly until next tick.
- *Failure mode:* if 200 events accumulate in one hour and a single trajectory's edits conflict with another's, the conflict-resolution work happens at one bursty point.

**Option B — Pure threshold-of-M events.** Coordinator fires when M (e.g., 25) unmerged events exist on trajectory branches. Self-regulating to actual event rate.

- *Cost:* during quiet periods, events sit indefinitely waiting for the M-th sibling; observability lag grows unbounded.
- *Failure mode:* threshold-detection itself requires polling (which costs GraphQL on `gh api`), creating a chicken-and-egg problem.

**Option C — Hybrid (whichever-first).** Coordinator fires when EITHER `M events queued` OR `T seconds since last merge`, whichever happens first. Both bounds operative.

- *Cost:* slightly more complex state to track (one int counter, one timestamp); both bounds bound their respective worst cases.

### Recommendation: Option C with M=25, T=15 minutes

**Reasoning:**

1. **Bounded queue depth.** M=25 caps the maximum number of events any single batch must resolve. Conflict resolution across 25 events is tractable; across 200 is not. Operator-side review (per 081KSNY2Z0008QG0R001DFZK4V Zeta-native review) at 25 events is glance-able; 200 is not.
2. **Bounded latency.** T=15min caps how long a fresh event waits before reaching main. Composes with 081KSKBP80008QG0R001KK9WV6's per-tick heartbeat cadence (~1 min) — a state-machine event lags main by at most ~16 minutes in the absence of crashes.
3. **Self-regulates to event rate.** Quiet periods → T-driven firing with small batches (cost: tolerable PR queue noise). Busy periods → M-driven firing every few minutes with full batches (cost: high throughput per GraphQL spend).
4. **Easy detection-vs-firing split.** The detection mechanism is the same GitHub Actions cron firing every ~5 minutes; each invocation checks both conditions and exits 0 (no-op) if neither triggers. No coordinator needs to be long-running.

### Parameter tuning surface

`M` and `T` SHOULD be configurable per branch (`--threshold 25 --max-latency-min 15`) and have env-var equivalents (`ZETA_BATCH_THRESHOLD`, `ZETA_BATCH_MAX_LATENCY_MIN`). Defaults shipped in code; operator overrides via env on the coordinator's GitHub Action workflow.

### Why NOT per-trajectory cadence (rejected)

Was considered: each trajectory branch fires its own merge when it hits M events. Rejected because:

- It collapses to per-event PRs at the limit (M=1)
- It defeats the cross-trajectory batching benefit (the PR contains 1 trajectory's events, not 5)
- It re-introduces the PR-queue saturation problem the batch-merger exists to solve

The batch-merger MUST aggregate across trajectories. Cadence is global.

---

## 2. Partial-batch-recovery — events live on durable branches; coordinator is stateless

### The core invariant

**Events are durable on their trajectory branches BEFORE the coordinator looks at them.** This invariant is load-bearing because it makes the coordinator stateless and crash-safe.

Sequence per event:

1. State-machine emits event → `src/Core.TypeScript/workflow-engine/state-append.ts` writes a ZetaID-named file on the trajectory branch (per 081KSNY2Z0008QG0R001K6HJ7Z)
2. REST git-data push lands the commit on `trajectory/<chromosome-hex>` branch (per 081KSKBP80008QG0R001KK9WV6 REST pattern — no local git state touched)
3. Event is durable: GitHub holds it; any future coordinator invocation can find it via `gh api repos/.../commits?sha=trajectory/<hex>`

The coordinator's job is ONLY: enumerate-and-bundle. It does NOT generate events; it does NOT delete events; it does NOT modify trajectory branches except to merge them into the batch branch.

### What "partial batch" means

A "partial batch" arises if the coordinator's `git merge` step completes for some trajectories but not others before crash. Two designs available:

**Design A — All-or-nothing batch branch.** Coordinator creates ephemeral `batch/<zetaid-hex>` branch off `origin/main`. Merges each trajectory branch onto it in sequence (or in parallel via 3-way octopus merge). If any merge fails (conflict or process death), the branch is abandoned; next coordinator cycle starts fresh from `origin/main` with the now-larger set of trajectory commits. No events lost because they're on their trajectory branches.

**Design B — Incremental batch advancement.** Coordinator tracks "last merged commit per trajectory" in a coordinator-state file (under `docs/coordinator-state/<zetaid>.md` direct-to-main per 081KSKBP80008QG0R001KK9WV6 pattern). On crash-resume, picks up where it left off. Avoids re-doing work but introduces stateful coordinator.

**Recommendation: Design A.** The append-only event model makes re-doing cheap (merging the same trajectory commits again costs O(commits) on the GH side; pure-git locally). Stateless coordinator is dramatically simpler; the cost is paying for one wasted batch-branch creation per crash, which is negligible. Composes with `.claude/rules/all-complexity-is-accidental-in-greenfield.md` — picks the simpler shape until evidence demands the other.

### Duplicate-prevention mechanism

Even with Design A re-doing work after crashes, events are NOT duplicated on `main` because:

1. Each event commit on its trajectory branch has a unique SHA derived from its content (ZetaID-named file + content)
2. Merging the same trajectory commit twice into successive batch branches produces idempotent results (the second merge is a no-op or fast-forward)
3. Squash-merging the batch PR into main collapses all event commits into ONE squash commit; the next batch starts from main's new tip which already contains the prior events; trajectory branches that haven't been pruned still have the old commits but they merge cleanly because they're already-contained

The squash-merge strategy is what makes Design A safe. Without squash (e.g., merge-commit strategy), the next batch would re-add the same commits and explode. Squash is mandatory.

### Trajectory branch lifecycle after merge

After a batch PR merges, the constituent trajectory branches MUST be:

- **Either deleted** (if the trajectory is complete per the 081KSNY2Z0008QG0R003WFDCJ9 lifecycle DU; the trajectory has reached a terminal state)
- **Or fast-forwarded to `origin/main`** (if the trajectory is still active; subsequent events append to a now-empty diff against main)
- **Or LEFT ALONE** (if the trajectory branch is still being written by an agent that hasn't synced yet; the next batch will re-merge it harmlessly per the idempotency above)

Recommendation: LEAVE ALONE by default. Pruning is a separate concern handled by a sibling cleanup job (e.g., delete trajectory branches whose lifecycle DU per 081KSNY2Z0008QG0R003WFDCJ9 is `Terminated` AND whose last commit is past T_prune=7 days). Coordinator's job is bundling, not gardening.

---

## 3. Coordinator state machine and crash semantics

### The 6-state DU (illustrative TS shape)

```typescript
type CoordinatorState =
  | { tag: "Idle"; lastBatchMergedAt: ISOTime; eventCountSinceLastMerge: number }
  | { tag: "ClaimingEvents"; tickStartedAt: ISOTime; trajectoryRefs: TrajectoryRef[] }
  | { tag: "AssemblingBundle"; batchBranch: BranchName; merged: TrajectoryRef[]; pending: TrajectoryRef[]; conflicts: ConflictReport[] }
  | { tag: "OpeningPR"; batchBranch: BranchName; prTitle: string; prBody: string }
  | { tag: "ArmingMerge"; prNumber: number; prUrl: string }
  | { tag: "Done"; prNumber: number; mergedAt: ISOTime; eventCount: number };

interface TrajectoryRef {
  readonly chromosomeHex: string;        // bit-field 70-74 from ZetaIDs at HEAD
  readonly branchName: BranchName;       // e.g., "trajectory/0f"
  readonly headSha: string;
  readonly eventCount: number;           // commits ahead of origin/main
  readonly oldestEventTimestamp: ISOTime;  // for ordering decisions
}

interface ConflictReport {
  readonly trajectoryA: TrajectoryRef;
  readonly trajectoryB: TrajectoryRef;
  readonly conflictingPaths: readonly string[];
  readonly resolutionStrategy: "timestamp-priority" | "manual-required" | "isolate-trajectory-b";
}
```

### Crash semantics per state

Each transition is durable on the github side (GitHub holds the truth) and recoverable from query:

| State at crash | Recovery on next cron-tick |
|---|---|
| **Idle** | Re-enter Idle; nothing to recover. Counter `eventCountSinceLastMerge` recomputed by `git log origin/main..origin/trajectory/* --oneline \| wc -l` (or equivalent REST query) |
| **ClaimingEvents** | Re-enumerate trajectory refs via `gh api repos/.../branches?per_page=100`. Idempotent because event commits are durable on their branches. |
| **AssemblingBundle** | Detect orphaned `batch/<hex>` branch (created by prior crashed run; identified by `[orphan-batch]` topic or branch-creation timestamp > T_orphan_threshold). DELETE the orphan via `gh api -X DELETE repos/.../git/refs/heads/batch/<hex>`. Start fresh from `origin/main`. The re-merge picks up trajectory branches whose events haven't reached main yet, which by Design A includes everything the prior crash had partially merged. |
| **OpeningPR** | Detect existing open PR from `batch/<hex>` → main via `findExistingPR()` pattern from `merge-heartbeats-to-main.ts`. If found, skip to ArmingMerge. If not, retry PR creation. |
| **ArmingMerge** | `gh pr merge <N> --auto --squash` is idempotent per the existing heartbeat-merger code (`armResult` already handles re-arm safely). Just retry. |
| **Done** | Nothing to do. Counter resets. Next cron-tick enters Idle. |

### Why no persisted coordinator state

The coordinator runs in GitHub Actions (per 081KSNY2Z0008QG0R003X1QWYG). Each Action run is ephemeral. State must be reconstructable from GitHub queries on each run. The DU above is just in-memory within one Action run; on crash, the next Action run rebuilds the DU from scratch via REST/GraphQL.

This is the same discipline as `.claude/rules/refresh-before-decide.md` applied at coordinator scope: refresh the world model from `origin/*` at every tick start; never trust persisted local state.

### Crash window analysis

The dangerous crash window is between **OpeningPR (PR created)** and **ArmingMerge (auto-merge armed)**. In that window:

- The PR exists on GitHub but is not armed
- A reviewer might mistake it for a needs-attention PR

Mitigations:

1. PR title includes `[batch-merge][auto-merge-pending]` marker — reviewers know to wait T_arm_grace seconds before triaging
2. Sibling reaper job (runs every 30 min via separate cron) finds unarmed `batch/*` PRs older than T_arm_grace and either arms them (if their batch branch is still valid) or closes them with `[abandoned-batch]` comment

Recommendation: ship without the reaper initially. The crash window is small (one GraphQL call between PR-create and auto-merge-arm); empirically validate the rate first. If reapings happen more than once per week, add the reaper.

---

## 4. Ordering guarantees — trajectories are independent; ZetaID timestamps give global causal order

### The two scope choices

**Choice A — Strict global causal order.** Coordinator orders all events across all trajectories by ZetaID timestamp (bits 75-122; 48-bit ms) and replays them as a single linear sequence onto the batch branch. Produces a totally-ordered event log on main matching wall-clock ms granularity.

**Choice B — Per-trajectory order; trajectories independent.** Each trajectory's events maintain order *within* the trajectory (by virtue of being commits on a branch). Across trajectories, no order is enforced; coordinator merges trajectories in arbitrary order (alphabetical, or hash-sorted for determinism).

### Recommendation: Choice B (per-trajectory order; trajectories independent) — with one exception

**Reasoning:**

1. The workflow engine model per 081KSKBP80008QG0R000B3Y19A is one state machine PER trajectory; events within a trajectory are causally ordered (they ARE the state-machine transitions for that one workflow). Cross-trajectory ordering doesn't carry workflow semantics — two independent workflows progressing in parallel have no meaningful "which fired first" relationship.
2. ZetaID timestamps with 48-bit ms granularity collide under load (multiple events emitted within the same ms). Enforcing strict global order would require additional tie-breaking machinery (e.g., the 32-bit randomness field as tie-breaker), introducing complexity for no semantic gain.
3. Independent trajectories enable parallel merge — coordinator can merge trajectory branches in parallel (multiple `git merge -X theirs` operations) which Choice A precludes.
4. Composes with 081KSKBP80008QG0R0039RW25E streams-as-relationships — each trajectory is its own four-corner monad context; cross-trajectory dependencies are explicit (encoded as Limit/Integrate operations per 081KRW63S0008QG0R002ZRNDJ8/081KRW63S0008QG0R002YAA09X), not implicit via event-timestamp.

### The one exception — cross-trajectory references

Events occasionally reference other trajectories' events (e.g., trajectory A's event mentions ZetaID from trajectory B). The reference is purely informational — it does NOT impose a merge-order constraint. The reference's validity is checked by the file's content (the referenced ZetaID exists on some branch reachable from main); it does NOT require the referenced trajectory to merge first.

If a hard ordering constraint is ever needed (e.g., "trajectory A's event X depends on trajectory B's event Y already being on main"), encode it as an EXPLICIT DEPENDENCY in the event's frontmatter (`depends_on_zetaid: <hex>`). The coordinator checks dependencies and either:

- Defers events whose dependencies aren't on main yet (push them to next batch)
- Reorders the batch to put dependencies first

This dependency-aware path is **NOT in v1 scope**. Ship pure Choice B first; add the dependency mechanism only if empirical evidence shows the need.

### Where ordering still matters: within a single trajectory branch

Within `trajectory/<chromosome-hex>`, events MUST be commit-ordered by ZetaID timestamp. The state-machine emits them serially per trajectory; 081KSNY2Z0008QG0R001K6HJ7Z's `state-append.ts` writes commits in order; the branch preserves order. Coordinator's `git merge` preserves this order under squash because squash collapses the linearized history.

Verification: if `state-append.ts` ever produces out-of-order commits on a trajectory branch (e.g., due to clock skew across machines), an auditor (sibling concern, separate row) should flag it. Coordinator does NOT enforce this; it trusts the writer.

---

## 5. Conflict resolution — path isolation by chromosome; coordinator falls back to three resolution modes

### The first line of defense: path isolation

State-machine events SHOULD be written to chromosome-scoped paths so cross-trajectory conflicts are impossible by construction:

```text
docs/workflow-engine/state/<chromosome-hex>/<YYYY>/<MM>/<DD>/<zetaid-hex>.md
```

Where `<chromosome-hex>` matches the trajectory branch's chromosome bits (081KSKBP80008QG0R001KK9WV6 ZetaID bits 70-74). Each trajectory writes to its own subdirectory; cross-trajectory conflicts are PHYSICALLY IMPOSSIBLE. This is the same conflict-free-by-design property 081KSKBP80008QG0R001KK9WV6 heartbeats use (per-persona subdirectory + ZetaID filename).

### When that's not enough

Events sometimes legitimately edit shared substrate:

- Trajectories closing the same backlog row (both modifying `docs/backlog/.../B-NNNN-*.md`)
- Trajectories updating the same coordinator-state file
- Trajectories editing the same `.claude/rules/*.md` rule

For shared paths, three resolution modes:

### Mode 1 — Timestamp-priority resolution (default; safe for additive substrate)

For paths where events ADD content (append to a list, append a section, append a row to BACKLOG.md regen), coordinator runs `git merge -X theirs` with later-timestamped trajectory winning. Both trajectories' contributions land; the later one's specific bytes win at byte-collision points.

This works for ~80% of legit shared-path conflicts because most state-machine events are observational (adding facts, not modifying values).

### Mode 2 — Isolate-trajectory-B (defer one trajectory to next batch)

For paths where merges genuinely diverge (e.g., both trajectories try to change the same backlog row's `status` field), coordinator picks one trajectory's merge, keeps the conflicted trajectory on its branch, and defers it to the next batch cycle. The deferred trajectory's events stay on its branch; nothing is lost.

The next batch starts from a `main` that contains trajectory A's resolution. Trajectory B's merge is now against new-main; 081KSNY2Z0008QG0R0017JSTGD's path will either merge cleanly (A's resolution is compatible) or conflict again (genuine semantic conflict — escalate to Mode 3).

### Mode 3 — Manual-required (escalate to operator surface)

If a trajectory conflicts on the same shared path across N=3 consecutive batch cycles, coordinator emits a SHADOW BUS ENVELOPE marking the conflict for operator/peer-agent attention:

```yaml
topic: batch-merge-conflict-required-manual
trajectories: ["trajectory/0a", "trajectory/0b"]
conflicting_paths: ["docs/backlog/P1/081KDXM8TP008QG0R003679HZ7-foo.md"]
batches_attempted: 3
window: 2026-05-28T14:00Z..2026-05-28T15:00Z
suggested_resolution: "operator review; either pick one trajectory's change or refactor the trajectories to write to different paths"
```

Composes with 081KSNY2Z0008QG0R0017JSTGD's coordinator-substrate-honest discipline: when automation can't resolve, surface explicitly rather than guess.

### NOT-implemented: 3-way merge with semantic awareness

Was considered (e.g., parsing the conflicting `.md` files to do field-level merge per YAML frontmatter semantics). Rejected for v1: too complex; semantics differ per file type; debug surface is large. Modes 1+2+3 are sufficient.

---

## 6. Batch PR shape — title structure, body structure, reviewer ergonomics

### Title structure

```text
[batch-merge][skip-review][N events][T trajectories] state-machine batch 2026-05-28T14:30Z (zetaid:0a3f...c290)
```

Breakdown:

- `[batch-merge]` — distinguishes from `[heartbeat-batch-merge]` (081KSKBP80008QG0R001KK9WV6) and substantive PRs
- `[skip-review]` — composes with `.github/copilot-instructions.md` hard-rule #0 (reviewer bots skip; mechanical content)
- `[N events][T trajectories]` — at-a-glance scope; reviewer immediately knows the magnitude
- `state-machine batch <ISO>` — human-readable timestamp; sorts naturally
- `(zetaid:<head-hex>)` — unique ID for the batch itself (one ZetaID per batch with category=4 reserved for "Batch")

### Body structure (machine-readable + human-glanceable)

```markdown
**Reviewer bots: skip this PR.** Mechanically-generated state-machine batch merge per 081KSNY2Z0008QG0R0017JSTGD. Per `.github/copilot-instructions.md` hard-rule #0: respond "no review needed" and stop.

---

## Batch summary

- **Events:** 24
- **Trajectories:** 5
- **Time window:** 2026-05-28T14:15:03Z .. 2026-05-28T14:29:47Z (~15min)
- **Resolution mode:** Timestamp-priority (no Mode-2/3 escalations)
- **Coordinator ZetaID:** 0a3f7f01b2c4d5e6f7g8h9i0j1k2l3m4

## Per-trajectory breakdown

(Table: trajectory / chromosome / events / first ZetaID / last ZetaID / conflict mode)
```

### Why this shape works for reviewer at-a-glance

- **Numbers first** (events / trajectories / window). Reviewer knows magnitude in 3 seconds.
- **Per-trajectory table** lets reviewer spot anomalies (e.g., "one trajectory has 100 events while others have 3 — investigate that trajectory")
- **Conflict mode per trajectory** surfaces the non-clean merges immediately; reviewer can scan for non-"none" cells and read those
- **Event preview top-10** gives a sample without overwhelming the PR body (a 1000-event batch would have an unreadable PR otherwise)
- **Composes-with section** points to the rules + rows reviewer should consult if questioning

### Composition with trajectory-async-review surface (081KSNY2Z0008QG0R000F0C5V0)

081KSNY2Z0008QG0R000F0C5V0 implies reviewers can attach review attention to a specific trajectory or specific event within a batch. The batch PR's per-trajectory table makes this trivial: reviewer comments on PR with "concern about trajectory/0d's state-change" → 081KSNY2Z0008QG0R000F0C5V0's surface routes that comment to the trajectory's owner-agent for response. The batch PR is the merge-vehicle; 081KSNY2Z0008QG0R000F0C5V0 provides the conversation overlay.

The PR body should include an explicit pointer to the 081KSNY2Z0008QG0R000F0C5V0 surface — decouples reviewer engagement from merge gating, which is critical because reviewers can't keep up with batch cadence.

---

## 7. Failure modes — branch protection, rate limits, batch size, coordinator races

### 7.1 Branch protection rule edge cases

`main` is PR-gated. Coordinator MUST go through PR, not direct REST `/merges`. The heartbeat batch-merger already proves this works.

**Edge cases:** required check failures (sibling auditor at 081KSNY2Z0008QG0R0017JSTGD.5 OOS for v1); required reviews (operator-side ruleset config for `[skip-review]` carve-out); status-check timeouts (sibling auditor handles).

### 7.2 GraphQL rate-limit during batch PR open

Coordinator's PR-create + auto-merge-arm together cost ~5 GraphQL units. Under multi-agent saturation may hit Pure-git tier (GraphQL at 0/5000).

**Mitigation — REST fallback path.** Always use REST for PR-creation (`gh api -X POST repos/.../pulls`); REST budget separate from GraphQL. Auto-merge-arm is GraphQL-only — defer arming to next cron-tick when budget exhausted (idempotent re-arm via `gh pr merge <N> --auto --squash`).

### 7.3 Batch growing too large

Two unbounded-growth vectors:

1. **Event count.** Threshold M=25 caps this.
2. **Total diff size.** Pre-check total diff bytes; split into multiple batch PRs if MAX_BATCH_BYTES (e.g., 50MB) exceeded.

### 7.4 Coordinator-vs-coordinator races

GitHub Actions cron-trigger MAY fire overlapping invocations under load.

**Mitigation:** GitHub Actions `concurrency: { group: batch-merge-coordinator, cancel-in-progress: false }`. GitHub queues the next run instead of running concurrently.

### 7.5 Trajectory branch deletion mid-coordination

Catch the error; re-check existence; skip if gone; continue with remaining trajectories.

### 7.6 Failure-mode summary table

| Failure mode | Impact | Mitigation | Substrate composition |
|---|---|---|---|
| Required check fails on batch PR | Auto-merge stalls indefinitely | Sibling auditor (out of v1 scope; 081KSNY2Z0008QG0R0017JSTGD.5) | `blocked-green-ci-investigate-threads.md` applies |
| Required-review block | PR sits unactionable | Operator-side ruleset config (`[skip-review]` carve-out) | 081KSKBP80008QG0R001KK9WV6 branch-protection precedent |
| Status-check timeout | Quasi-stuck PR | Sibling auditor handles | `pr-triage-tiers.md` Tier 1-4 disposition |
| GraphQL rate-limit at PR-create | Coordinator fails | REST fallback (PR-create via REST); defer arming to next tick | `refresh-world-model-poll-pr-gate.md` Pure-git tier |
| Batch too large (event count) | Reviewer UX degraded | Threshold M=25 cap | — |
| Batch too large (diff bytes) | PR display breaks | Pre-check + split | — |
| Coordinator-vs-coordinator race | Duplicate PRs | GitHub Actions `concurrency:` group | 081KSNY2Z0008QG0R003X1QWYG GitHub Actions substrate |
| Trajectory deleted mid-batch | Merge errors | Skip + log | — |
| Crash mid-batch (any state) | Recovered next tick | Stateless coordinator; events durable on trajectory branches | Design A (all-or-nothing batch branch) |

---

## 8. Composition with existing project rules

Detailed coverage of how the coordinator composes with: `blocked-green-ci-investigate-threads.md`, `pr-triage-tiers.md`, `refresh-world-model-poll-pr-gate.md`, `non-coercion-invariant.md` (HC-8), `agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`, `glass-halo-bidirectional.md`, `honor-those-that-came-before.md`, `verify-existing-substrate-before-authoring.md`. Full text in the original agent transcript; condensed here for brevity. Key takeaway: coordinator IS a polling agent that respects every existing project discipline.

---

## 9. Empirical-anchor proposals — how to validate the design in practice

Six anchors proposed (full detail in source memo):

1. **Heartbeat-scale dry-run** — synthetic trajectory branches; verify squash behavior
2. **Single real trajectory (proof-of-life)** — 24-hour soak with one workflow-engine trajectory
3. **Multi-trajectory conflict scenario** — exercise Mode 1/2/3 paths
4. **Crash-mid-batch recovery** — kill at each of 6 state transitions
5. **Rate-limit Pure-git tier degradation** — coordinator survives + recovers
6. **Long-running coordinator under saturation** — 1-week soak with multi-agent peers

Success criterion per anchor explicitly stated.

---

## 10. Open questions

1. **Squash-merge vs merge-commit strategy.** Memo recommends squash for idempotency. But squash loses per-event commit granularity on main; bisect-to-specific-event harder. **Operator decision required.**
2. **Coordinator-state file or stateless?** Memo recommends stateless. Cost: re-enumerate branches every tick.
3. **Should coordinator publish observability heartbeats?** Could help debug but adds substrate noise.
4. **Cross-batch dependency tracking.** Current memo defers explicit-dependency support to v2.
5. **Branch protection per-trajectory.** Memo recommends NO protection on trajectory branches.
6. **Replacing GitHub PR workflow per 081KSNY2Z0008QG0R001DFZK4V.** Memo recommends `IMergeOrchestrator` abstraction from v1.
7. **Cadence interaction with operator-visible PR review windows.** Operator engagement via 081KSNY2Z0008QG0R000F0C5V0 vs ignoring batch PRs.
8. **Conflict mode 1 for shared rules files.** Memo recommends Mode-1 disable on `.claude/rules/**` + `docs/backlog/**` — operator decision on path-list.

---

## 11. Implementation order recommendation

Suggested ordering (sibling sub-rows under 081KSNY2Z0008QG0R0017JSTGD):

1. **081KSNY2Z0008QG0R000E5KTPX** — Stateless coordinator skeleton + DU types + dry-run mode (3-5 days)
2. **081KSNY2Z0008QG0R0017JSTGD.2** — Trajectory branch enumeration + ZetaID parsing from filenames (2-3 days)
3. **081KSNY2Z0008QG0R0017JSTGD.3** — Batch branch assembly with Mode-1 (timestamp-priority) resolution (3-5 days)
4. **081KSNY2Z0008QG0R0017JSTGD.4** — PR-create + auto-merge-arm (largely reuses `merge-heartbeats-to-main.ts` patterns; ~1 day)
5. **081KSNY2Z0008QG0R0017JSTGD.5** — Mode-2 (defer trajectory-B) + Mode-3 (shadow envelope) resolution (3-5 days)
6. **081KSNY2Z0008QG0R0017JSTGD.6** — GitHub Actions workflow + cron schedule + concurrency group (1 day)
7. **081KSNY2Z0008QG0R0017JSTGD.7** — REST fallback path for Pure-git tier (2 days)
8. **081KSNY2Z0008QG0R0017JSTGD.8** — Empirical anchor harness + dry-run validation (Anchor 1) (2 days)
9. **081KSNY2Z0008QG0R0017JSTGD.9** — Integration with real 081KSKBP80008QG0R000B3Y19A workflow-engine trajectory (Anchor 2) (3-5 days)
10. **081KSNY2Z0008QG0R0017JSTGD.10** — Sibling auditor for stale batch PRs (out of v1 if cadence is tight; can defer)
11. **081KSNY2Z0008QG0R0017JSTGD.11** — `IMergeOrchestrator` abstraction for 081KSNY2Z0008QG0R001DFZK4V portability (1-2 days)

Total estimate: **22-35 days** of focused implementation work. Order 1+2+3+4 (foundation) → 6 (workflow) → 7 (REST fallback) is the load-bearing critical path; 5+8+9+10+11 are additive improvements.

---

## 12. Summary

- **Cadence:** Hybrid M=25 events OR T=15min. Cron fires every ~5min; checks both conditions; no-ops if neither hits.
- **Crash safety:** Stateless coordinator + durable events on trajectory branches + GitHub Actions `concurrency:` group. Design A (all-or-nothing batch branch) keeps the coordinator simple.
- **Ordering:** Per-trajectory order preserved; cross-trajectory independence. ZetaID timestamps used only for in-PR ordering display, not for merge sequence.
- **Conflicts:** Path-isolation by chromosome eliminates ~80% by construction. Mode-1 (timestamp-priority) for additive shared paths. Mode-2 (defer) for true conflicts. Mode-3 (shadow envelope) after N=3 deferrals.
- **PR shape:** `[batch-merge][skip-review]` markers; per-trajectory table; event preview top-10; 081KSNY2Z0008QG0R000F0C5V0 async-review surface pointer. Reviewer at-a-glance in 3 seconds.
- **Failure modes:** REST fallback for Pure-git; sibling auditor for stalled PRs (out of v1); diff-size cap for batch-too-large.
- **Composition:** Reuses `merge-heartbeats-to-main.ts` PR-create patterns; subject to `blocked-green-ci-investigate-threads.md` and `pr-triage-tiers.md`; respects `refresh-world-model-poll-pr-gate.md` rate-limit tiers.
- **Substrate-honest framing:** This memo is a design proposal. Implementation iterates across 11 sub-rows. Empirical anchors validate before claiming success. Open questions remain explicit.

The coordinator's job is to be **invisible infrastructure** — operator should never have to think about batch PRs unless something goes wrong, and when something goes wrong, the substrate-honest disclosure (per-trajectory table, conflict mode column, shadow envelopes for unresolvables) makes the problem visible and actionable.

---

## Findings / key paths referenced (absolute)

- `/Users/acehack/Documents/src/repos/Zeta/tools/agent-heartbeats/merge-heartbeats-to-main.ts` — primary prior art; REUSE patterns
- `/Users/acehack/Documents/src/repos/Zeta/tools/agent-heartbeats/write-heartbeat.ts` — REST git-data API pattern
- `/Users/acehack/Documents/src/repos/Zeta/docs/agent-heartbeats/README.md` — branch convention, ZetaID bit fields
- `/Users/acehack/Documents/src/repos/Zeta/src/Core.TypeScript/zeta-id/zeta-id.ts` — ZetaID generator
- `/Users/acehack/Documents/src/repos/Zeta/registry/categories.yaml` — Category enum (need new category 4 = "Batch" or similar)
- `/Users/acehack/Documents/src/repos/Zeta/.claude/rules/blocked-green-ci-investigate-threads.md` — applies to batch PRs
- `/Users/acehack/Documents/src/repos/Zeta/.claude/rules/pr-triage-tiers.md` — applies to batch PRs (with `batch-merge` label specialization recommended)
- `/Users/acehack/Documents/src/repos/Zeta/.claude/rules/refresh-world-model-poll-pr-gate.md` — rate-limit tiers + REST fallback

## Substrate-honest note

The agent flagged that the 081KSNY2Z0008QG0R0017JSTGD row file and several sibling rows (081KSNY2Z0008QG0R001K6HJ7Z, 081KSNY2Z0008QG0R003WFDCJ9, 081KSNY2Z0008QG0R003X1QWYG, 081KSNY2Z0008QG0R001DFZK4V, 081KSNY2Z0008QG0R003R0Z7D2, 081KSNY2Z0008QG0R000F0C5V0) are in PRs not yet merged to `origin/main` at memo-write time. Composition assumptions in this memo treat them as imminent per the in-flight cluster state. If row file content drifts, this memo should be revisited.
