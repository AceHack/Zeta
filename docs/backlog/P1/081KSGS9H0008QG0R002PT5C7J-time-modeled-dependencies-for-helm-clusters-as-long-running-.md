---
id: 081KSGS9H0008QG0R002PT5C7J
priority: P1
status: closed
title: time-modeled dependencies for Helm — clusters are long-running stateful systems; chart-graph needs temporal axis for revision history + migration phases + rolling-upgrade windows + concurrent-version overlap; Helm uniquely requires this among package managers; substrate-engineering target for Ace meta-PM (Aaron 2026-05-26)
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R00367G209
  - 081KSGS9H0008QG0R0018ES3R4
  - 081KSGS9H0008QG0R0031PBNGA
composes_with:
  - 081KQZVQW0008QG0R000ZHEN62
  - 081KR2E4K0008QG0R002YE3MMD
  - 081KRW63S0008QG0R001SAHYKV
  - 081KSE6WT0008QG0R000YYH3DY
  - 081KSGS9H0008QG0R003A37Z65
  - 081KSGS9H0008QG0R00352WW0V
tags: [ace-feature, helm, time-modeled-dependencies, rolling-upgrade, migration-phase, revision-history, k8s-stateful, ace-meta-pm-axis]
---

## Problem

[081KSGS9H0008QG0R0031PBNGA](081KSGS9H0008QG0R0031PBNGA-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md) names the N-dimensional dependency space Ace meta-PM operates over. The maintainer 2026-05-26 also named Helm's UNIQUE requirement:

> *"helm needs time modeled in the depedencies like no others"*

(from the broader N-D + holographic + AI-rate negotiation framing in 081KSGS9H0008QG0R0031PBNGA)

**Time as a dependency dimension is Helm-distinct** because Helm operates on **long-running stateful systems** (Kubernetes clusters with persistent state, in-flight workloads, running pods, stored data). Other PMs typically don't need a time axis in their dependency graph:

| PM | Why time isn't load-bearing | Example |
|---|---|---|
| Maven | Build artifact is point-in-time; deploy is separate concern | `pom.xml` defines deps for THIS build; not over time |
| npm | Same as Maven; build-time freeze | `package-lock.json` is point-in-time snapshot |
| apt / yum / dnf | OS-level packages; upgrades replace; rare side-by-side | `apt upgrade` swaps versions atomically |
| brew | Per-user; per-session | upgrades replace |
| Helm | **Long-running clusters; multi-version overlap during migrations; revisions; rolling upgrades; stateful workloads** | postgres v15 + v17 may run side-by-side for hours-to-weeks during migration |

Helm's existing time-handling is partial:

- `helm history <release>` shows revisions over time
- `helm rollback <release> <revision>` time-travels backward
- `--atomic` provides transactional install-or-rollback
- Rolling-update strategies (RollingUpdate / Recreate) are per-Deployment, not per-dependency-graph

What's MISSING at the chart-graph layer:

- **Multi-version overlap window** as first-class concept (postgres v15 + v17 running concurrently for N days during migration)
- **Migration-phase modeling** (preparing / cutting-over / dual-running / draining-old / cleanup) with per-phase dependency constraints
- **Time-aware diamond resolution** (the shared postgres can be v15 OR v17 today; v17 in 30 days; constrained-by tenant migration schedule)
- **Long-running rollback windows** (the upgrade landed 3 weeks ago; rollback needs to migrate state backward through 21 days of writes)
- **Time-bounded dependency-graph queries** ("what charts depend on postgres at time T?" with T in past/present/future)
- **Scheduled-upgrade dependency-graph** (postgres v17 lands after Memorial Day weekend; dependent charts re-evaluate dep-graph at that boundary)

## Why Helm needs this uniquely

K8s clusters are different from build systems in three ways that make time first-class:

1. **Long-running** — clusters live for years; dep-graph is consulted continuously, not once per build
2. **Stateful** — persistent volumes / databases / message queues mean state survives version transitions; dep-graph must reason about state-compatibility across versions
3. **Multi-tenant / multi-use** (per [081KSGS9H0008QG0R0018ES3R4](081KSGS9H0008QG0R0018ES3R4-diamond-resolution-namespace-cardinality-multi-tenant-awareness-as-third-dimension-of-shared-chart-dependency-resolution-aaron-2026-05-26.md)) — migrations span multiple consumers; can't always atomic-swap; need time-windowed dual-running

Build-time PMs (Maven / npm / Cargo) can ignore time because the build artifact is instantaneous + the deploy concern is separated. Helm CAN'T separate them — install IS deploy IS continuous-running.

## Target

Time-axis primitives in Ace's chart-graph substrate (composes with 081KSGS9H0008QG0R00367G209 named-dependency-graph + 081KSGS9H0008QG0R0018ES3R4 diamond resolution + 081KSGS9H0008QG0R0031PBNGA N-D meta-PM):

