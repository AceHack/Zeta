# ADR: Event-sourced observability and alerting for workflow friction

**Status:** Accepted
**Date:** 2026-05-29
**Backlog:** (none yet — observability substrate; composes with B-0149 (tools/observability Prometheus stack), B-0570 (scarcity/rate-limit tracker → bus), B-0867 (workflow engine). B-0752 reference was a typo — that ID is the past-self-vs-peer distinguisher row.)

## Context & Problem Statement

To optimize our self-modifying workflow Tagged Unions (Agora mode) or GitHub PR loops (Corporate mode), the review and development friction itself must be **observable and programmatically readable** by the agent swarm.

Review friction is defined as metrics such as: linter failures (e.g. `markdownlint` spacing rules), API rate limits (429s), commit-to-merge latencies, comment volumes, and stuck state transitions inside the workflow engine. Currently, this friction is captured only as ephemeral CLI stdout/stderr or local log "weather".

To allow the agent swarm to recursively analyze friction bottlenecks and autonomously iterate/refactor the workflow Discriminated Unions (DUs) to minimize friction, we must convert this telemetry into **durable, event-sourced substrate**.

## Considered Options

* **Option 1: Traditional Telemetry Stack (Prometheus + Grafana + OpenTelemetry)** — Heavy external server infrastructure to collect and visualize active run metrics.
* **Option 2: Git-Native Event-Sourced Telemetry Log** — Append-only, time-ordered observability event files stored directly inside the repository under unique 128-bit IDs, parsed natively by local agents and rendered on our static dashboard.

## Pros & Cons of the Options

### Option 1: Traditional Telemetry Stack

* **Pros:** Standard industry telemetry APIs, rich real-time charting out of the box.
* **Cons:** Massive operational complexity, requires active cloud/server infrastructure, offline agents cannot easily read telemetry without server access, violates our "free-as-shit" and local-sovereignty principles.

### Option 2: Git-Native Event-Sourced Telemetry Log

* **Pros:** 100% free, Git-native, completely readable by offline agents (they just parse local JSON files), zero runtime operational overhead. Integrates perfectly with our 128-bit unique ID and flat append-only event sourcing paradigm.
* **Cons:** Requires adding a lightweight visualizer component to our static `demo/index.html` dashboard to display the metrics.

## Decision Outcome

* **Chosen Option:** Option 2: Git-Native Event-Sourced Telemetry Log, because it makes the system's own development and review friction a first-class, durable, and programmatically queryable dataset within the git event store. This allows agents to run static analysis over `docs/observability/` or local logs, detect friction spikes (e.g., repeating linter halts), and autonomously refactor and optimize the tagged-union state machines to resolve the bottlenecks.
* **Consequences:**
  * **Positive:** Complete self-reflective cybernetic feedback loop. The system measures its own friction, alerts on spikes, and recursively rewrites its own workflow DUs to maximize velocity. Zero operational infrastructure costs.
  * **Negative/Costs:** Incremental append-only write volume inside the Git history (mitigated by highly compressed JSON schema structures).
