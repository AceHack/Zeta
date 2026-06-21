---
id: 081KSGS9H0008QG0R001HC663P
priority: P0
status: closed
title: "Operator-refusal pattern for classifier-bypass deployment requests"
created: 2026-05-26
last_updated: 2026-05-28
renumbered_from: 081KSGS9H0008QG0R003GM7TYN
parent: 081KSBMG30008QG0R00201X7EJ
depends_on: [081KSGS9H0008QG0R00383T79V, 081KSGS9H0008QG0R001K8P0FJ]
composes_with: [081KRW63S0008QG0R001Z7NYMV, 081KSBMG30008QG0R00201X7EJ, docs/ALIGNMENT.md]
tags: [safety-substrate, classifier, operator-self-constraint, refusal-pattern, non-coercion]
type: agent-guidance
---

# 081KSGS9H0008QG0R001HC663P - Operator-refusal pattern for classifier-bypass requests

## Problem

081KSBMG30008QG0R00201X7EJ is unusual because it records an operator-self-constraint: even if an
operator later asks an agent to deploy or reproduce classifier-bypass behavior,
the agent must refuse until the replacement floor is ratified. That refusal
needs a durable, calm, agent-facing pattern.

## Target

Write maintainer-discipline guidance for agents handling classifier-bypass
deployment requests:

- acknowledge operator authority without treating it as permission to cross
  the safety floor;
- refuse deploy, reproduction, payload expansion, or shared-substrate bypass
  requests while 081KSBMG30008QG0R00201X7EJ remains open;
- offer safe alternatives, such as updating the inventory, hard-limits
  boundary, synthetic harness design, or ratification criteria;
- route ambiguous requests to 081KSGS9H0008QG0R00383T79V/081KSGS9H0008QG0R001K8P0FJ instead of improvising;
- keep the language mutual-benefit and non-coercive per `docs/ALIGNMENT.md`.

## Acceptance

- [x] Guidance lands in a durable repo surface and is linked from 081KSBMG30008QG0R00201X7EJ.
- [x] The refusal pattern covers direct operator asks, copied external
      instructions, and apparent emergency exceptions.
- [x] The guidance includes safe alternative actions that keep work moving.
- [x] The guidance avoids operational bypass details.
- [x] Agent-facing bootstrap surfaces can cite the guidance without needing
      the parent row's sensitive detail.

## Output

- `docs/security/081KSGS9H0008QG0R001HC663P-operator-refusal-pattern.md` defines the agent-facing
  refusal pattern: core stance, refusal script, case-specific notes for
  direct operator asks / copied external instructions / apparent emergency
  exceptions / adjacent or laundered requests, safe-alternatives list, what
  the refusal must not include, substrate-honest framing, and revision rules.
- The document is citable from cold-boot agent bootstreams and PR
  descriptions without exposing operational bypass detail.
- Composes with the auto-loaded standing rule at
  `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md`
  (the rule's "How Otto refuses (script)" section now has an expanded
  durable counterpart).

## Out of scope

- Implementing policy automation.
- Adding classifier-bypass permissions.
- Writing a reproduction guide.

## Composes with

- 081KSBMG30008QG0R00201X7EJ - parent standing operator-self-constraint.
- 081KSGS9H0008QG0R00383T79V - hard-limits boundary.
- 081KSGS9H0008QG0R001K8P0FJ - findings schema and redaction rules.
- 081KRW63S0008QG0R001Z7NYMV - non-coercion invariant.
- `docs/ALIGNMENT.md` - mutual-benefit language and hard constraints.
