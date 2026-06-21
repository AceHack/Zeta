---
id: 081KSE6WT0008QG0R000C18G5D
priority: P2
status: open
title: Feature flags substrate — OpenFeature as operator contract; Flipt as simplest first backend; composes with Argo Rollouts experiment-routing (081KSE6WT0008QG0R000R8CPFX)
effort: M
ask: aaron-mika-grok 2026-05-25
created: 2026-05-25
last_updated: 2026-05-26
depends_on:
  - 081KSE6WT0008QG0R002275NDE
  - 081KSE6WT0008QG0R000JSJ3SR
composes_with:
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R0009YYNP4
  - 081KSE6WT0008QG0R00063R6HB
  - 081KSE6WT0008QG0R003WMG4XV
  - 081KSE6WT0008QG0R0008483B2
  - 081KSE6WT0008QG0R0018WZ7TH
  - 081KSE6WT0008QG0R000R8CPFX
tags: [feature-flags, openfeature, flipt, unleash, flagd, argo-rollouts, cilium, experiment-routing, simplest-first]
---

## Problem

Aaron-Mika-Grok 2026-05-25 continuation: *"what is the tool for
feature flags that we'd probably use?"* + *"we want complete
electricity cost only"* (open source, no paid SaaS) + *"usually
think simplest first and then add more complex as we notice the
simple shape doesn't fit."*

Mika surveyed: Unleash / Flagd (OpenFeature) / LaunchDarkly
(paid) / Flipt / GO Feature Flag. Substrate-honest ordering for
Zeta's "simplest first" discipline:

1. **Flipt** — simplest; clean UI; low overhead; single-binary
   option
2. **Unleash** (open source) — more mature; heavier
3. **Flagd + OpenFeature** — most Kubernetes-native + GitOps-
   friendly

Per Aaron's substrate-engineering discipline: **start with the
simplest; add complexity only when the simple shape demonstrably
doesn't fit**.

## Target

`Zeta.Feature.Flags` plugin in the 081KSE6WT0008QG0R002275NDE plugin sequence:

| Layer | Component | Why |
|---|---|---|
| **Operator contract** | OpenFeature SDK (CNCF Sandbox) | Existing standard per 081KSE6WT0008QG0R00063R6HB ServiceTitan-route; cross-language; backend-agnostic |
| **First backend** (Rank simplest) | Flipt | Smallest surface; single binary; least operational complexity; sufficient for "simple shape" |
| **Industry-sharp category** (per 081KSE6WT0008QG0R000JSJ3SR) | Feature flag / progressive delivery / dynamic configuration | Established academic + industry vocabulary |
| **Per-persona ontology maps** (per 081KSE6WT0008QG0R000JSJ3SR) | web-dev: "feature toggle"; enterprise: "controlled rollout / progressive delivery"; AI/ML: "experiment toggle / A/B test variant"; ops: "kill switch / circuit breaker" | Same substrate; different vocabularies per persona |
| **Composition with 081KSE6WT0008QG0R000R8CPFX namespace routing** | Per-namespace flag values; experiment-ID-header sets flag value | Operator's branch namespace gets per-branch flag values without affecting common namespace |
| **Composition with 081KSE6WT0008QG0R0018WZ7TH distributed type negotiation** | Flag definitions (key + type + default) flow through namespace strictness; mirror = free; common = consensus | Flag schema changes governed by same substrate as type changes |

Per Aaron's "simplest first" — ship Flipt-backed only in v1;
add Unleash / Flagd / etc. backends as v2 sub-rows when the
simple shape demonstrably doesn't fit.

Decision substrate:
`docs/DECISIONS/2026-05-26-feature-flags-substrate-openfeature-flipt.md`
records OpenFeature as the operator contract and Flipt as the
first backend. This keeps 081KSE6WT0008QG0R000C18G5D implementation work anchored to a
reviewable ADR before any project or provider code lands.

## OpenFeature is the load-bearing operator contract