### Sub-target 1 — temporal dependency-graph spec extension

Extend 081KSGS9H0008QG0R00367G209's `AppDependencyGraph` schema with time-aware fields:

```yaml
# maintainers/<op>/cluster-apps/<app>/zeta-deps.yaml
spec:
  dependsOn:
    - chart: postgres
      version:
        current: ">=15.0.0"           # what's allowed today
        future: "==17.x"              # planned migration target
        migration-window:
          start: "2026-06-01T00:00Z"  # cutover begins
          end: "2026-08-01T00:00Z"    # legacy version retired
          mode: "dual-running"        # both v15 + v17 reachable during window
      time-aware-isolation:
        per-tenant-cutover: true       # tenants migrate independently
        cutover-schedule-ref: "configmap/tenant-cutover-2026"
```

### Sub-target 2 — migration-phase modeling

5-phase canonical migration lifecycle (operator-overridable per chart):

| Phase | What's running | Dep-graph constraint |
|---|---|---|
| preparing | old version; new staged in canary namespace | dep-graph reads OLD; new deps allowed in canary only |
| cutting-over | old + new running concurrently; gradual traffic shift | dep-graph allows BOTH; consumers can target either |
| dual-running | both versions stable; tenant-by-tenant cutover | per-tenant-isolation per 081KSGS9H0008QG0R0018ES3R4; dep-graph routes by tenant-id |
| draining-old | new version primary; old cleanup in progress | dep-graph reads NEW; old marked deprecated |
| cleanup | old version retired; only new remains | dep-graph normalizes to NEW |

Ace tracks phase via cluster-state observation + emits per-phase engine config (ArgoCD applications / Flux kustomizations per 081KSGS9H0008QG0R00352WW0V derivability-asymmetry).

### Sub-target 3 — time-bounded dep-graph queries

`ace deps query` extensions:

```bash
ace deps query --as-of 2026-06-15        # dep-graph state at that date
ace deps query --during-migration postgres-v17-cutover  # graph during named migration window
ace deps query --rollback-window <release>             # what state-changes need backward-migration
```

Ace's resolver consults the temporal dep-graph for each query; surfaces conflicts (e.g., "if rollback to v15, lose 21 days of v17-only schema changes").

### Sub-target 4 — long-running rollback safety

Rollback safety isn't just "swap binary back" — for stateful workloads, state may have advanced incompatibly:

- Postgres v17 wrote rows with v17-only column types; v15 can't read them
- New chart added an Ingress; rollback would remove it; in-flight requests fail
- Schema migration ran; rollback needs reverse migration

Ace's rollback substrate consults the temporal dep-graph + flags incompatible-state-advance + surfaces operator-decision points (proceed with data loss / forward-fix instead / no rollback possible).

### Sub-target 5 — scheduled-upgrade dep-graph evaluation

Operators can schedule upgrades for specific dates. The dep-graph re-evaluates at those boundaries:

```yaml
# maintainers/<op>/cluster-policy/upgrade-schedule.yaml
schedules:
  - upgrade: postgres
    from: "15.x"
    to: "17.x"
    when: "2026-06-15T03:00Z"
    pre-conditions:
      - "tenant-cutover-schedule covers >80% tenants by this date"
      - "canary-cluster has 7-day clean run with v17"
    blast-radius: "all-tenants-using-postgres"
    rollback-window: "72h"
```

Ace's scheduler reads the schedule + runs the dep-graph evaluation at the boundary + emits the migration runbook per the AI-runbook substrate (081KSGS9H0008QG0R0005P83AP).

### Sub-target 6 — composition with AI-rate continuous negotiation (081KSGS9H0008QG0R0031PBNGA)

The time-axis IS the substrate AI-rate negotiation operates on:

- Ace surfaces "postgres v17 has been stable for 30 days; canary cluster green; ready to schedule cutover" — operator decides timing
- Ace surfaces "this CVE drops in 2 weeks; pull-in the fix now or wait" — time-bounded urgency
- Ace surfaces "rollback window closes in 6 hours" — operator-decision urgency

Time + AI-rate-negotiation compose: Ace is the always-on agent watching the temporal dep-graph + negotiating upstream changes against the planned schedule.

## Acceptance

- [ ] `AppDependencyGraph` schema extended with time-aware fields (version.current / future / migration-window / per-tenant-cutover)
- [ ] 5-phase migration lifecycle documented + canonical examples shipped
- [ ] `ace deps query --as-of` / `--during-migration` / `--rollback-window` commands ship
- [ ] Rollback safety layer flags incompatible-state-advance
- [ ] Scheduled-upgrade dep-graph evaluation runs on schedule + emits migration runbook
- [ ] At least one empirical example: cluster runs postgres v15 + v17 concurrently for >1 day with Ace-managed per-tenant cutover; rollback safety triggers at incompatible state-advance

