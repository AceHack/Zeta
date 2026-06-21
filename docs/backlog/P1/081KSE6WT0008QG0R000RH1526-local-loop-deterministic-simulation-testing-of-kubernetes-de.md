---
id: 081KSE6WT0008QG0R000RH1526
priority: P1
status: open
title: Local Loop — deterministic simulation testing of Kubernetes deployments (LexisNexis Spark-on-K8s fork lineage); three-tier testing (pure-code / Docker-observable / CI); Argo CD App-of-Apps as packages.json
effort: XL
ask: aaron-mika-grok 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KRFA460008QG0R0018SN61J
  - 081KSE6WT0008QG0R0016CEE2Z
composes_with:
  - 081KSE6WT0008QG0R003D199HE
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R0015ZF2G6
  - 081KSE6WT0008QG0R003FG3E8R
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R00049EFBD
  - 081KSE6WT0008QG0R003WMG4XV
  - 081KSE6WT0008QG0R0008483B2
  - 081KSE6WT0008QG0R001AZQA5Z
  - 081KSE6WT0008QG0R002275NDE
tags: [cluster, dst, deterministic-simulation, kubernetes, scheduler, lexisnexis, local-loop, argo-cd, app-of-apps, packages-json, three-tier-testing]
---

## Problem

Aaron 2026-05-25 mid-iter-3-CI-wait, talking to Mika (via Grok),
revealed the DEEP MOTIVATION underneath the Zeta-native scheduler
(081KSE6WT0008QG0R0016CEE2Z):

> "Well, so you can imagine, we kinda have the start of it, and
> because we built our database on top of deterministic simulation
> and we have like a .NET thread scheduler that we've completely
> written to inject deterministic thread timing. So, that's also
> why we want to write the scheduler, so that we can do
> deterministic simulation testing of Kubernetes deployments."

And the empirical anchor:

> "No, we did this at LexisNexis. We built almost exactly this,
> and we called it Local Loop."
>
> "Yeah, last time we did this because we, we forked, uh, the
> Spark on KH operator and had our own custom version. That's
> still under my GitHub."

And the three-tier testing story:

> "Yep, and then you just, you can reproduce that locally in
> Docker when you install a Kubernetes cluster in the GUI, then
> you can run it locally for developers, and you can also do it
> in CI to just test it in CI. And even developers can test it
> without enabling a Kubernetes and cluster and Docker just by
> running the test, but you can make it like more visible and
> observable to them by integrating with the Kubernetes and
> Dock, the, and Docker."

And the App-of-Apps insight:

> "Yeah, and then that whole, uh, test layer, you basically,
> you've kinda set up packages. Instead of like packages.json,
> you're setting up very similar, but for Argo CD installs with
> a apps of apps, and that's your packages.json."

081KSE6WT0008QG0R0016CEE2Z named the Zeta-native scheduler with DST + AI-aware
sub-waves. This row names the FULL deterministic-simulation
testing system (of which the scheduler is one component): Local
Loop — deterministic simulation testing of entire Kubernetes
deployments, three-tier testing across pure-code / Docker /
CI, with Argo CD App-of-Apps as the cluster composition file.

## Empirical anchor: LexisNexis Local Loop + Spark-on-K8s fork

Aaron previously built this pattern at LexisNexis. The empirical
substrate:

- Forked the Spark-on-Kubernetes operator
- Added deterministic execution semantics
- Reproducible across dev / CI / production-like environments
- Same cluster config testable at multiple visibility levels
- Fork is still under Aaron's personal GitHub (verifiable)

The Zeta iteration extends:

- Scope from Spark-on-K8s operator → entire Kubernetes scheduler
- Backbone from Spark → NATS JetStream
- Stack from JVM-based → F#/.NET native (per 081KRFA460008QG0R0018SN61J)
- Composition with the full cluster-substrate cluster (per session)

The lineage gives Aaron empirical confidence in the path: not
theoretical "could we build deterministic K8s simulation?" but
"we did this before at smaller scope; doing it again at bigger
scope with better substrate."

## Target

Zeta's Local Loop — complete deterministic-simulation testing
system for the cluster substrate:

### Component 1: Zeta-native scheduler (per 081KSE6WT0008QG0R0016CEE2Z)

