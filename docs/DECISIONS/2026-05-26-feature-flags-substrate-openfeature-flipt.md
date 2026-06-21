# ADR: Feature flags substrate uses OpenFeature as contract and Flipt first

**Status:** Accepted
**Date:** 2026-05-26
**Backlog:** 081KSE6WT0008QG0R000C18G5D
**Scope:** Decision substrate only; no implementation in this slice.

## Context

081KSE6WT0008QG0R000C18G5D records the feature-flags substrate shape for the 081KSE6WT0008QG0R002275NDE
plugin sequence. The operator requirement is deliberately small:
open-source tooling, lowest operational overhead first, and a path
to add heavier backends only after the simple backend fails an
observed requirement.

The row also composes with namespace and experiment routing work:
operator-specific namespaces need flag values that do not perturb the
common namespace, and Argo Rollouts needs a stable way to ask whether
a rollout should proceed for a given operator context.

## Decision

Use **OpenFeature** as the operator-facing feature-flag contract and
ship **Flipt** as the first backend.

The intended layering is:

| Layer | Choice | Reason |
|---|---|---|
| Operator API | OpenFeature SDK shape | Backend-agnostic contract; keeps application code stable when providers change |
| First backend | Flipt | Smallest open-source operating surface for the first implementation |
| Later backends | Unleash, Flagd, in-memory providers | Add only when a concrete requirement exceeds the Flipt shape |
| Routing composition | Namespace context plus experiment header | Lets operator branches vary flags without changing common namespace defaults |

The F# surface should expose a native provider interface and wrap the
OpenFeature provider model rather than binding callers directly to one
backend. Flipt is an implementation choice, not the operator contract.

## Consequences

Positive:

- Operators get a standard feature-flag API while Zeta keeps backend
  choice replaceable.
- The first implementation stays small enough for a P2 plugin slice.
- Namespace routing and progressive delivery can share one decision
  surface instead of inventing separate toggle semantics.

Costs:

- Flipt-specific operational details still need an implementation row
  before the plugin can ship.
- OpenFeature conformance tests become part of the eventual provider
  contract, even though this slice does not add code.

## Out Of Scope

- Implementing `Zeta.Feature.Flags`.
- Adding Flipt deployment manifests.
- Adding Argo Rollouts AnalysisTemplate examples.
- Choosing a second backend before Flipt fails an observed requirement.

## Follow-Up

- Add `docs/plugins/zeta-feature-flags.md` with persona ontology maps
  and rollout examples.
- Implement the F# provider interface and OpenFeature adapter in the
  081KSE6WT0008QG0R002275NDE plugin sequence.
- Add conformance tests that every future backend must pass.
