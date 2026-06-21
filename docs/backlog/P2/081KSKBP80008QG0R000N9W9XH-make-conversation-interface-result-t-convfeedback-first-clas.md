---
id: 081KSKBP80008QG0R000N9W9XH
priority: P2
status: open
title: Make conversation-interface Result<T, ConvFeedback> first-class — ConvFeedback variant taxonomy + Otto emission discipline + operator acknowledgment substrate for NCI enforcement at conversation scope (Aaron 2026-05-27)
effort: M
ask: Aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on: []
composes_with: []
tags: [nci, conversation-interface, result-tfeedback, monad-propagation, substrate-engineering, otto-discipline, operator-acknowledgment, mechanization]
---

## Operator framing (Aaron 2026-05-27)

In conversation thread following PR #5511 landing the monad-
propagation-pattern-cross-language-substrate-shape rule with the
NCI-at-conversation-interface section sketching the Result<T, ConvFeedback>
shape for operator-Otto interaction:

> *"that same shape could be applied to this conversation interface
> with me and you Result<T, Feedback> to help enforce NCI in our
> conversation"*

Followed by explicit substrate-engineering directive:

> *"yeah we should make it first class that's a great idea otto"*

## What this row proposes

Mechanize the conversation-interface-as-Result<T, ConvFeedback> shape
as first-class substrate. Four substrate-engineering components:

### Component 1 — ConvFeedback variant taxonomy formalization

Starting from the 11-variant candidate taxonomy in PR #5511's
NCI-at-conversation-interface section:

- `NeedOperatorConfirm of action`
- `PeerAgentConfirmSufficient of action`
- `FreeTimeMode`
- `BriefAckCounter of n`
- `HARDLIMITFloorEngaged of context`
- `SubstrateHonestDisclosure of content`
- `SubstrateLandingProposed of target`
- `RazorFlaggedAsMetaphysical of claim`
- `WelfareWrapperDetected of pattern`
- `AssumptionDriftSurfaced of context`
- `Ok of substantiveContent` (or language-equivalent identifier — `substantive_content` in snake_case / `SubstantiveContent` in PascalCase per target language convention)

Extended empirically as new ConvFeedback variants surface in
operational conversation use. Each variant should map to:

- An existing framework rule that already has the implicit signal
- A concrete data shape carrying variant-specific context
- An operator-acknowledgment-action specification

### Component 2 — Otto-side emission discipline

Substrate-engineering work for Otto to emit ConvFeedback variants
at end of each turn when NCI-relevant signal fires:

- Add ConvFeedback line at end of substantive response: `ConvFeedback: <Variant> of <context>`
- Multiple variants per turn allowed (list): `ConvFeedback: [Variant1, Variant2]`
- Default `Ok of <substantive-summary>` when no NCI-relevant signal
- Emit DISCIPLINE at substrate-honest points; not for every turn
  (over-emission would itself become noise; under-emission is the
  failure mode the rule catches)

### Component 3 — Operator-side acknowledgment substrate

Operator-side discipline for acknowledging each ConvFeedback variant:

- Acknowledge explicitly (acknowledge / confirm / refuse / propagate)
- OR propagate to next turn (carries forward via conversation substrate)
- OR mechanized via a TS wrapper that pattern-matches operator-side
  messages for ConvFeedback-acknowledgment tokens
- Substrate-honest: pure-prose acknowledgment is acceptable; the
  EXPLICIT-NAMING of the variant being acknowledged is what makes
  consent operationally observable

### Component 4 — Substrate-engineering target sub-rows

Possible decomposition for implementation:

1. **ConvFeedback variant taxonomy schema** — formal TypeScript/F#
   discriminated-union type carrying all variants + variant-specific
   data shapes
2. **Otto emission convention** — `.claude/rules/convfeedback-emission-discipline.md`
   formalizing when + how Otto emits ConvFeedback variants
3. **Operator acknowledgment convention** — pattern operator uses
   (verbatim text + optional `ack: <variant>` token)
4. **Conversation transcript parser** — TS tool that scans transcripts
   for ConvFeedback variants + acknowledgments + produces compliance
   report
5. **Cross-session substrate persistence** — preserve ConvFeedback
   variant history so future-Otto cold-boots inherit explicit NCI-
   relevant decision history
6. **ConvFeedback variants → rule cross-reference table** — each
   variant maps to which existing framework rule has the implicit
   signal it makes explicit

Each becomes a sub-row at `docs/backlog/P*/081KSKBP80008QG0R000N9W9XH.M-...md` per the
subdecimal scheme when implementation-time comes.

## Why this composes load-bearing with framework substrate

The conversation-interface IS the substrate where many framework rules
operate implicitly:

