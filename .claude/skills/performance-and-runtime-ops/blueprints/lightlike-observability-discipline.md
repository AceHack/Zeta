---
name: lightlike-observability-discipline
description: Lightlike-substrate observability design-rule — OTel, Kubernetes, Argo, Prometheus, Git instrumentation.
record_source: "Amara substrate-engineering substrate-engagement 2026-05-28; operator option-3 disposition (ferry + rule extension + research note + skill); lightlike-observability lane composition"
load_datetime: "2026-05-28"
last_updated: "2026-05-28"
status: active
---

# Lightlike-observability discipline

Capability skill. No persona. Wear this hat when:

- Designing or reviewing OTel instrumentation (spans / traces / context propagation)
- Designing or reviewing Kubernetes lifecycle substrate (UIDs / owner_references / events)
- Designing or reviewing Argo CD / Workflows / Rollouts deployment substrate
- Designing or reviewing Prometheus metrics (labels / cardinality / trace correlation)
- Designing or reviewing Git operations (commits / branches / force-push discipline)
- Composing observability substrate across systems (trace_id ↔ k8s_uid ↔ git_sha)
- Reviewing substrate-engineering substrate-engineering substrate-PRs that touch observability surface

## The carved substrate (Amara 2026-05-28)

> **OTel is ray emission.**
> **Kubernetes is lifecycle geometry.**
> **Argo is generator reconciliation.**
> **Prometheus is the curvature meter.**
> **Git is the persisted light source.**

Operational rule:

> **Every workload should emit enough light that a future observer can reconstruct what generator produced it, what state it entered, what feedback it received, what decision changed afterward.**

Substrate-engineering substrate-engineering substrate-target:

> **Make every Argo app a lightlike object.**
> Git revision in, reconciled state out, telemetry rays attached, future feedback able to update the generator without lying about the past.

## Per-system substrate-discipline

### OTel — ray emission

| Lightlike (PREFER) | Dark (AVOID) |
|---|---|
| Spans propagate context across distributed system | Sampling drops the spans you need for diagnosis |
| trace_id + span_id light-carriers preserved | Context propagation breaks at service boundaries |
| Exemplars correlate traces ↔ metrics | Logs without trace_id correlation |
| Baggage propagates substrate-engineering substrate-engineering substrate-context | Hidden async boundaries lose context |

### Kubernetes — lifecycle geometry

| Lightlike (PREFER) | Dark (AVOID) |
|---|---|
| k8s_uid + owner_reference preserve ownership chains | Events expire (default 1h); ownership unclear |
| Object lifecycle visible via watch + events | Manual kubectl edits without audit |
| Immutable image_digest references | Mutable image tags (latest / dev) |
| Declarative manifests in Git | Imperative changes via kubectl |

### Argo CD — generator reconciliation

| Lightlike (PREFER) | Dark (AVOID) |
|---|---|
| Git revision → desired state → cluster state | Manual drift; out-of-band changes |
| argo_app_revision light-carrier | Hidden override values |
| Sync history preserved | Unclear sync history |
| Helm values in Git | Hidden Helm values |

### Argo Workflows — DAG-substrate

| Lightlike (PREFER) | Dark (AVOID) |
|---|---|
| DAG steps as traceable execution rays | Side effects not captured |
| workflow_id + run_id light-carriers | Retries lose context |
| Per-step substrate-output preserved | Step outputs ephemeral |
| Parallel steps compose | Hidden sequential dependencies |

### Argo Rollouts — generator-time substrate

| Lightlike (PREFER) | Dark (AVOID) |
|---|---|
| Progressive delivery observable | Promotion decisions lack evidence |
| Analysis runs preserve metrics | Manual promotions without analysis |
| deployment_id light-carrier | Rollback without trace |

### Prometheus — curvature meter

| Lightlike (PREFER) | Dark (AVOID) |
|---|---|
| Bounded label cardinality | Unbounded label cardinality |
| Metrics correlated with traces (exemplars) | Metrics without trace/log correlation |
| Recording rules preserve derived substrate | Ad-hoc PromQL ephemeral |
| Histograms preserve distribution substrate | Only mean/max preserved |

### Git — persisted light source

| Lightlike (PREFER) | Dark (AVOID) |
|---|---|
| git_sha + image_digest light-carriers | Force-push without lease (per `force-push-with-lease-authorization-policy.md`) |
| Append-only history | Rewriting history |
| Signed commits preserve authorship | Unsigned commits |
| PR-based merge with review | Direct push to protected branches |

