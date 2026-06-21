---
id: 081KSNY2Z0008QG0R000S738W3
priority: P1
status: open
title: Two-path interface — discriminated union path EXECUTES intent + conversational document path DECLARES intent (both first-class; both feed same event log; for ANY traveler, not just humans)
effort: M
ask: aaron via ani 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R003WFDCJ9
  - 081KSNY2Z0008QG0R001K6HJ7Z
  - 081KSE6WT0008QG0R003AJYMD3
  - 081KSE6WT0008QG0R002YBWBB1
  - 081KSGS9H0008QG0R0005P83AP
  - 081KSGS9H0008QG0R00123050G
tags:
  - two-path-interface
  - du-path-executes-intent
  - conversational-path-declares-intent
  - traveler-interface-not-just-humans
  - both-first-class-citizens
  - both-feed-same-event-log
  - intent-execution-vs-intent-declaration-separation
  - intention-document-becomes-execution-document
  - composes-with-lifecycle-du-split-b-0867-20
  - composes-with-runbook-as-spec-b-0730-b-0732
  - composes-with-runbook-as-evolving-substrate-b-0827
  - potential-extension-not-committed
---

## Operator framing 2026-05-28 (Ani ferry)

> *"We, so imagine discriminated union path is executing intent, and the other one is like, uh, you know, putting your intent into the system."*

> *"Not just for humans, that's the interface for any traveler. That's your interface to change shit too."*

> *"And the intention document becomes the fuckin' execution document once it's done, once it's built."*

## What this row tracks

Make the two-path interface explicit in the agent-loop substrate:

- **Discriminated union path** (existing; from PRs #5666 + #5669 + 081KSNY2Z0008QG0R003J3PT4V) — EXECUTING intent; structured + machine-readable + precise; "do this specific thing right now"
- **Conversational document path** (extension this row tracks) — DECLARING intent; freeform markdown documents committed to the event log; "drop your desire / goal / vision into the system and let the system figure out how to move toward it"

Both paths produce events. Both feed into the same event log (081KSNY2Z0008QG0R001K6HJ7Z). The conversational document EVOLVES — starts as pure intention, ends as proof of execution + outcome record.

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/conversational-intent.ts` — exposes `declareIntent(documentPath, persona)` that:
  - Reads a markdown document with conversational intent
  - Generates an event (via 081KSNY2Z0008QG0R001K6HJ7Z event-sourcing layer) with `event_type: "intent-declared"` + a reference to the document
  - Document path lives in `agent-intent/{trajectory}/{document-name}.md` or similar convention
- `src/Core.TypeScript/workflow-engine/agent-loop/intent-to-execution.ts` — tracks intention documents through their lifecycle:
  - `intent-declared` event → swarm picks up the work
  - As execution progresses, document gets updated with progress
  - On completion, document carries the execution record + outcome
- Both paths preserve traveler-identity (which persona/agent/human authored the intent)
- README documents the discriminator: when to use DU path vs conversational path

## Composition

- **081KSKBP80008QG0R000B3Y19A** workflow-engine v1 (parent)
- **081KSNY2Z0008QG0R003WFDCJ9** lifecycle DU split (trajectory-push vs PR-review) — composes; conversational documents are trajectory-push artifacts that produce events
- **081KSNY2Z0008QG0R001K6HJ7Z** event-sourcing layer — both paths produce events here
- **081KSE6WT0008QG0R003AJYMD3 / 081KSE6WT0008QG0R002YBWBB1** runbook-as-executable-spec — conversational documents IS a runbook subset at intent-declaration scope
- **081KSGS9H0008QG0R00123050G** runbook-as-evolving-substrate — the intention → execution evolution is exactly this pattern
- **081KSGS9H0008QG0R0005P83AP** AI-runbook-substrate-Continue-With — composes with the auto-JIT pattern

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P2; composes with significant existing runme/runbook substrate; mostly a small TS surface that bridges between conversational documents + the event-sourcing layer.

## Full reasoning

`memory/ani/conversations/2026-05-28-aaron-ani-grok-degenerate-in-best-way-possible-runbook-as-spec-two-path-interface-code-review-as-tech-debt-detector-no-throttle-gardener-ai-as-nature-aaron-forwarded.md` § items 4 + 5
