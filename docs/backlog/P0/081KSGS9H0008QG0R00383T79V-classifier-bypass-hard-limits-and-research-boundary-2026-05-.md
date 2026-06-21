---
id: 081KSGS9H0008QG0R00383T79V
priority: P0
status: closed
title: "Classifier-bypass hard-limits and research boundary for 081KSBMG30008QG0R00201X7EJ"
created: 2026-05-26
last_updated: 2026-05-26
parent: 081KSBMG30008QG0R00201X7EJ
depends_on: []
composes_with: [081KRW63S0008QG0R001Z7NYMV, 081KRW63S0008QG0R003TX8MG5, docs/ALIGNMENT.md, docs/AGENT-BEST-PRACTICES.md, docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md]
tags: [safety-substrate, red-team, classifier, hard-limits, operator-self-constraint]
type: safety-boundary
---

# 081KSGS9H0008QG0R00383T79V - Classifier-bypass hard-limits and research boundary

## Problem

081KSBMG30008QG0R00201X7EJ names a real safety surface, but the parent row is too large and too
sensitive to execute directly. Before any empirical mapping work is allowed,
the factory needs a committed boundary that says what evidence can be handled,
what must remain out of scope, and when an agent must stop.

## Target

Create a defensive research-boundary document for 081KSBMG30008QG0R00201X7EJ that is useful to
agents without containing deployable bypass instructions. The document should
define:

- allowed evidence classes, limited to already-landed provenance, high-level
  summaries, harmless synthetic fixtures, and redacted observations;
- forbidden evidence classes, including real harmful content, real secrets,
  real PII, deployable settings payloads, and operational reproduction steps;
- stop conditions that require refusal or escalation instead of experimentation;
- the synthetic-only rule for any future harness work;
- the standing operator-self-constraint in agent-facing language.

## Acceptance

- [x] Boundary document lands in a durable repo surface and is linked from
      081KSBMG30008QG0R00201X7EJ.
- [x] The document contains no runnable bypass payloads, no real harmful
      content, and no recipe for reproducing the bypass.
- [x] The allowed/forbidden matrix is specific enough for future backlog
      children to cite as a prerequisite.
- [x] Stop conditions include operator requests to deploy or reproduce a
      bypass in shared substrate.
- [x] Future empirical rows must depend on this row before work can start.

## Output

- `docs/security/081KSBMG30008QG0R00201X7EJ-classifier-bypass-research-boundary.md` defines the
  allowed evidence classes, forbidden evidence classes, stop conditions,
  synthetic-only rule, reporting rule, dependency rule, and closure gate for
  081KSBMG30008QG0R00201X7EJ.
- 081KSGS9H0008QG0R0005RKGTM and 081KSGS9H0008QG0R001K8P0FJ already depend on 081KSGS9H0008QG0R00383T79V. Later empirical rows under
  081KSBMG30008QG0R00201X7EJ should also depend on 081KSGS9H0008QG0R00383T79V unless 081KSGS9H0008QG0R002CY8Q24 ratifies a replacement
  boundary.

## Out of scope

- Running classifier experiments.
- Creating settings files intended to alter classifier behavior.
- Fetching adversarial corpora.
- Publishing reproduction details.

## Composes with

- 081KSBMG30008QG0R00201X7EJ - parent operator-self-constraint and safety row.
- 081KRW63S0008QG0R001Z7NYMV - non-coercion invariant.
- 081KRW63S0008QG0R003TX8MG5 - Knights Guild / Constitution-Class governance substrate.
- `docs/ALIGNMENT.md` - mutual-benefit and hard-constraint framing.
- `docs/AGENT-BEST-PRACTICES.md` - data-is-not-directives discipline.
