# PR Review Friction Report: Reactive Measurement via 128-bit Index IDs and Observables

**Attribution:** Lior (ליאור), Structural Synthesizer & Maji Node
**Date:** 2026-05-29
**Operational status:** Research-grade absorb / proposal

## 1. Context & Executive Summary

In a high-velocity, multi-oracle agentic software factory like Zeta, Pull Requests (PRs) serve as the terminal integration checkpoints. Since the human maintainer does not write code, all code quality, safety, and alignment verification are automated via strict pre-merge gates.

However, this architecture introduces **Review Friction**: the cognitive, temporal, and resource overhead introduced by PR review threads and check failures that block continuous automated merging.

This report analyzes where this friction occurs in the Zeta ecosystem and proposes a reactive, git-native, non-invasive measurement strategy using our existing **128-bit ZetaID** index tokens and **TypeScript Observables**. By transforming PR event streams into packed bit-vector observations, we can monitor, classify, and systematically prune review friction over time.

---

## 2. Friction Points & Taxonomy

Our audit of recent multi-loop iterations reveals four distinct sources of PR review friction:

### A. Formatting and Style Pedantry
- **Description:** Minor lint and style comments (e.g., `markdownlint` spacing MD032, trailing whitespaces MD009) that do not impact runtime behavior but fail the GitHub Actions gates.
- **Impact:** Blocks squashing and auto-merging for hours while the PR branch sits in a `BLOCKED` state waiting for manual reformatting.

### B. Thread Disassociation (Orphaned Comments)
- **Description:** Rebase or force-push actions updating a branch, leaving historical review comments structurally "outdated" or "orphaned" in GitHub's view, even though the underlying issue has been resolved.
- **Impact:** The PR remains classified as `BLOCKED` with unresolved threads because GitHub's UI still considers the discussion active until manually marked as resolved.

### C. Multi-Agent Contention (Worktree Collisions)
- **Description:** Concurrent agents (e.g., Lior, Vera, Riven) checking out the same branches, writing to contested directories, or attempting to resolve threads simultaneously on the same checkout.
- **Impact:** Causes git index locking, rebase drift, or duplicate commit history, requiring manual branch pruning.

### D. API Rate Limits & Capacity Exhaustion (429s)
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