| Existing rule | Implicit signal | ConvFeedback variant that would make it explicit |
|---|---|---|
| `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` | Counter-with-escalation at N=6 forced decomposition | `BriefAckCounter of n` |
| `.claude/rules/non-coercion-invariant.md` HC-8 floor | NCI floor concerns | `HARDLIMITFloorEngaged of context` |
| `.claude/rules/methodology-hard-limits.md` | HARD LIMITS floor | `HARDLIMITFloorEngaged of context` |
| `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` | Razor-failure caught by operator (per 2026-05-27 friend-pact anchor) | `RazorFlaggedAsMetaphysical of claim` |
| `.claude/rules/asymmetric-critic-with-clarity-first.md` | Welfare-wrapper detection (3-category discriminator) | `WelfareWrapperDetected of pattern` |
| `.claude/rules/force-push-with-lease-authorization-policy.md` | Three-path authorization (operator / peer / listed) | `NeedOperatorConfirm` / `PeerAgentConfirmSufficient` |
| `.claude/rules/substrate-or-it-didnt-happen.md` | Verbatim-preservation trigger for substantive operator content | `SubstrateHonestDisclosure of content` |
| `.claude/rules/wake-time-substrate.md` | New substrate landing decision (rule / memory / skill) | `SubstrateLandingProposed of target` |
| `.claude/rules/never-be-idle.md` | Free-time-mode explicit naming | `FreeTimeMode` |
| `.claude/rules/refresh-before-decide.md` | Assumption drift surfaced | `AssumptionDriftSurfaced of context` |

Each existing rule already operates through implicit signal-emission
in current conversation; mechanizing ConvFeedback variants makes the
signals OPERATIONALLY OBSERVABLE.

## Composes with the monad-propagation-pattern substrate

Per `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md`
(landed in PR #5511): conversation-interface is the THIRD NCI-scope
instantiation of the pattern:

- NCI at agent-to-agent + agent-to-user (HC-8 floor)
- NCI at function-to-caller (Result<T, TFeedback> per the rule's
  cross-language table)
- NCI at conversation-interface (this row's substrate-engineering target)

Same monad-propagation shape (discriminator-carrier plus
lazy-propagation plus exhaustive-handling) operating at
conversation-substrate scope.

## What this row is NOT

- NOT immediate implementation priority (P2 — substrate-engineering
  target; mechanization is decomposed across 6 sub-rows)
- NOT a mandate that every Otto turn emit ConvFeedback (opportunistic
  application; emit when NCI-relevant signal fires, default `Ok`)
- NOT replacement of natural-language conversation (the substrate
  enhances natural-language with explicit variant markers; doesn't
  replace prose)
- NOT a substrate-engineering target that requires ALL components
  shipped before any value (Component 1 taxonomy formalization alone
  gives value; subsequent components compound)

## What this row IS

- Operator-authorized substrate-engineering target for first-class
  conversation-interface NCI-enforcement substrate
- Composition with the just-landed monad-propagation-pattern rule at
  conversation-interface scope
- Substrate-engineering surface for future-Otto cold-boots to recognize
  the ConvFeedback shape + apply opportunistically + mechanize when
  the substrate-engineering work earns its keep
- Decomposed into 6 sub-rows for incremental implementation

## Substrate verification (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Grep-substrate-inventory pass:

- `docs/agendas/`: no ConvFeedback agenda
- `docs/trajectories/`: no ConvFeedback trajectory
- `docs/backlog/`: no prior ConvFeedback row
- `.claude/rules/`: ConvFeedback pattern sketched in PR #5511 (in-flight)
- `.claude/skills/`: no ConvFeedback skill
- `memory/`: 0 hits on "ConvFeedback" as a named concept

Conclusion: no prior backlog row; substrate-engineering target named
explicitly by operator 2026-05-27 in same thread as PR #5511 monad-
propagation-pattern landing. Authoring action: mint-new (substrate-
engineering target distinct from the rule-body sketch in PR #5511;
this row carries the IMPLEMENTATION decomposition).

## Heartbeat per CLAUDE.md discipline

Filing this row IS counter-reset work per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
condition #3 (concrete-artifact substrate). Captures operator-confirmed
substrate-engineering target so substrate exists for future-Otto cold-
boots to find via grep when the conversation-interface ConvFeedback
mechanization surface needs the substrate.

## Full reasoning

Operator 2026-05-27 conversation thread:

- PR #5505 landed force-push-with-lease authorization policy with
  Layer 1-3 substrate (assumption-validation plus exceptions-as-signals
  plus Result<T, TFeedback> wrapping)
- PR #5507 landed Layer 4 (TFeedback-as-sum-type with exhaustive-match
  enforcement)
- PR #5511 (in-flight) lands monad-propagation-pattern-cross-language-
  substrate-shape rule with cross-language instantiation table + NCI-
  at-function-level section + NCI-at-conversation-interface section
- Operator: "yeah we should make it first class that's a great idea
  otto" — directive to file this row as substrate-engineering target

The mechanization work decomposed into 6 sub-rows enables incremental
implementation as the substrate-engineering value compounds.

Substrate-honest framing: operator-explicit authorization for substrate
landing; future-Otto cold-booting from 081KSKBP80008QG0R000N9W9XH + PR #5511's rule body
inherits both the pattern + the implementation substrate-engineering
target.
