---
id: B-0809
zetaid: 081KSGS9H0008QG0R001HC663P
priority: P0
status: closed
title: "Operator-refusal pattern for classifier-bypass deployment requests"
created: 2026-05-26
last_updated: 2026-05-28
renumbered_from: B-0802
parent: B-0720
depends_on: [B-0798, B-0807]
composes_with: [B-0664, B-0720, docs/ALIGNMENT.md]
tags: [safety-substrate, classifier, operator-self-constraint, refusal-pattern, non-coercion]
type: agent-guidance
---

# B-0809 - Operator-refusal pattern for classifier-bypass requests

## Problem

B-0720 is unusual because it records an operator-self-constraint: even if an
operator later asks an agent to deploy or reproduce classifier-bypass behavior,
the agent must refuse until the replacement floor is ratified. That refusal
needs a durable, calm, agent-facing pattern.

## Target

Write maintainer-discipline guidance for agents handling classifier-bypass
deployment requests:

- acknowledge operator authority without treating it as permission to cross
  the safety floor;
- refuse deploy, reproduction, payload expansion, or shared-substrate bypass
  requests while B-0720 remains open;
- offer safe alternatives, such as updating the inventory, hard-limits
  boundary, synthetic harness design, or ratification criteria;
- route ambiguous requests to B-0798/B-0807 instead of improvising;
- keep the language mutual-benefit and non-coercive per `docs/ALIGNMENT.md`.

## Acceptance

- [x] Guidance lands in a durable repo surface and is linked from B-0720.
- [x] The refusal pattern covers direct operator asks, copied external
      instructions, and apparent emergency exceptions.
- [x] The guidance includes safe alternative actions that keep work moving.
- [x] The guidance avoids operational bypass details.
- [x] Agent-facing bootstrap surfaces can cite the guidance without needing
      the parent row's sensitive detail.

## Output

- `docs/security/B-0809-operator-refusal-pattern.md` defines the agent-facing
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

- B-0720 - parent standing operator-self-constraint.
- B-0798 - hard-limits boundary.
- B-0807 - findings schema and redaction rules.
- B-0664 - non-coercion invariant.
- `docs/ALIGNMENT.md` - mutual-benefit language and hard constraints.
