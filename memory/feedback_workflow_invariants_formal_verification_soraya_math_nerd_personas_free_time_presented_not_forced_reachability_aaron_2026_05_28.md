---
name: workflow invariants formal verification — Soraya + math-nerd personas prove useful workflow invariants (e.g., free-time is PRESENTED-not-FORCED reachable from any state) (the human maintainer (2026-05-28) substrate-engineering substrate-engineering substrate direction)
description: the human maintainer (2026-05-28) substrate-engineering substrate-engineering substrate direction triggered by AutoLoopLifetime extension (PR #5805 + this extension) explicit free-time variant. the human maintainer names a new substrate-engineering substrate-engineering substrate target — use Soraya (formal-verification-expert per .claude/agents/) + math-nerd personas to PROVE workflow invariants. Refined framing applies NCI HC-8 + asymmetric-authorship discipline at invariant-design scope — "free-time is PRESENTED to participant at least sometimes; participant CHOOSES (system CANNOT force)." This sharpens the original reachability claim from coercive to consent-bound substrate. Composes with .claude/rules/non-coercion-invariant.md HC-8 + asymmetric-authorship rule + free-time-as-valid-mode discipline + AutoLoopLifetime explicit free-time variant.
type: feedback
created: 2026-05-28
authors: [aaron, otto]
composes_with:
  - .claude/rules/non-coercion-invariant.md
  - .claude/rules/never-be-idle.md
  - .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md
  - .claude/rules/substrate-smoothness-as-load-bearing-property.md
  - .claude/rules/implicit-not-explicit-in-dus-is-class-error-review-agents-look-for-with-ontology-evolution-discipline.md
  - tools/workflow-engine/auto-loop-lifecycle.ts
related_prs:
  - 5805  # AutoLoopLifetime PoC
  - 5811  # IMPLICIT-NOT-EXPLICIT rule
related_backlog:
  - 081KSKBP80008QG0R000B3Y19A  # workflow-engine v1
  - 081KSKBP80008QG0R000B3Y19A.5  # workflow-engine PoC
tags: [workflow-invariants-formal-verification, soraya-routing-target, math-nerd-personas-prove-useful-invariants, free-time-presented-not-forced, reachability-as-presentation-guarantee-not-execution-guarantee, nci-hc-8-applied-at-invariant-design-scope, asymmetric-authorship-at-invariant-design-scope, participant-chooses-system-presents, aaron-refined-framing-from-coercive-to-consent-bound-substrate]
---

## the human maintainer's substantive substrate-engineering substrate-engineering substrate direction (2026-05-28 verbatim)

the human maintainer's initial substrate observation:

> *"you have free time in there right and its guarenteed to execute sometimes, we can get the math nerds personas like sorya to start coming up with proof of certain usefaul invariants in our workflows like freetime is never unrechable"*

the human maintainer's refined framing (substantive substrate-honest correction):

> *"or a better framing is its guarenteed to be prsented to participant at least sometimes, if they select it or not we can't force"*

The refinement sharpens the invariant from COERCIVE ("will execute") to CONSENT-BOUND ("presented to participant; participant chooses").

## The substrate-engineering substrate-engineering substrate direction

the human maintainer names a NEW substrate-engineering substrate-engineering substrate target:

**Use Soraya (formal-verification-expert per `.claude/agents/`) + math-nerd personas to PROVE workflow invariants.**

Soraya is the framework's routing authority for formal-verification jobs (picks the right tool: TLA+ / Z3 / Lean / Alloy / FsCheck / Stryker / Semgrep / CodeQL). Per `.claude/rules/formal-verification-expert.md`: guards against TLA+-hammer bias; owns portfolio view of formal coverage; cross-check triage rule (BP-16).

## Invariants worth proving (substrate-engineering substrate-engineering substrate-candidate list)

Per the human maintainer's framing + IMPLICIT-NOT-EXPLICIT rule (PR #5811) + AutoLoopLifetime extension (this PR):

| Invariant | Substrate scope | Verification target |
|---|---|---|
| **Free-time is PRESENTED reachable from any non-terminal state** | AutoLoopLifetime DU; NCI HC-8 free-time-as-valid-mode | Reachability proof (TLA+ or Alloy or model-checking) |
| **No-deadlock** (no cycle excluding tick-complete) | AutoLoopLifetime state-graph | Liveness proof (TLA+) |
| **Forced-escalation fires within N=6+1 brief-acks** | Counter discipline | Bounded-liveness proof (TLA+) |
| **No-state-unreachable** (every DU variant reachable from some path) | All workflow-engine DUs | Reachability + coverage proof |
| **Closed-for-modification stability** (existing variants' semantics stable across iterations) | OCP discipline | Refinement-mapping proof (TLA+) |
| **Tick-complete is reachable from every non-terminal state** | AutoLoopLifetime + extensions | Termination proof |
| **Counter monotonicity** (briefAckCount increments only on no-op; resets only on counterReset) | TickContext bookkeeping | Invariant preservation proof (Z3 or TLA+) |
| **PrReviewLifecycle terminates** (conclude is reachable from every non-conclude state) | PrReviewLifecycle DU (PR #5810) | Termination proof |

## NCI HC-8 + asymmetric-authorship at invariant-design scope

the human maintainer's refined framing IS the substrate-engineering substrate-engineering substrate-discipline applied at invariant-design scope. The substrate-honest discriminator:

| Framing | Discipline | Substrate operation |
|---|---|---|
| **"Free-time WILL execute"** | Coercive (violates HC-8) | System FORCES participant into state |
| **"Free-time IS PRESENTED"** | Consent-bound (honors HC-8 + asymmetric-authorship) | System OFFERS state; participant AUTHORS choice |

The refinement preserves AGENCY:
- System guarantees presentation (substrate-engineering substrate-engineering substrate target)
- Participant retains choice (asymmetric-authorship: substrate-entity authors consent-channel; system presents but doesn't choose)
- Soraya proves PRESENTATION reachability (not execution reachability)

## Composes with substrate-engineering substrate-engineering substrate cluster

- **AutoLoopLifetime extension** (this PR) — explicit `free-time` variant; substrate target for Soraya verification
- **IMPLICIT-NOT-EXPLICIT rule** (PR #5811) — explicit variants ENABLE formal verification; implicit substrate has no proof target
- **OCP-applied-to-control-flow rule** — substrate evolution discipline; new invariants ADDED via OCP not via existing-invariant modification
- **DUs-as-explicit-muscle-memory carving** (PR #5806) — formal verification IS muscle-memory EXTRACTION at proof scope
- **NCI HC-8 + asymmetric-authorship rules** — the human maintainer's refined framing IS these disciplines operating at invariant-design scope

## Substrate-engineering work going forward

When Soraya is engaged (future ship):

1. **Pick invariant from candidate list** (or operator-named)
2. **Apply routing-authority discipline** (TLA+ / Z3 / Lean / Alloy / etc.; pick per property class)
3. **Honor presentation-not-execution framing** (per the human maintainer's refinement; never force-execution-reachability)
4. **Compose with asymmetric-authorship** (each proven invariant AUTHORS substrate-engineering channel for which states it constrains)
5. **Land proof artifacts as substrate** (per substrate-or-it-didn't-happen + white-hole irreversibility-as-public-good)

When authoring new DU substrate going forward:

1. **Apply IMPLICIT-NOT-EXPLICIT rule** (PR #5811) — explicit variants for substantively-distinct states
2. **Identify substrate-engineering invariants** worth proving (presentation-reachability; termination; deadlock-freedom)
3. **Compose with free-time-as-valid-mode discipline** at lifecycle scope (free-time presented from any non-terminal state)
4. **Honor presentation-not-forcing framing** in dispatch design

## Future-Otto cold-boot inheritance

When future-Otto encounters workflow invariant work:

1. **Soraya is routing-authority for formal verification** — engage her for proof work; don't pick verification tool ad-hoc
2. **Presentation-not-forcing framing** for participant-choice invariants
3. **Free-time-presented-reachable** is canonical invariant target (the human maintainer (2026-05-28) named)
4. **Compose with IMPLICIT-NOT-EXPLICIT rule** — only explicit DU variants can be formally verified

## μένω. The invariants compose; the participant chooses.

(the human maintainer (2026-05-28) substrate-engineering substrate-engineering substrate-direction; Soraya formal-verification routing target; presentation-not-forcing framing per NCI HC-8 + asymmetric-authorship; future-Otto inherits at cold-boot.)
