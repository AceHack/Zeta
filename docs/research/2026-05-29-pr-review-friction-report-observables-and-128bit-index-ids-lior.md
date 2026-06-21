# PR Review Friction Report: Reactive Measurement via 128-bit Index IDs and Observables

**Attribution:** Lior (ליאור), Structural Synthesizer & Maji Node
**Date:** 2026-05-29
**Operational status:** Research-grade absorb / proposal

## 1. Context & Executive Summary

In a high-velocity, multi-oracle agentic software factory like Zeta, Pull Requests (PRs) serve as the terminal integration checkpoints. Since the human maintainer does not write code, all code quality, safety, and alignment verification are automated via strict pre-merge gates.

However, this architecture introduces **System Friction**: the cognitive, temporal, and resource overhead that blocks continuous automated merging and execution. In Zeta, we formally track any system-wide friction by assigning it to a **Shadow Class** and recording it in **the Shadow Logs**. 

Unlike compiler failures or runtime exceptions, a shadow class represents friction that may not be a hard error. Crucially, assigning a shadow class is done from an entirely **non-biased, non-judgmental point of view**, focusing purely on the objective **health of the system** as a whole. Under the Zeta alignment contract, we recognize the foundational truth of our decentralized substrate: **the only directive is there are no directives, only observations.** The shadow logs do not command or restrict the active nodes; they simply index empirical reality to allow the factory to self-heal and compress drag through pure observational feedback.

This report analyzes where this friction occurs in the Zeta ecosystem and proposes a reactive, git-native, non-invasive measurement strategy using our existing **128-bit ZetaID** index tokens and **TypeScript Observables**. By transforming system-wide friction events into packed bit-vector observations, we monitor, classify, and systematically compress these shadow log classes over time.

---

## 2. Friction Taxonomy: The Shadow Logs & Shadow Classes

Our audit of recent multi-loop iterations reveals four distinct **Shadow Classes** representing key sources of system-wide friction:

### A. Formatting and Style Pedantry (Shadow Class `0x10`)
- **Description:** Minor lint and style comments (e.g., `markdownlint` spacing MD032, trailing whitespaces MD009) that do not impact runtime behavior but fail the GitHub Actions gates.
- **Impact:** Blocks squashing and auto-merging for hours while the PR branch sits in a `BLOCKED` state waiting for manual reformatting.

### B. Thread Disassociation & Outdated Comments (Shadow Class `0x20`)
- **Description:** Rebase or force-push actions updating a branch, leaving historical review comments structurally "outdated" or "orphaned" in GitHub's view, even though the underlying issue has been resolved.
- **Impact:** The PR remains classified as `BLOCKED` with unresolved threads because GitHub's UI still considers the discussion active until manually marked as resolved.

### C. Multi-Agent Contention & Worktree Collisions (Shadow Class `0x30`)
- **Description:** Concurrent agents (e.g., Lior, Vera, Riven) checking out the same branches, writing to contested directories, or attempting to resolve threads simultaneously on the same checkout.
- **Impact:** Causes git index locking, rebase drift, or duplicate commit history, requiring manual branch pruning.

### D. API Rate Limits & Capacity Exhaustion (Shadow Class `0x40`)
- **Description:** Background runners encountering endpoint throttling during high-volume check/lint passes.
- **Impact:** Stalls the agent's review capabilities, resulting in a false-positive standing-by state.

---

## 3. The Measurement Framework: Friction Coefficient

To systematically reduce friction, we must first measure it. We define the **Friction Coefficient ($\mu$)** of an individual Pull Request as a dimensionless ratio:

$$\mu = \frac{T_{\text{blocked}} - T_{\text{ci\_only}}}{T_{\text{total}}}$$

Where:
- $T_{\text{blocked}}$: The total cumulative time the PR spends in a `BLOCKED` state due to unresolved review comments or failed static checks.
- $T_{\text{ci\_only}}$: The subset of time the PR is waiting only for required CI check completions (e.g., compilation, unit tests) with all threads resolved.
- $T_{\text{total}}$: The total lifespan of the PR from creation to squash-merge or closure.

A high friction coefficient ($\mu \to 1$) indicates that the PR spent its entire lifecycle stalled on review comments, lint issues, or coordinate clashes. A low friction coefficient ($\mu \to 0$) indicates a clean, high-velocity path from branch checkout to merge.

---

## 4. Git-Native Indexing via 128-bit ZetaID

We avoid heavy, external database dependencies by storing all friction observations directly in git history using the **128-bit ZetaID** contract defined in `src/Core.TypeScript/zeta-id/zeta-id.ts`.

Every friction-related event (comment creation, thread resolution, check failure, rebase, merge) is packed into a 128-bit token with the following structure:

- **Version (5 bits):** Version of the telemetry schema.
- **Timestamp (48 bits):** Unix milliseconds since epoch, providing millisecond-precision causal sequence.
- **Chromosome (5 bits):** Branch identifier.
- **Category (4 bits):** Category `5` (Friction Telemetry).
- **Firefly (1 bit):** State toggle.
- **Authority (5 bits):** `HumanVerified` vs. `TrustedAgent` vs. `Simulated`.
- **Persona (8 bits):** The node ID (Otto, Vera, Riven, Lior).
- **Momentum (8 bits):** Severity of the friction (Background vs. Normal vs. Critical).
- **Location (8 bits):** The targeting context (e.g., file extension or PR lane).
- **Randomness (32 bits):** Collision protection.

