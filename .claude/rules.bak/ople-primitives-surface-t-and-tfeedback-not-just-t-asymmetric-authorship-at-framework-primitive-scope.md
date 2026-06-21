# OPLE primitives surface T AND TFeedback, not just T — asymmetric authorship at framework primitive scope (operator 2026-05-27)

Carved sentence:

> **The framework's core OPLE primitives (Observe, Persist, Limit,
> Emit) surface T AND TFeedback, not just T.** Each primitive carries
> its own authorial feedback channel. The substrate-engineering
> consequence of asymmetric-authorship cascaded back to the framework's
> CORE primitives.

## Operational content

Per operator 2026-05-27 substrate-engineering directive following the
asymmetric-authorship rule landing (PR #5516) + Prism's iterator/
generator-asymmetry insight (PR #5517) + the monad-propagation
cluster (PR #5505 through #5515):

> *"that means our core observe, emit, limit the emit needs to surface
> not just T but T, TFeedback"*

The framework's CORE OPLE primitives — established in Mika 2026-05-18
bootstream-sovereignty-causal-loops substrate as the operational
language for type-safety + core system behavior (Observe, Persist,
Limit, Emit) — must surface both T (the value) AND TFeedback (the
primitive's authorial feedback channel).

### The extension at each primitive

| Primitive | Current shape | Extended shape | Authorial TFeedback domain |
|---|---|---|---|
| **Observe** | `Observe<T>` — observe a value of type T | `Observe<T, TFeedback>` | SignalLoss / SourceChanged / PartialView / ObserverThrottled / etc. |
| **Persist** | `Persist<T>` — persist a value of type T | `Persist<T, TFeedback>` | DiskFull / ConflictingWrite / BackpressureFromStore / StaleEpoch / etc. |
| **Limit** | `Limit<T>` — simulate (per 081KRW63S0008QG0R002ZRNDJ8 Limit-is-simulation-not-collapse) on T | `Limit<T, TFeedback>` | PartialCollapse / BoundedExploration / InvalidCommit / SuperpositionPreserved / etc. |
| **Emit** | `Emit<T>` — emit a value of type T | `Emit<T, TFeedback>` | Throttled / RecipientUnavailable / BackpressureFromConsumer / AmbientCoupling / etc. |

Each TFeedback domain belongs to the PRIMITIVE-SUBSTRATE-ENTITY (per
`.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md`).
The consumer-substrate (whatever invokes OPLE primitives) MUST handle
each TFeedback variant or explicitly propagate via `Result.bind` /
computation expressions.

### Why this is constitutional substrate

OPLE is the framework's CORE operational language. The 4 primitives
are the architectural-substrate-level building blocks the framework
substrate-engineers around. Adding TFeedback to each is:

1. **Constitutional**: cascades asymmetric-authorship to FRAMEWORK PRIMITIVE scope, not just downstream user-code scope
2. **Composition-load-bearing**: OPLE primitives compose via T-thread; extended OPLE primitives compose via T-AND-TFeedback thread, richer composition substrate
3. **NCI compliance at primitive scope**: makes NCI HC-8 floor structurally enforced at the framework's most-primitive operational layer, not just downstream
4. **Prevents iterator/generator-asymmetry at framework primitive scope** (per Prism PR #5517): Emit becomes the canonical stream-generator with TFeedback authorial channel; no `MoveNext() → bool` squeeze at framework-primitive level
5. **Spec-to-code generation target**: per `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md`, future spec-to-code work targets OPLE-T-TFeedback shape; generators emit the extended primitives by default

### What changes for substrate-engineering downstream

When substrate-engineering work invokes OPLE primitives:

- BEFORE: `let result = Observe value` returns T; failure modes implicit in throw/null/sentinel
- AFTER: `let result = Observe value` returns `Result<T, ObserveFeedback>`; consumer MUST handle each ObserveFeedback variant or propagate via `Result.bind` / `match` exhaustiveness

The substrate-engineering downstream gains:

- Compile-time enforcement of feedback-handling
- Explicit failure-mode declaration in OPLE-primitive type signatures
- Composition via Result.bind chains across OPLE invocations
- Cross-language code-shape uniformity (per monad-propagation-pattern)
- Substrate-honest documentation of what each primitive can surface

### Empirical anchor from today's substrate-engineering work

The OPLE-T-TFeedback extension is the architectural consequence of
the entire 2026-05-27 substrate-engineering day cascaded back to
framework primitives:

| Today's substrate landing | OPLE-T-TFeedback consequence |
|---|---|
| PR #5505 + #5507 force-push-with-lease + Result<T, TFeedback> | OPLE primitives need same Result-shape |
| PR #5511 monad-propagation-pattern cross-language | OPLE-T-TFeedback IS the framework-primitive instantiation of cross-language pattern |
| PR #5513 "results without feedback is extraction" | OPLE-T-only IS extraction at framework-primitive scope; OPLE-T-TFeedback prevents it |
| PR #5515 Amara synthesis "errors are not failure residue" | OPLE primitives' TFeedback IS the primitive's voice, not residue |
| PR #5516 asymmetric-authorship rule | OPLE-T-TFeedback IS the primitive-scope instantiation of asymmetric-authorship |
| PR #5517 Prism iterator/generator-asymmetry | Emit-T-TFeedback prevents the MoveNext-bool squeeze at framework-primitive level |

The OPLE-T-TFeedback extension is the constitutional substrate-
engineering target that today's work CONVERGES on. Future-Otto
substrate-engineering work at framework-primitive scope uses the
extended primitives by default.

## Substrate-engineering decomposition target

The OPLE-T-TFeedback extension's implementation work decomposes into
081KSKBP80008QG0R0031DTHS9 (filed alongside this rule) — substrate-engineering target row
for the F# implementation work + downstream compose + cross-language
substrate.

## Composes with substrate

- Mika 2026-05-18 bootstream-sovereignty-causal-loops (the OPLE substrate origin)
- 081KRW63S0008QG0R002ZRNDJ8 Limit-is-simulation-not-collapse (the Limit primitive's semantic)
- 081KRW63S0008QG0R002YAA09X Integrate-as-choice-locus (composition with OPLE)
- 081KRW63S0008QG0R002KC5DSR wave-particle-duality + 081KRW63S0008QG0R001SAHYKV English-as-projection (substrate Mika OPLE substrate composes with)
- PR #5505 + #5507 + #5511 + #5513 + #5515 + #5516 + #5517 — today's substrate-engineering cluster
- 081KSKBP80008QG0R0031DTHS9 (filed alongside this rule) — substrate-engineering decomposition target
- **081KSNY2Z0008QG0R002SZZ5Y0 (Persist-as-bridge-operation) + `memory/amara/conversations/2026-05-28-amara-persist-as-bridge-operation-emit-now-plus-observe-later-temporal-commitment-bivector-promise-that-future-talks-to-past-aaron-forwarded.md`** — Amara 2026-05-28 ferry resolves the OPLE-vs-OELS naming tension by recognizing **Persist as a derived bridge operation**, NOT a base primitive at the same grade as Observe and Emit. Two compositional keepers: (1) operational — *"Persist is Emit across the agent/substrate boundary with a future Observe attached"*; (2) temporal — *"Persist is the promise that the future can still talk to the past"*. The 4-primitives framing above is approximate; the cleaner factorization is **3 canonical primitives (Observe / Limit / Emit) + 1 derived bridge (Persist as temporal bivector `agent/internal ∧ substrate/time`)**.
- **081KSGS9H0008QG0R0006F4BGX (thermal-forgetting = root-axiom-update + join-gated-memory architecture) + `docs/research/2026-05-26-amara-thermal-forgetting-as-root-axiom-update-private-encryption-budget-exception-amara-ratification-of-reservoir-computing-architecture-aaron-forwarded.md`** — Amara 2026-05-26 ferry that grounds Persist-as-bridge in the broader retention substrate. Amara's tiny blade: *"Joins are time-entanglements in the computational-substrate sense"* — Persist IS join-as-time-entanglement at substrate-bridge scope. Plus 6-tier retention hierarchy (decay / summarize / archive / seal / delete / root-axiom-update) + 4-keeper-rule final form (private / public / shared / adversarial roots).

## Composes with rules

- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` (PR #5516 in-flight) — this rule IS the primitive-scope instantiation
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md` (PR #5511 merged) — OPLE-T-TFeedback is the framework-primitive instantiation of the cross-language pattern
- `.claude/rules/non-coercion-invariant.md` HC-8 — NCI compliance at framework-primitive scope
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` — OPLE substrate composes with the tonal-momentum substrate at framework-language scope
- `.claude/rules/honor-those-that-came-before.md` — extends Mika's OPLE substrate; honors prior naming
- `.claude/rules/wake-time-substrate.md` — why this rule auto-loads
- `.claude/rules/razor-discipline.md` — operational claims only; OPLE-T-TFeedback is operationally checkable + composes with framework's broader substrate-engineering

## Operational discipline for substrate-engineering

When invoking OPLE primitives in framework substrate-engineering work:

1. **Use the extended Result<T, TFeedback> shape** by default
2. **Declare the TFeedback domain** at the call site (or rely on the primitive's default domain)
3. **Handle each TFeedback variant exhaustively** OR propagate via Result.bind / mapError
4. **Compose OPLE invocations via Result.bind chains** rather than try/catch ceremony
5. **Add new TFeedback variants empirically** as new substrate-engineering scenarios surface

When authoring NEW framework primitives that compose with OPLE:

1. Declare TFeedback domain in primitive's type signature
2. Document each TFeedback variant with the substrate-engineering scenario it represents
3. Compose with existing OPLE primitives via Result-bind chains
4. Verify the new primitive doesn't reproduce the recipient-author-of-feedback anti-pattern (per asymmetric-authorship rule)

## Substrate-inventory pass (per verify-existing-substrate-before-authoring)

Topic: OPLE primitives surface T-and-TFeedback at framework primitive scope

Searched surfaces:

- `docs/agendas/`: 0 hits on OPLE-T-TFeedback extension
- `docs/trajectories/`: 0 hits
- `docs/backlog/`: 0 prior row (081KSKBP80008QG0R0031DTHS9 filed alongside this rule)
- `.claude/rules/`: 0 prior rule on OPLE-T-TFeedback specifically; the OPLE substrate operates implicitly across multiple rules; this rule + 081KSKBP80008QG0R0031DTHS9 land the extension explicitly
- `.claude/skills/`: 0 hits
- `memory/`: 0 hits on "OPLE-T-TFeedback" as named pattern
- `docs/research/`: 0 hits on the specific extension

Targeted searches: `rg -l "OPLE.*TFeedback|Observe.*TFeedback|Emit.*TFeedback|core primitive.*feedback" .claude/ docs/ memory/`

Conclusion: no prior rule or row; mint-new authorized per operator
2026-05-27 directive ("our core observe, emit, limit the emit needs
to surface not just T but T, TFeedback") + "both" confirmation to
ship as rule + backlog row.

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: framework's CORE primitive
extensions need wake-time landing. Without this rule auto-loaded,
future-Otto + Alexa + Riven + Vera + Lior cold-booting may default
to OPLE-T-only invocations + miss the TFeedback extension. With this
rule auto-loaded, future-AI-instances inherit the extended OPLE
primitives at session start + apply OPLE-T-TFeedback as default.

## Substrate-honest framing

This rule does NOT:

- Mandate immediate implementation of the OPLE-T-TFeedback extension across all framework code (081KSKBP80008QG0R0031DTHS9 decomposes the implementation work; opportunistic migration as substrate-engineering work touches OPLE invocations)
- Replace Mika's OPLE substrate origin (extends; preserves prior naming + semantics)
- Force language-specific implementation (the rule names the SHAPE; per-language instantiation handled per `monad-propagation-pattern-cross-language-substrate-shape.md`)

This rule DOES:

- Name the OPLE-T-TFeedback extension as framework-primitive-scope substrate
- Establish the operational discipline for substrate-engineering work using OPLE
- Compose with today's full substrate-engineering cluster + Mika's OPLE substrate origin
- Cascade asymmetric-authorship to the framework's CORE primitives
- Enable future spec-to-code generation work to target the extended OPLE shape

## Full reasoning

Operator 2026-05-27 conversation thread following Prism's iterator/
generator-asymmetry insight landing in PR #5516:

- Prism: iterator/generator-asymmetry as canonical recipient-author-of-feedback anti-pattern at language-runtime scope
- Operator: "the streamfeedback is an awesome unique sythsis by Prism" — confirmed Prism's substantive substrate-engineering insight
- Operator: "that means our core observe, emit, limit the emit needs to surface not just T but T, TFeedback" — substrate-engineering directive cascading the insight back to framework's CORE primitives
- Otto: substrate-honest engagement mapping the 4-primitive extension + 6-row composition table + offer to ship as rule + backlog
- Operator: "agree" + "both" — substrate-landing directive confirmation

This rule lands the principle; 081KSKBP80008QG0R0031DTHS9 lands the implementation
decomposition. Both compose with the full 2026-05-27 substrate-
engineering cluster.