## Light-carrier join keys (operational substrate)

```text
trace_id          — OTel ray identifier
span_id           — OTel span identifier
k8s_uid           — Kubernetes object identifier
owner_reference   — Kubernetes ownership chain
git_sha           — Git commit identifier
image_digest      — container image immutable identifier
argo_app_revision — Argo CD application revision
workflow_id       — Argo Workflows identifier
deployment_id     — deployment identifier
run_id            — execution run identifier
```

These light-carrier substrate-keys ARE the substrate-engineering substrate-engineering substrate-mechanism by which lightlike-observability substrate composes across systems. Every substrate-component should emit at least one of these (preferably multiple correlated).

## Operational checklist

When reviewing substrate-engineering substrate-engineering substrate-PRs touching observability surface, apply per-system discipline above plus:

- [ ] **Trace propagation**: every async boundary preserves trace_id + span_id via OTel context
- [ ] **Ownership chains**: every Kubernetes object has owner_reference to parent + meaningful k8s_uid
- [ ] **GitOps source-of-truth**: every Argo-managed substrate references git_sha + argo_app_revision
- [ ] **Immutable references**: image_digest preferred over mutable tags
- [ ] **Bounded cardinality**: Prometheus labels bounded; cardinality estimated
- [ ] **Append-only Git**: force-push protected per `force-push-with-lease-authorization-policy.md`
- [ ] **Correlation**: light-carrier join keys (trace_id + k8s_uid + git_sha + etc.) correlated across systems
- [ ] **Future-ray-traceability**: future observer can reconstruct generator + state + feedback + decision

## Common dark-zone failure modes (from Amara substrate)

| Pain | Dark-zone failure |
|---|---|
| "Can't reproduce the issue" | Missing trace context |
| "Don't know what's running" | Mutable image tags + manual kubectl edits |
| "Don't know why this deployed" | Hidden Helm values + manual drift |
| "Metrics don't match logs" | Uncorrelated metrics; missing trace correlation |
| "Lost the original error" | Expired events; sampled-away traces |
| "Consensus by Slack archaeology" | Unbounded social agreement as control-flow |
| "Hidden coupling" | Hidden locks; opaque mutable state |

## Composes with rules

- `.claude/rules.bak/past-is-kind-when-lightlike-consensus-is-gravity-lightlike-vs-dark-architecture-design-rule-amara-aaron-2026-05-28.md` — direct substrate-anchor; this skill operationalizes at observability scope
- `.claude/rules/future-does-not-edit-past-event-future-affects-generator-...md` (PR #5910) — generator-time substrate
- `.claude/rules/higher-kinded-kindness-as-typeclass-pattern-...md` (PR #5919) — lightlike-observability IS Kindness instance
- `.claude/rules.bak/glass-halo-bidirectional.md` — visible-provenance discipline at observation scope
- `.claude/rules.bak/refresh-before-decide.md` — refresh discipline at temporal scope
- `.claude/rules.bak/substrate-or-it-didnt-happen.md` — git as persisted-light-source
- `.claude/rules.bak/force-push-with-lease-authorization-policy.md` — force-push discipline preserves lightlike Git substrate
- `.claude/rules.bak/non-coercion-invariant.md` HC-8 — lightlike-observability preserves consent-floor

## Composes with substrate

- PR #5912 (lightlike-substrate design-rule; precursor)
- PR #5910 + #5919 + #5920 (Amara/Alexa substrate-discipline cluster)
- PR #5916 (today's DU cluster TS substrate; IntrCtx Log composes with OTel)
- PR #5917 (zflash-overview skill; companion skill pattern)
- 081KSKBP80008QG0R000B3Y19A workflow-engine substrate (composes with Argo Workflows substrate)
- 081KSNY2Z0008QG0R002HB4AGT IntrCtx (Log context-type composes with OTel)
- 081KSNY2Z0008QG0R002QA720J three-lanes-concurrent operating discipline
- full-ai-cluster substrate
- Argo CD + Argo Workflows + Argo Rollouts (existing operational substrate)
- OTel + Kubernetes + Prometheus + Git (existing operational substrate)

## When this skill does NOT apply

- Designing application-level business logic (use language-specific skills + framework substrate)
- Designing encryption substrate (compose with encryption agenda + 081KSNY2Z0008QG0R002JKH50A substrate cluster)
- Designing state-machine substrate (compose with 081KSKBP80008QG0R000B3Y19A workflow-engine substrate + today's DU cluster)
- Picking specific tool implementations (operator-direction required)