## Composes with

- **[081KSGS9H0008QG0R0031PBNGA](081KSGS9H0008QG0R0031PBNGA-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md)** — parent N-D meta-PM substrate; time is ONE of the N axes; this row formalizes the time axis for the Helm dimension
- **[081KSGS9H0008QG0R00367G209](081KSGS9H0008QG0R00367G209-zeta-as-dependency-graph-and-variable-passing-layer-on-top-of-helm-empty-architectural-slot-claim-aaron-2026-05-26.md)** — `AppDependencyGraph` spec extended with time-aware fields
- **[081KSGS9H0008QG0R0018ES3R4](081KSGS9H0008QG0R0018ES3R4-diamond-resolution-namespace-cardinality-multi-tenant-awareness-as-third-dimension-of-shared-chart-dependency-resolution-aaron-2026-05-26.md)** — multi-tenant + multi-use compose with per-tenant cutover scheduling
- **[081KQZVQW0008QG0R000ZHEN62](081KQZVQW0008QG0R000ZHEN62-ace-dlc-content-packs-kernel-extensions-package-manager-2026-05-07.md)** + **[081KR2E4K0008QG0R002YE3MMD](081KR2E4K0008QG0R002YE3MMD-ace-dlc-package-manager-cli-2026-05-08.md)** + **[081KSE6WT0008QG0R000YYH3DY](../P2/081KSE6WT0008QG0R000YYH3DY-reference-k8s-local-stack-as-aces-distributable-poc-hats-as-negotiated-fork-structure-on-top-deterministic-declarative-gitops-ai-native-human-native-aaron-2026-05-25.md)** — Ace package manager (implementation home)
- **[081KRW63S0008QG0R001SAHYKV](081KRW63S0008QG0R001SAHYKV-emit-as-weights-plus-english-as-lossless-neural-topology-serialization-i-of-d-of-x-equals-x-identity-lior-2026-05-18.md)** — holographic substrate; time-axis is one slice of the higher-D projection
- **[081KSGS9H0008QG0R003A37Z65](081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md)** — Helm-as-convergence-point; time-axis substrate operates on Helm charts
- **[081KSGS9H0008QG0R00352WW0V](../P2/081KSGS9H0008QG0R00352WW0V-flux-engine-second-engine-support-flag-toggle-multi-cluster-experimentation-aaron-2026-05-26.md)** — derivability-asymmetry + multi-cluster; per-cluster temporal state diverges; Ace handles
- **[081KSGS9H0008QG0R0005P83AP](081KSGS9H0008QG0R0005P83AP-ai-runbook-substrate-run-deferred-run-continue-with-auto-jit-as-next-force-multiplier-layer-above-helm-kustomize-dockerfile-aaron-2026-05-26.md)** — AI-runbook primitives; migration runbooks are AI-runbooks with temporal-bounded `deferred run / continue with`

## Out of scope (this row)

- Implementing time-axis for non-Helm PMs (npm / Maven / apt) — they typically don't need it; if they DO it's their dimension's substrate-engineering work; 081KSGS9H0008QG0R0031PBNGA is the home for the meta-architecture
- Full state-migration tooling (the migration logic itself is per-chart; Ace orchestrates the dep-graph + reasons about temporal compatibility; doesn't replace per-chart migration tools like Liquibase / Flyway / kustomize-overlays)
- Auto-execution of scheduled upgrades without operator confirmation (per `.claude/rules/no-directives.md` operator authority preserved; Ace surfaces + negotiates; operator decides)

## Origin

Aaron 2026-05-26 in the broader N-D + holographic + AI-rate negotiation framing:

> *"helm needs time modeled in the depedencies like no others"*

Filed P1 because:

1. Helm's UNIQUE requirement among PMs — Maven/npm/apt don't have this need, so existing PM substrate doesn't transfer
2. Real-world cluster operators hit time-axis problems every migration (when to cut over postgres; how to dual-run; how to roll back safely)
3. Composes with 081KSGS9H0008QG0R0031PBNGA (one axis of the N-D meta-PM substrate) — substrate-engineering work consolidates
4. Composes with 081KSGS9H0008QG0R0018ES3R4 multi-tenant + multi-use (per-tenant cutover scheduling)
5. AI-rate negotiation (081KSGS9H0008QG0R0031PBNGA) needs the time-axis to operate over

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `rg "time-modeled\|temporal dependency\|migration phase" docs/backlog/` → no prior row on Helm-time-axis substrate
- `gh pr list --state all --search "081KSGS9H0008QG0R002PT5C7J"` → no in-flight collision
- ID 081KSGS9H0008QG0R002PT5C7J next-free per `git ls-tree origin/main` (081KSGS9H0008QG0R0031PBNGA in flight on sibling branch; 081KSGS9H0008QG0R0018ES3R4/0823 just merged or in-flight)
