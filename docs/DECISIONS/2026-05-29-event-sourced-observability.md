# ADR: Event-sourced observability and alerting for workflow friction

**Status:** Accepted
**Date:** 2026-05-29
**Backlog:** (none yet — observability substrate; composes with 081KQGDBJ0008QG0R0035TQVBQ (tools/observability Prometheus stack), 081KRQ1AB0008QG0R002422Z9Q (scarcity/rate-limit tracker → bus), 081KSKBP80008QG0R000B3Y19A (workflow engine). 081KSE6WT0008QG0R000E05579 reference was a typo — that ID is the past-self-vs-peer distinguisher row.)

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

## Addendum (2026-05-31): the LGTM stack, git-native — metrics are a Bag-fold over the event G-Set

Option 2 is not just "a cheaper Prometheus." Once telemetry is a ZetaId-keyed,
append-only **event G-Set** (the same paradigm as the *in-flight* agent-bus — 081KSXN940008QG0R00171YAZW,
Phase 1 landing in #6283, *targeted at* `docs/agent-bus/`; the friction log *planned at*
`docs/observability/` — neither directory existed on `main` as of this 2026-05-31
addendum), the entire Grafana
**LGTM** stack falls out as *folds over that one event store* — "LGTM for git-native":

| LGTM (Grafana) | git-native equivalent | how |
|---|---|---|
| **L**oki (logs) | the event files themselves | each ZetaId-keyed JSON event IS a structured log line |
| **G**rafana (dashboards) | the static `demo/index.html` renderer | renders the folds, no server |
| **T**empo (traces) | ZetaId correlation across events | a causal chain of related ZetaIds = a trace/span tree |
| **M**imir (metrics) | a **Bag-fold** (`group-by key → count`) over the event G-Set | counts/rates/histograms are a derived view, not stored aggregates |

The metrics rung is the load-bearing part: **a metric is a Bag** — the middle rung of
the G-Set / Bag / Z-set ladder (see the
[bus↔Ace synthesis](../research/2026-05-31-bus-and-ace-one-git-native-zetaid-zset-substrate-gset-comms-vs-dependency-zset.md)).
You don't *store* the counts; you **fold** them on read:

```text
event G-Set (stored)  →  group-by key → count  →  the metric (Bag, derived view)
```

Because the base is append-only, multiplicities only grow — exactly the Bag property
(ℕ-valued, no retraction).

### Why this is strictly better than the rejected Prometheus stack (not just cheaper)

The original con was only "needs a visualizer." The deeper win is four properties the
traditional stack cannot give at once:

* **Exact, not sampled** — every event is a file; the count is the true count (Prometheus samples + downsamples).
* **Time-travel** — fold a metric *as of any commit*: `metric@HEAD`, `metric@<3d-ago>`, `diff(metric@A, metric@B)` = what changed. The append-only git history IS the TSDB.
* **Cross-machine-correct** — read the fold from `origin/main` and it reflects the merged G-Set across every machine, conflict-free (CRDT union); no central scrape target.
* **Ray-traceable** — drill from any count straight back to the source event files (glass-halo); the metric and its evidence are the same substrate.

This is the lightlike-observability framing made concrete — *"Prometheus is the
curvature meter"* becomes *"the Bag-fold is the curvature meter."*

### Storage trade-off (the one knob)

* **Bag-as-fold (default)** — store nothing extra; fold the event G-Set. Full event detail + time-travel. Right at agent-tick cadence (heartbeats, friction events, contribution counts, error-class histograms).
* **G-Counter cells** — when increments get too numerous to keep one file each, drop to a CRDT G-Counter (one `count[key][machine]` cell; merge = per-cell max; report = Σ). Compact, but loses per-event drill-down + exact time-travel. Pick by volume.

### Composes with

* the agent-bus (081KSXN940008QG0R00171YAZW, Phase 1 landing in #6283) — the event G-Set this builds on; observability is the *count-fold* over the same machinery
* the G-Set / Bag / Z-set ladder ([bus↔Ace synthesis](../research/2026-05-31-bus-and-ace-one-git-native-zetaid-zset-substrate-gset-comms-vs-dependency-zset.md)) — metric = the Bag rung
* [`.claude/skills/lightlike-observability-discipline/SKILL.md`](../../.claude/skills/lightlike-observability-discipline/SKILL.md) — the OTel / K8s / Argo / Prometheus = lightlike mapping
* [`2026-05-29-monitoring-and-reducing-pr-review-friction.md`](2026-05-29-monitoring-and-reducing-pr-review-friction.md) — the friction-measurement decision this serves
* DORA + the FrictionTelemetry ZetaId category + the measure-first principle — the metrics this stack collects
* shields-detect-not-block — a Bag-fold IS the drift detector (counts diverge / a surface goes quiet / a class spikes) that *surfaces* without gating
