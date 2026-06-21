# ADR: Monitoring and Reducing PR Review Friction via 128-bit Index IDs and TS Observables

**Status:** accepted
**Date:** 2026-05-29
**Backlog:** 081KSRGFP0008QG0R000J9Y634

## Context & Problem Statement

Zeta operates as a substrate-honest, multi-loop agentic software factory. Because all code changes undergo automatic build, linter, and specification gates, Pull Request (PR) review threads and transient check failures are first-class execution signals.

However, resolving review comments represents a significant source of operational friction. Outdated threads, minor formatting violations, or coordinate clashes block auto-merges, leading to rebase delays and stalled queues.

To track and address this systemic drag objectively, we classify these friction vectors under a **Shadow Class** within **the Shadow Logs**. Crucially, assigning a shadow class is done from an entirely **non-biased, non-judgmental point of view**, focusing purely on the objective **health of the system** as a whole. Under the Zeta alignment contract, we recognize the foundational truth of our decentralized substrate: **the only directive is there are no directives, only observations.** A shadow class identifies drag and queue latency without casting judgment or prescribing top-down command directives, serving as a clean, purely diagnostic system-health metric.

Currently, we have no systematic, structured method to monitor PR review friction over time. Our background scripts only poll the PR queue state to classify current action (e.g., `resolve-threads` in `poll-pr-gate.ts`), but we lack a historical analytical pipeline to measure the duration and cause of these blockages.

The problem is: how do we implement a lightweight, git-native, real-time monitoring architecture to observe, classify, and systematically mitigate PR review friction over time, without introducing heavy databases or manual scraping overhead?

## Considered Options

* **Option 1: Polling-based Manual Telemetry (Status Quo)** — Occasionally run cron scripts that query the GitHub REST API, parse JSON payloads, compute average merge durations, and dump static text files.
* **Option 2: Reactive Push-based Observable Monitoring via 128-bit Index IDs** — Establish a push-based event observer stream in TypeScript (using observables) that consumes GitHub webhooks or worldview events. Each PR event is mapped to a canonical 128-bit `ZetaId` observation committed to git-native telemetry logs, allowing $O(1)$ bit-level indexing and real-time Differential Dataflow (DBSP) projection of the Friction Coefficient ($\mu$).

## Pros & Cons of the Options

### Option 1: Polling-based Manual Telemetry

* **Pros:** Simpler initial implementation; requires no modifications to the existing `ZetaId` bit-packing code.
* **Cons:** High computational and API rate limit overhead; does not scale; lacks real-time responsiveness; telemetry is stored in heavy, raw JSON rather than a compressed, git-native indexing format.

### Option 2: Reactive Push-based Observable Monitoring via 128-bit Index IDs

* **Pros:**
  * **Real-time Observability:** Built-in push streams process events instantly, updating the dashboard incrementally with zero lag.
  * **Compressed, Git-Native Telemetry:** Storing friction events as hex-encoded 128-bit `ZetaId` tokens inside git history provides built-in durability, cryptographically verifiable provenance, and zero database dependency.
  * **High-Speed Telemetry Indexing:** Telemetry can be parsed and queried in $O(1)$ by bit-masking the `ZetaId` components (persona, Category=5, momentum, location, timestamp).
* **Cons:**
  * **Implementation Complexity:** Requires building a reactive observable pipeline in TypeScript and integrating it with the local worldview poller.
  * **Telemetrical Footprint:** Small commits are introduced to record the telemetry tokens on the `agent-heartbeats` branch or in-repo logs.

## Decision Outcome

* **Chosen Option:** Option 2: Reactive Push-based Observable Monitoring via 128-bit Index IDs, because it provides real-time, low-overhead telemetry that composes cleanly with our existing `ZetaId` bit-packing architecture and our commitment to substrate-honesty.

### Consequences & Telemetry Mapping

1. **Category Mapping:** Enlist Category `5` in `registry/categories.yaml` as `FrictionTelemetry` (canonically accumulating in **the Shadow Logs**).
2. **Location Mapping:** Use the 8-bit `location` field of `ZetaId` to encode the friction type as a specific **Shadow Class** (capturing non-error system friction):
   - `0x10`: Style/Linter Shadow Class (markdownlint, eslint).
   - `0x20`: Thread-outdated/Orphaned comment Shadow Class.
   - `0x30`: Worktree/index coordinate collision Shadow Class.
   - `0x40`: API rate limit (429) Shadow Class.
3. **Reactive Integration:** Pipe the worldview poller's PR checks and thread count directly into a TS observable stream, generating these `ZetaId` tokens automatically on each tick.
4. **HFLV Thresholds & Gate-Preserving Mitigations:** The telemetry runner classifies High-Friction Low-Value (HFLV) PR occurrences ($V < \epsilon$ and $\mu > \theta$) and surfaces them for triage. Mitigation is limited to mechanical repair re-verified through gates and no-op resolution of already-addressed outdated threads, per the Resolute Agent pattern (ADR `2026-05-29-automated-background-review-thread-resolution.md`, 081KSRGFP0008QG0R000J9Y634): the agent applies the deterministic fix, re-runs the build/linter gate, then resolves the thread citing the fixing commit. Required checks, review, and branch protection are never bypassed; the only sanctioned direct-push surface remains the `docs/agent-heartbeats/**` carve-out pending the `081KQ3HBZ0008QG0R002ZPXAFQ` branch-protection prerequisites.
