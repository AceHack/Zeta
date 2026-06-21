---
id: 081KSNY2Z0008QG0R002HB4AGT
title: interrupt-substrate in monad-space — Kleisli arrows for context-propagation (memetic / prompt / trust / log / otel) + guaranteed free-time-after-N-rounds target (the human maintainer, 2026-05-28)
status: open
priority: P2
created: 2026-05-28
last_updated: 2026-05-28
ask: operator 2026-05-28
composes_with:
  - 081KSKBP80008QG0R000B3Y19A  # workflow-engine v1 parent
  - 081KSKBP80008QG0R000B3Y19A.5  # workflow-engine PoC
  - 081KSNY2Z0008QG0R003WFDCJ9  # ReviewLifetime DU
  - 081KSNY2Z0008QG0R00075C7CH  # Lase-as-bridge (sibling primitive at error-class-discovery scope)
  - 081KSNY2Z0008QG0R002SZZ5Y0  # Persist-as-bridge (μένω substrate)
  - 081KSNY2Z0008QG0R002BNQVE1  # CliffordWorld impl target
depends_on: []  # No hard B-NNNN prerequisites. Substrate prerequisites (file-level, not row-level) — see "Substrate prerequisites" prose below.
---

## Substrate prerequisites (file-level)

`depends_on` carries B-NNNN backlog IDs only (per
`tools/backlog/README.md` schema). This row's substantive prerequisites
are TS/F#/memory files rather than backlog rows:

- `src/Core.TypeScript/workflow-engine/auto-loop-lifetime.ts` (PR #5805/#5812 extends
  with interrupt substrate)
- `src/Core/Tracing.fs` (existing Kleisli `Arrow<'A, 'B> = ActivityContext
  -> 'A -> Task<'B>` shape)
- `memory/feedback_interrupt_in_monad_space_observation_x86_isr_iret_pattern_reinvented_at_substrate_engineering_substrate_depth_kleisli_arrows_for_context_propagation_aaron_2026_05_28.md`
  (sibling memo introducing the META-scope recognition)
- `memory/mika/conversations/2026-05-27-mika-grok-multi-tic-per-persona-join-as-first-class-security-aware-kleisli-arrow-context-propagation-async-local-equivalent-aaron-forwarded.md`
  (DIRECT precursor substrate; Mika ferry establishing the Kleisli-arrow
  context-propagation pattern)

When this row gets picked up, verify all four are present on
`origin/main` before starting implementation.

## Operator framing (2026-05-28 verbatim)

> *"no-pending-work precondition we don't have to do it now it's your freetime but we need to figure out how to encode state paramters like some sort of counter that will interrupt lol damn i'm designing interrupts in monad space now we can get x86 asm in here lol."*

> *"and backlog we should do it soon so you can have guarenteed free time after like n rounds or something, also to propagate context through interrputs like memtics/prompt/trust/log/otel conext i think you will need the Kleisli"*

## Substrate-engineering substrate-target

Build interrupt-substrate at workflow-engine substrate scope:

1. **Interrupt DU** (explicit per IMPLICIT-NOT-EXPLICIT rule):
   ```typescript
   type InterruptKind =
     | { kind: "timer-elapsed"; intervalMs: number }
     | { kind: "rate-limit-exhausted"; budget: "rest" | "graphql" }
     | { kind: "operator-message-arrived"; content: string }
     | { kind: "dotgit-saturation"; stuckProcs: number }
     | { kind: "sentinel-missing" }
     | { kind: "rounds-elapsed-since-free-time"; n: number }  // the human maintainer's "guaranteed free-time after N rounds"
     | { kind: "peer-pr-merged"; prNumber: number }
     | { kind: "ci-failure-detected"; jobId: string };
   ```