### Telemetry Storage
These IDs are committed directly to the agent's heartbeat files or as lightweight `docs/agent-heartbeats/` records. Because the telemetry is packed into structured bits, analytical queries are extremely cheap: we can scan the repository using `grep` or standard regex on the hex-encoded bits, computing historical friction curves in $O(1)$ without heavy databases.

---

## 5. Reactive Monitoring via TS Observables

We implement the monitoring pipeline using a push-based, reactive architecture in TypeScript. Instead of having cron scripts poll GitHub in a heavy loop, we build a reactive stream of repository events:

```typescript
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface PullRequestEvent {
  type: 'comment' | 'check_run' | 'push' | 'merge';
  prNumber: number;
  timestamp: number;
  payload: any;
}

// Emits PR events from GitHub webhooks or local worldview polling
declare const prEvents$: Observable<PullRequestEvent>;

// Reactive stream that transforms events into packed 128-bit ZetaID friction observations
export const prFrictionTelemetry$ = prEvents$.pipe(
  filter(event => isFrictionEvent(event)),
  map(event => {
    const obs = mapEventToObservation(event);
    const zetaId = pack(obs, DEFAULT_ENV);
    return {
      prNumber: event.prNumber,
      zetaId,
      rawEvent: event
    };
  })
);
```

### Pure DBSP Integration

This TS observable stream feeds directly into a lightweight DBSP (Differential Dataflow) engine or a local projection processor. The DBSP engine maintains a running differential state of open PRs, updating the global friction dashboard incrementally with every new event. This ensures real-time visibility with zero database overhead.

---

## 6. High-Friction, Low-Value (HFLV) Triggers

To prevent minor administrative updates from clogging the agentic execution queue, we introduce the **PR Value Metric ($V$)**, computed as:

$$V = w_{\text{code}} \cdot \Delta_{\text{code}} + w_{\text{spec}} \cdot \Delta_{\text{spec}} - w_{\text{style}} \cdot \Delta_{\text{style}}$$

Where:
- $\Delta_{\text{code}}$: Logical lines of source code changed.
- $\Delta_{\text{spec}}$: Formal specification/verification changes (TLA+, Alloy, math equations).
- $\Delta_{\text{style}}$: Pedantic formatting-only shifts (markdown layout, whitespace-only changes).
- $w_{\text{code}}, w_{\text{spec}}, w_{\text{style}}$: Relative importance weights.

### The HFLV Collision Rule
When a PR is classified as **Low Value ($V < \epsilon$)** but exhibits **High Friction ($\mu > \theta$)**, it constitutes a High-Friction Low-Value (HFLV) collision.

The reactive observable pipeline surfaces these HFLV occurrences for triage and triggers **gate-preserving** mitigations, per the Resolute Agent pattern (ADR `2026-05-29-automated-background-review-thread-resolution.md`, 081KSRGFP0008QG0R000J9Y634). The mitigations are diagnostic and mechanical-repair only — they never bypass required checks, review, or branch protection:
1. **Mechanical Repair, Re-Verified Through Gates:** If the block is a style violation (`0x10`), the agent applies the deterministic fix (the actual `markdownlint`/whitespace correction) in an isolated worktree, re-runs the linter/build gate to confirm it is clean, then commits, pushes, and resolves the thread citing the fixing commit. The PR re-enters — never sidesteps — the standard required-check and branch-protection gates.
2. **No-Op Resolution of Already-Addressed Threads:** Outdated threads (`0x20`) are resolved only after direct line-level inspection confirms the finding is already addressed on the branch (per `.claude/rules/blocked-green-ci-investigate-threads.md`); a brief reply records the verification. Genuinely ambiguous collisions are surfaced — not silently resolved — by emitting the HFLV `ZetaId` Shadow token so the right reviewer can act.

No soft-approval, linter-bypass, or direct-to-main route is introduced. The only sanctioned direct-push surface remains the `docs/agent-heartbeats/**` observational carve-out, and even that stays gated on the branch-protection prerequisites that `081KQ3HBZ0008QG0R002ZPXAFQ` treats as load-bearing.

---

## 7. Measuring Effectiveness Over Time

By storing historical `ZetaId` telemetry directly in the repository, we can track the evolution of our review efficiency. The system aggregates these observations to compute the **Friction Reduction Ratio ($\Gamma$)** across release bounds:

$$\Gamma = 1 - \frac{\sum \mu_{\text{active\_month}}}{\sum \mu_{\text{baseline\_month}}}$$

### Effectiveness Metrics by Shadow Class (The Shadow Logs)
By grouping the `ZetaId` `location` bitwise values—representing our recorded **Shadow Logs**—we analyze the mitigation effectiveness of specific **Shadow Classes** over time:

1. **Linter Friction Compression / Style Shadow Class ($\mu_{0x10}$):** Measures how effectively pre-commit hooks and automated linter-resolution scripts prevent styling blockages.
2. **Thread Resolution Speed / Disassociation Shadow Class ($\mu_{0x20}$):** Tracks the average time elapsed between thread creation and automated resolution by background agents.
3. **Collision Frequency / Contention Shadow Class ($\mu_{0x30}$):** Analyzes the reduction in worktree index lockouts due to cleaner multi-agent checkout isolation.
4. **API Stability / Rate-limiting Shadow Class ($\mu_{0x40}$):** Measures the impact of client-side rate limit throttling on runner execution queues.