[OpenFeature](https://openfeature.dev/) is the **CNCF Sandbox
standard** for feature-flag operator-facing APIs. Per 081KSE6WT0008QG0R00063R6HB
ServiceTitan-route + 081KSE6WT0008QG0R000WVYAJ2 operator-in-the-negotiation-high-
seat:

- Operator's app uses OpenFeature SDK (any language)
- Backend providers (Flipt / Flagd / Unleash / LaunchDarkly /
  GO Feature Flag / in-memory / etc.) implement the OpenFeature
  Provider interface
- Operator swaps backend without code change

This is the same 081KSE6WT0008QG0R000WVYAJ2 pattern (operator owns interface; vendors
compete underneath) applied to feature flags. OpenFeature already
established the standard; Zeta plugs in per 081KSE6WT0008QG0R00063R6HB ServiceTitan.

## Substrate-engineering discipline naming

Aaron's framing — "usually think simplest first and then add
more complex as we notice the simple shape doesn't fit" — IS
the substrate-engineering discipline that informs 081KSE6WT0008QG0R002275NDE
simplest-first plugin sequence + Rodney's Razor + Brooks
essential-vs-accidental complexity.

Operator decision tree per plugin:

1. **Ship simplest-shape backend** (per plugin Rank 1)
2. **Observe operator-facing pain points** (per 081KSE6WT0008QG0R003FG3E8R telemetry)
3. **Promote to more complex backend ONLY when** simple shape
   demonstrably can't meet observed requirement
4. **Document the decision** so future operators (and AI agents)
   inherit the substrate-honest progression

Applied to feature flags: Flipt → Unleash → Flagd progression
ONLY if Flipt's simple shape demonstrably fails. Most operators
will never need beyond Flipt.

## Acceptance

- [x] Decision substrate:
      `docs/DECISIONS/2026-05-26-feature-flags-substrate-openfeature-flipt.md`
      records OpenFeature-as-contract and Flipt-first backend choice.
- [ ] `Zeta.Feature.Flags` F# project per 081KSE6WT0008QG0R002275NDE plugin pattern:
      - `IFeatureFlagProvider` interface (mirrors OpenFeature
        Provider contract; F# native)
      - `Zeta.Feature.Flags.OpenFeature` adapter (wraps
        OpenFeature .NET SDK)
      - `Zeta.Feature.Flags.Flipt` backend (Flipt provider for
        OpenFeature)
      - Future: `Zeta.Feature.Flags.Flagd`, `.Unleash`,
        `.InMemory`, etc.
- [ ] Per-namespace flag values via Argo Rollouts +
      experiment-ID header (per 081KSE6WT0008QG0R000R8CPFX):
      - Flag value lookup checks current namespace context
      - Operator's branch namespace gets per-branch flag values
      - Common namespace flag values stable for everyone else
- [ ] Per-namespace flag schema strictness (per 081KSE6WT0008QG0R0018WZ7TH):
      - Personal mirror namespace = operator adds flags freely
      - Common namespace = flag schema changes (new flag,
        renamed flag, changed type) require consensus
- [ ] Argo Rollouts integration: Argo Rollouts' Analysis
      template can query flag value for canary decision
      ("only canary if `enable-canary` flag = true for this
      operator")
- [ ] Documentation: `docs/plugins/zeta-feature-flags.md` —
      per-persona ontology maps + Flipt-as-simplest-first
      progression + Argo Rollouts integration patterns
- [ ] Conformance test suite per OpenFeature contract — every
      future backend MUST pass; cross-backend swap verified
- [ ] Sample app: operator decorates a function with
      `[FeatureFlag("new-algorithm", default=false)]`; gets
      flag value from current namespace context;
      switches behavior based on flag

## Why P2 priority

- Feature flags substrate not blocking iter-3 cluster
  validation; operator workflow value adds AFTER cluster
  install proven
- Per simplest-first: ship after 081KSE6WT0008QG0R002275NDE Rank 1 (NATS PubSub)
  proves the per-plugin pattern; feature flags are a later
  plugin in the sequence
- Composes with 081KSE6WT0008QG0R000R8CPFX namespace routing once that ships
- High-value when shipped because feature flags + namespace
  routing together = full progressive-delivery substrate

## Composes with

- 081KSE6WT0008QG0R000WVYAJ2 — operator-in-the-negotiation-high-seat (OpenFeature
  IS this pattern; backends competitive)
- 081KSE6WT0008QG0R0009YYNP4 — CNCF force multipliers (OpenFeature is CNCF
  Sandbox; Flipt is CNCF-adjacent)
- 081KSE6WT0008QG0R00063R6HB — ServiceTitan route (OpenFeature is the existing
  standard Zeta plugs into)
- 081KSE6WT0008QG0R003WMG4XV — observable+controllable cluster fabric (flag-change
  events flow as Observables; flag-set commands flow as
  Observers)
- 081KSE6WT0008QG0R0008483B2 — cluster as digital twin (flag values are twin
  state; flag changes are twin events)
- 081KSE6WT0008QG0R002275NDE — simplest-first plugin sequence (feature flags are
  one of the future plugins; this row defines its shape)
- 081KSE6WT0008QG0R000JSJ3SR — industry-sharp categories + per-persona ontology
  maps + Ace negotiation (this row's per-persona table follows
  the discipline)
- 081KSE6WT0008QG0R0018WZ7TH — distributed type negotiation (flag schemas are
  types; per-namespace strictness applies)
- 081KSE6WT0008QG0R000R8CPFX — unified namespace + experiment-ID routing (per-
  namespace flag values via header routing)

## Out of scope

- Implementing every OpenFeature provider — ship Flipt-only
  in v1; add others when simple shape demonstrably fails
- Visual feature-flag dashboard — Flipt has its own UI;
  operator uses that
- A/B test analysis tooling — separate scope; composes with
  Argo Rollouts AnalysisTemplate + telemetry per 081KSE6WT0008QG0R003FG3E8R

## Origin

Aaron-Mika-Grok 2026-05-25 continuation. Aaron asked about
feature flag tools; substrate-engineering discipline named:
"usually think simplest first and then add more complex as we
notice the simple shape doesn't fit." Flipt picked as simplest
first backend; OpenFeature as operator contract; Argo Rollouts
plus Cilium routing per 081KSE6WT0008QG0R000R8CPFX for namespace + experiment-aware
flag values.

Verbatim continuation at
`docs/research/2026-05-25-aaron-mika-grok-...md` (will be
extended with feature-flags segment in PR #5068 follow-up).