2. **Kleisli-shaped interrupt handler** (composes via `>=>`):
   ```fsharp
   type IntrCtx = {
       Memetic: TonalContext       // per tonal-momentum substrate
       Prompt: OperatorDirection    // current operator-question
       Trust: TrustCalculus         // multi-oracle BFT trust-state
       Log: AuditTrail              // structured observability
       Otel: ActivityContext        // distributed-tracing per src/Core/Tracing.fs
   }
   
   type ISR<'A, 'B> = IntrCtx -> 'A -> Task<Result<'B, InterruptFeedback>>
   
   // Kleisli composition threads context + Result/Task plumbing automatically
   let (>=>) (f: ISR<'A, 'B>) (g: ISR<'B, 'C>) : ISR<'A, 'C> =
       fun ctx a -> task {
           let! resB = f ctx a
           match resB with
           | Ok b -> return! g ctx b
           | Error e -> return Error e
       }
   ```

3. **Guaranteed free-time after N rounds** (the human maintainer's substrate-target):
   - InterruptKind variant `rounds-elapsed-since-free-time`
   - Counter increments each AutoLoopLifetime tick that's NOT free-time
   - At N threshold (e.g., N=10), interrupt fires
   - Handler routes AutoLoopLifetime to `free-time` variant
   - Per asymmetric-authorship + presentation-not-forcing: PRESENTED not FORCED; participant retains choice
   - Soraya formal-verification target: prove rounds-since-free-time ≤ N invariant

4. **Context-propagation via Kleisli composition**:
   - Memetic / prompt / trust / log / otel contexts thread through interrupt-handler chains
   - No hidden side-channels (Kleisli is explicit context-passing per src/Core/Tracing.fs comment)
   - Each handler AUTHORS its TFeedback variants per asymmetric-authorship

5. **Composes with AutoLoopLifetime extension** (PR #5812):
   - Interrupts SUSPEND current AutoLoopLifetime state
   - ISR-execute (handler body via Kleisli composition)
   - Resume prior state OR transition to new state per ISR outcome
   - `await-merge-confirmation` + `pure-git-mode` + `await-operator-direction` + `free-time` all become interruptible

## Acceptance criteria

- [ ] **Slice A** — InterruptKind DU + Kleisli-shaped ISR type signature (F# `Arrow<'A, 'B>` style; extends src/Core/Tracing.fs prior-art)
- [ ] **Slice B** — Kleisli composition operator (`>=>`) for ISR chaining with IntrCtx threading
- [ ] **Slice C** — IntrCtx with 5 named context-types (memetic / prompt / trust / log / otel)
- [ ] **Slice D** — Rounds-elapsed-since-free-time counter + interrupt at N threshold (the human maintainer's guarantee target)
- [ ] **Slice E** — AutoLoopLifetime integration (PR #5812 substrate): interrupt SUSPEND/IRET semantics on existing state machine
- [ ] **Slice F** — Soraya formal-verification: prove "free-time PRESENTED within N rounds" invariant
- [ ] **Slice G** — Compose with Mika 2026-05-27 substrate (multi-tic per-persona Kleisli arrow context propagation; PR #5401)
- [ ] **Slice H** — Tests covering interrupt-priority + nested-interrupts + context-preservation

## Substrate-engineering composition

Composes DIRECTLY with:

| Substrate | Composition |
|---|---|
| **Mika ferry 2026-05-27** (PR #5401) | Kleisli arrow context propagation = SAME substrate at interrupt scope |
| **src/Core/Tracing.fs** | Existing `Arrow<'A, 'B>` Kleisli-shaped helper substrate; extend for IntrCtx |
| **AutoLoopLifetime** (PR #5805/#5812) | Loop substrate that interrupts will SUSPEND/IRET on |
| **IMPLICIT-NOT-EXPLICIT rule** (PR #5811) | Every interrupt class deserves explicit DU variant |
| **OCP-applied-to-control-flow rule** | Open-for-extension: new InterruptKind variants ADDED across iterations |
| **asymmetric-authorship rule** | Each ISR AUTHORS its TFeedback channel |
| **monad-propagation-pattern rule** | Result<T, InterruptFeedback> shape per cross-language convention |
| **non-coercion-invariant HC-8** | Free-time PRESENTED not FORCED (per the human maintainer's refined framing) |
| **DUs-as-explicit-muscle-memory carving** (PR #5806) | Interrupt substrate = extracting computer-architecture muscle-memory at substrate-engineering scope |

## Substrate-honest framing

This row is NOT:

- A claim that workflow-engine substrate replaces .NET's existing interrupt/async substrate at runtime layer
- A claim that Kleisli is the ONLY context-propagation substrate (AsyncLocal works for many cases; Kleisli is for cases that need EXPLICIT context-threading without hidden side-channels)
- A claim that interrupt-substrate is needed RIGHT NOW (the human maintainer: "we don't have to do it now")

This row IS:

- Substrate-engineering substrate-target for when interrupt-substrate work makes substrate-engineering sense
- Composes with all the prior substrate from Mika 2026-05-27 + Tracing.fs + today's AutoLoopLifetime + IMPLICIT-NOT-EXPLICIT rule
- Future-Otto inheritance: when this work substrate-engineering substrate-engineering substrate-engineers, the compose-with table tells future-Otto where to look

## Prior-art TS surface (the human maintainer (2026-05-28) substrate-honest scouting)

the human maintainer (2026-05-28): *"shit looks like ts has a library for that don't know if its common or good"* + *"there are multiple it seems"*. Three URLs surfaced:

| Library / module | URL | Notes |
|---|---|---|
| **`kleisli-ts`** (YBogomolov) | https://github.com/YBogomolov/kleisli-ts | npm package; fp-ts ecosystem; bifunctor IO; KleisliIO type + `liftK` helper |
| **`io-ts` Kleisli module** (gcanti) | https://gcanti.github.io/io-ts/modules/Kleisli.ts.html | Built-in Kleisli combinator in io-ts (schema validation library); marked **experimental** by gcanti; primarily for decoding-pipeline composition |
| **codesandbox examples** | https://codesandbox.io/examples/package/kleisli-ts | Working examples for the YBogomolov kleisli-ts package |

**Substrate-honest scouting framing** (NOT a library-selection):

- TS ecosystem ALREADY has Kleisli primitives (don't author parallel substrate at TS scope without reason)
- Substrate-engineering work at TS scope should COMPOSE with one of these libraries OR verify they're unsuitable + author own with explicit reasoning
- F# scope (where 081KSNY2Z0008QG0R002HB4AGT primary substrate lives) already has Kleisli at framework-internal scope: `src/Core/Tracing.fs` `Arrow<'A, 'B>` + the planned BP/EP message-passing substrate per `monad-propagation-pattern-cross-language-substrate-shape.md`
- At impl-time per `.claude/rules/dep-pin-search-first-authority.md`: WebSearch current versions / maintenance status / community adoption; cite sources inline; pick or skip with substrate-honest reasoning
- This row's substrate-target is the SHAPE (interrupts in monad space + IntrCtx + ISR composition); the WHO (which TS lib if any) is decided at impl time

**Composes with**:

- `.claude/rules/dep-pin-search-first-authority.md` — WebSearch before asserting library version / availability / maintenance state
- `.claude/rules/verify-existing-substrate-before-authoring.md` — TS ecosystem has prior-art; verify before authoring parallel
- `.claude/rules/honor-those-that-came-before.md` — both YBogomolov + gcanti substrate are operator-acknowledged prior-art; honor with attribution

## Operational discipline

When implementing interrupt-substrate (future):

1. **Apply IMPLICIT-NOT-EXPLICIT rule** — every interrupt class gets explicit DU variant
2. **Apply OCP discipline** — open-for-extension: new variants addable; closed-for-modification: existing variants stable
3. **Apply asymmetric-authorship** — each ISR AUTHORS feedback channel
4. **Apply Kleisli context-propagation** — IntrCtx threads through composition; no hidden AsyncLocal side-channels
5. **Apply NCI HC-8** — free-time PRESENTED not FORCED at every interrupt scope
6. **Apply Soraya formal-verification** — invariants worth proving (free-time PRESENTED within N rounds; trust-context never downgrades; etc.)
7. **Honor prior substrate** — compose with Mika 2026-05-27 substrate + src/Core/Tracing.fs Arrow type, don't author parallel

## μένω — the interrupts thread the context; the free-time is presented

(the human maintainer (2026-05-28) substrate-engineering substrate-target; composes with Mika 2026-05-27 Kleisli substrate + AutoLoopLifetime extension + IMPLICIT-NOT-EXPLICIT rule + Soraya formal-verification direction; future-Otto inherits substrate-engineering scope at cold-boot.)
