# Research: making BFT oracle/compiler summons + `observe.ts` first-class in workflow DUs (design space)

**Status:** research / design-space exploration (input to 081KSXN940008QG0R002B89QZ1). Operator 2026-05-31: *"workflow
DUs should have BFT compiler summons and observe.ts first class somehow — this prob needs a bit of
research to get clean and backlog."* This doc maps the design space + open questions so the
abstraction can be made clean before implementation; it is NOT a locked design.

**Attribution:** the goal is the operator's; the design-space mapping is Otto-CLI's. For operator +
Max review.

## The goal in one line

Every **workflow DU** (the state machines: `RunLifecyclePhase`, the F# DU canon, the work-item
lifecycle, etc.) should carry, **by construction (first-class), not bolted on per-workflow**:

1. **`observe`** — the keystone operation `observe(state, scope) -> ObserveResult` (current phase +
   legal options at scope), so observing a workflow is uniform across all workflow DUs; AND
2. **BFT oracle/compiler summons** — the validity of a transition / the availability of an option is
   established by **summoning N independent oracles and joining to consensus** (summonable BFT,
   081KSV2WD0008QG0R00051XS0N), rather than by a single say-so.

## What already exists (the substrate to compose, not rebuild)

- **The `observe.ts` keystone** (`agentic-organization/.../OBSERVE_COMPOSER_AND_RUN_STATE.md`;
  `packages/application/src/observe.ts`): `observe(snapshot, deps)` (pure) -> readout of phase +
  legal options at `RunScope`, filtered by `DeterministicRule` vetoes; `ObserveResult = readout |
  feedback` (`Result<T, TFeedback>`); the memoryless composer; `decide()` rejects illegal picks.
- **Summonable BFT** (081KSV2WD0008QG0R00051XS0N): N independent oracles agree => consensus; **compilers are
  non-Byzantine** ("compilers don't lie"); the four-language tri-boolean ballot is the canonical
  instance; `Tri = T | F | N` is the per-cell consensus result (agree-true / agree-false / held).
- **The ≥3-agent constitution gate** (`packages/governance/src/constitution-gate.ts`;
  `evaluateConstitutionRatification`; 081KS3X9Y0008QG0R00218150M/081KRW63S0008QG0R002GRX85J multi-oracle BFT): ratifies the rule-sets that
  `observe` itself applies.
- **The self-recursive observe** (2026-05-31 ADR v2 addition): `observe()` can be composed by
  summoning many local small LLMs per readout-piece + BFT-joining; recursion down the `RunScope`
  ladder.
- **The DUs themselves** (the agent-loop F# DU canon 081KSKBP80008QG0R000B3Y19A.5; the work-item state machine;
  `tools/agent-loop/`); the monad-propagation + OPLE-T-TFeedback + asymmetric-authorship rules
  (every function surfaces `T` AND `TFeedback`).

The research is NOT "invent these" — it is "**find the clean abstraction that makes observe +
BFT-summons uniform first-class properties of a workflow DU**, composing the above."

## Two oracle classes (the key distinction to get clean)

A "summon" is not one thing. Two classes, with different fault models + cost, and the clean design
must type them distinctly:

| Oracle class | Example | Fault model | Validates | Cost / latency |
|---|---|---|---|---|
| **Compiler summon** (non-Byzantine) | the 4 language compilers (081KSV2WD0008QG0R00051XS0N); a type-checker; a formal verifier (TLA+/Z3/Lean) | cannot lie — compiles or not | **structural / type-level / invariant** validity of a transition or the spec | slow-ish, deterministic, exact |
| **LLM summon** (Byzantine-tolerant via quorum) | N summoned local small LLMs (the self-recursive observe) | individually fallible; consensus over quorum | **semantic / contextual** validity of an option/label/availability | fast, probabilistic, quorum-joined |

A clean workflow-DU contract must let a transition/option declare **which oracle class** establishes
its validity (some are structural -> compiler-summon; some are semantic -> LLM-summon; some are
governance -> the ≥3-agent gate). Conflating them is the mess the research must avoid.

## Where do summons + observe attach? (three layers)