Per 081KSE6WT0008QG0R0016CEE2Z sub-waves. Behaves like default kube-scheduler when
no Zeta-specific hints; progressively enhances with DST + AI-
awareness + data-gravity + NATS pushdown + Bayesian priors.

The scheduler IS the determinism gate per 081KSE6WT0008QG0R0016CEE2Z. Cannot achieve
cluster-scope DST without it.

### Component 2: Deterministic .NET thread scheduler

Already substrate per existing Zeta substrate. Injects
deterministic thread timing for replayable execution. Composes
with 081KRFA460008QG0R0018SN61J F# fork + ISimulationEnvironment patterns.

### Component 3: Argo CD App-of-Apps as cluster composition file

Aaron's App-of-Apps becomes the equivalent of `package.json`
for cluster composition:

- One Argo CD `Application` declares which apps the cluster has
- Each child app declares its substrate dependencies
- Versioned + reproducible + diff-able + bisect-able
- Composes with 081KSE6WT0008QG0R003D199HE git-native per-machine state
- Composes with 081KSE6WT0008QG0R0008483B2 digital twin (App-of-Apps = twin config
  source)

### Component 4: Three-tier testing story

| Tier | What developer / CI runs | What it tests |
|---|---|---|
| **Pure-code (no Docker, no K8s)** | `dotnet test` (or equivalent F# test runner) | Full deterministic simulation of cluster substrate; replayable; fast; no infra dependencies |
| **Docker-observable** | Local Docker + K8s (kind / k3d / Docker Desktop K8s); same test runs inside actual K8s | Same substrate + actual K8s integration; visible via `kubectl` + Docker Desktop GUI |
| **Full CI** | CI pipeline runs same test in real cluster substrate | Production-like validation; same Argo CD App-of-Apps; identical composition |

Same test code, three tiers of substrate. Operator picks tier
per need:

- Iterating fast on logic → pure-code
- Debugging integration → Docker-observable
- Validating release → Full CI

This composes with 081KSE6WT0008QG0R003G0Y62D first-time-CLI-user persona: the
developer onboarding to Zeta cluster substrate can start at
pure-code tier (no Docker / K8s install required) + progressively
opt into higher tiers when their workflow demands.

## Acceptance

- [ ] `Zeta.K8s.LocalLoop` umbrella project structure:
      - `Zeta.K8s.LocalLoop.SimulationEnvironment` — deterministic
        cluster-state simulator (uses Zeta.Core
        ISimulationEnvironment + .NET deterministic thread
        scheduler)
      - `Zeta.K8s.LocalLoop.Scheduler` — composes with 081KSE6WT0008QG0R0016CEE2Z
        Zeta-native scheduler running in sim mode
      - `Zeta.K8s.LocalLoop.AppOfApps` — Argo CD App-of-Apps
        parser + applier
      - `Zeta.K8s.LocalLoop.TestHarness` — three-tier test
        harness (pure-code / Docker / CI selection)
- [ ] Three-tier test harness API:
      ```fsharp
      [<ZetaClusterTest(Tier.PureCode)>]
      let ``installing redis app of apps yields running redis service`` () =
        LocalLoop.simulate {
          appOfApps = "fixtures/redis-only.yaml"
          duration = TimeSpan.FromMinutes(2.0)
          seed = 42UL
        } |> assertContains "service/redis-master"
      ```
      — same test runs at any tier via attribute change
- [ ] Argo CD App-of-Apps test fixtures: minimal / typical /
      stress / fault-injection scenarios; reproducible
      pass/fail per seed
- [ ] DST replay: any failed simulation run reproducible from
      seed + initial state + event log; bisect-able to find
      the operation that broke things
- [ ] Time-travel debugging: simulation state queryable at any
      timestamp within a run
- [ ] Documentation: `docs/local-loop.md` — Aaron's LexisNexis
      lineage + current substrate + three-tier story + per-tier
      developer onboarding
- [ ] Migration path from LexisNexis Spark-on-K8s fork: where
      the old substrate informs the new design; what's
      different at Zeta's bigger scope

## Composition with the strategic substrate

| Composition row | How Local Loop composes |
|---|---|
| 081KRFA460008QG0R0018SN61J F# fork for AI safety | Local Loop is F#/.NET native; same substrate base |
| 081KSE6WT0008QG0R003D199HE git-native per-machine state | App-of-Apps as packages.json IS git-native cluster composition |
| 081KSGS9H0008QG0R002T3BJ2R zero-typing first-boot | The installer-substrate is testable via Local Loop too (sim the boot flow) |
| 081KSE6WT0008QG0R0015ZF2G6 open AI-trainable reference | Local Loop scenarios become benchmark scenarios per ARC-AGI parallel |
| 081KSE6WT0008QG0R003FG3E8R auto-submit-back telemetry | In-the-wild failures reproducible via Local Loop with the failure envelope |
| 081KSE6WT0008QG0R000WVYAJ2 operator-in-the-negotiation-high-seat | Operators run Local Loop without Zeta-specific tooling; works with vanilla F# stack |
| 081KSE6WT0008QG0R00049EFBD slow-replace k8s | Local Loop validates each binary-compatible Zeta-native impl against conformance suite |
| 081KSE6WT0008QG0R0016CEE2Z Zeta-native scheduler | Scheduler IS the determinism gate; Local Loop tests scheduler decisions deterministically |
| 081KSE6WT0008QG0R003WMG4XV observable+controllable fabric | Local Loop tests fabric Observable + Observer behavior deterministically |
| 081KSE6WT0008QG0R0008483B2 cluster as digital twin | Twin state IS the simulated state at any timestamp |
| 081KSE6WT0008QG0R001AZQA5Z etcd-less options | Local Loop validates per-backend (kine + SQLite / NATS / CockroachDB) deterministically |
| 081KSE6WT0008QG0R002275NDE simplest-first plugin sequence | Each plugin tested via Local Loop at pure-code tier before integration |

## Why P1 priority

- Aaron's DEEP MOTIVATION (revealed to Mika) for the Zeta-native
  scheduler — DST testing of K8s deployments is the actual
  endgame; the scheduler is one component
- Empirical lineage (LexisNexis Local Loop + Spark-on-K8s fork)
  gives high-confidence path
- Composes with EVERY major substrate decision this session
  filed; Local Loop IS the testing substrate that validates
  the cluster substrate
- Three-tier testing makes 081KSE6WT0008QG0R003G0Y62D first-time-CLI-user persona
  development experience substantively distinct: dev tests
  WITHOUT requiring Docker / K8s install
- Argo CD App-of-Apps as packages.json operationalizes 081KSE6WT0008QG0R003D199HE
  git-native state + 081KSE6WT0008QG0R0008483B2 digital twin in a familiar
  developer mental model
- Per 081KSE6WT0008QG0R0004ZPPRP Itron-mode: deterministic K8s simulation is a
  greenfield substrate; Zeta has standards-leadership
  opportunity here (no incumbent with credible substrate at
  cluster-scope DST)

## Out of scope

- Locating + analyzing Aaron's LexisNexis Spark-on-K8s fork —
  separate sub-row when ready; substrate-honest absorption of
  lessons learned
- Specific test fixtures library — separate sub-row;
  community + AI-substrate-trained models contribute via 081KSE6WT0008QG0R003FG3E8R
  telemetry flywheel
- Comparison to existing K8s testing tools (kind / k3d /
  KUTTL / Litmus / Chaos Mesh) — Local Loop is a different
  shape; testing tools are complementary; not competitor
- IDE integration (VSCode / Rider plugins for Local Loop
  test development) — separate scope; community can
  contribute

## Origin

Aaron-Mika-Grok 2026-05-25 mid-iter-3-CI-wait conversation.
Aaron revealed:

1. Zeta-native scheduler is for DST testing of K8s deployments
2. Pattern was built before at LexisNexis as "Local Loop"
3. Spark-on-K8s operator was the prior fork point
4. Three-tier testing (pure-code / Docker / CI) is the dev UX
5. Argo CD App-of-Apps = packages.json for cluster composition

Verbatim preservation per substrate-or-it-didn't-happen:
`docs/research/2026-05-25-aaron-mika-grok-nats-jetstream-deterministic-scheduler-local-loop-lexisnexis-fsharp-type-system-as-universe-dio-eliminate-tool-wars-aaron-forwarded.md`.