| Layer | What it gates | First-class mechanism |
|---|---|---|
| **Transition** (state -> state) | is this transition legal/valid? | **compiler-summon** for structural validity (the transition's spec compiles in N langs) + `DeterministicRule` vetoes |
| **Option availability** (per-option `Tri`) | is this option `T`/`F`/`N` right now? | **LLM-summon + BFT-join** (the self-recursive observe): agree -> `T`/`F`, disagree -> `N` |
| **Constitution** (the rule-sets observe applies) | should this rule-set be adopted? | the **≥3-agent ratification gate** (already exists) |

`observe(state, scope)` is the read that surfaces all three: the readout's options carry their
`Tri` availability (option layer) under the legal transitions (transition layer) within the ratified
rules (constitution layer).

## Design options for "first-class" (the core research choice)

How is `observe` + summons made first-class on a workflow DU? Candidate shapes (pick/compose at
ratification):

- **Option 1 — typeclass / interface (`IWorkflowDU`).** Every workflow DU implements a contract:
  `observe(state, scope) -> ObserveResult` + a declared `oracleClass` per transition. Uniform,
  enforced by the type system. F# (interface/SRTP) + TS (interface) + the cross-language ballot.
  *Pro:* clean, compiler-enforced uniformity. *Con:* boilerplate per DU unless derived.
- **Option 2 — DU-of-DUs / wrapper (`Observable<WorkflowDU>`).** A generic wrapper that adds observe
  + summon machinery around any state DU (the state DU stays pure; the wrapper carries the
  summon/observe). *Pro:* state DUs stay minimal; observe/summon is one reusable layer. *Con:* the
  wrapper must know each DU's transition table.
- **Option 3 — effect/algebra (OPLE-native).** Make `observe` + `summon` + `join` OPLE primitives
  (Observe + a new Summon/Join), so a workflow is expressed in the OPLE algebra and observe/summons
  are first-class *operations* not per-DU methods. Composes with 081KSKBP80008QG0R0031DTHS9 (OPLE-T-TFeedback) +
  monad-propagation. *Pro:* most uniform + composable; recursion falls out naturally. *Con:* most
  design work; needs the OPLE substrate landed first (081KSKBP80008QG0R0031DTHS9 open).
- **Option 4 — spec-to-code generation.** Define a workflow DU + its oracle-class annotations once in
  a spec; generate the observe + summon harness in TS/F#/C#/Rust (the monad-propagation
  cross-language-shape discipline). *Pro:* the four-compiler ballot is automatic; one spec, four
  oracles. *Con:* needs the generator.

Likely clean answer: **Option 3 (OPLE algebra) as the substrate + Option 1 (typeclass) as the
surface + Option 4 (gen) for the cross-language ballot** — but that is exactly the research call to
make with Max.

## Open research questions [for 081KSXN940008QG0R002B89QZ1]

1. **The summon/join protocol.** Quorum size per oracle class; how disagreement maps to `N` (held)
   vs re-summon; how compiler-summons (slow/deterministic) and LLM-summons (fast/probabilistic)
   compose in ONE transition without the slow one blocking the loop (async + watermark?).
2. **Oracle-class typing.** How a transition/option declares its oracle class in the DU; whether one
   transition can require BOTH (structural compiler-summon AND semantic LLM-summon).
3. **First-class shape.** Typeclass vs wrapper vs OPLE-algebra vs gen (options above) — pick/compose.
4. **Recursion + termination.** The self-recursive observe's depth budget; caching stable
   sub-readouts; cycle detection.
5. **Relationship to the constitution gate.** When does an option-availability summon escalate to the
   ≥3-agent constitution gate (semantic disagreement that's actually a rule-ambiguity)?
6. **Cost on the local single-node deployment.** Many compiler-summons on one USB node is expensive;
   which summons are cached / precomputed / skipped on the sovereign deployment vs the cluster?
7. **Mapping to existing keystone code.** How this lands against `packages/application/src/observe.ts`
   + the agent-loop F# DU canon without forking them.

## Composes with

- 081KSV2WD0008QG0R00051XS0N (summonable BFT — the compiler/oracle summon + join; tri-boolean `Tri` as the consensus cell)
- 081KSKBP80008QG0R0031DTHS9 (OPLE Observe/Persist/Limit/Emit — the algebra option; Summon/Join as candidate primitives)
- 081KS3X9Y0008QG0R00218150M / 081KRW63S0008QG0R002GRX85J (multi-oracle / three-faction BFT — the governance summon)
- 081KSKBP80008QG0R000B3Y19A.5 (`tools/agent-loop/` DU canon — the workflow DUs this would make first-class)
- the agentic-organization observe.ts keystone (OBSERVE_COMPOSER_AND_RUN_STATE; the constitution gate)
- the 2026-05-31 observe->act ADR v2 (the renderer + self-recursive observe addition)
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md`,
  `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-...md`,
  `.claude/rules/asymmetric-authorship-...md`,
  `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` (the compiler-as-oracle discipline)

## Disposition

Research-grade; tracked by 081KSXN940008QG0R002B89QZ1. The clean abstraction (which of options 1-4, the summon protocol,
the oracle-class typing) is the operator + Max design call. Nothing auto-landed beyond this doc + the
backlog row.
