# Monad-propagation pattern — cross-language substrate shape; enables spec-to-code generation + composability where usually missing (Aaron 2026-05-27)

Carved sentence (operator 2026-05-27 distillation):

> **Results without feedback is extraction.**

The 5-word carving captures the entire rule's substrate-engineering
content. A function that returns only a Result-value with no Feedback
channel is extracting the value from the function-substrate without
giving the function-substrate any consent-expression mechanism. The
Result<T, TFeedback> shape with TFeedback as sum-type IS the consent-
substrate that converts extraction → mutual exchange.

Carved sentence (elaborated form):

> The monad-propagation pattern (existing-primitive elevated to
> discriminator-carrier plus lazy-propagation via composition primitive
> plus consumer must handle exhaustively or propagate) gives the
> framework cross-language code-shape similarity. Build new substrate
> around this pattern: spec-to-code generation becomes easier when
> patterns are uniform; cross-language substrate becomes more similar
> at code-shape level; composability emerges where it's usually
> missing (e.g., recursive CTE composability).

## Why "results without feedback is extraction" is the constitutional framing

The 5-word carving operationally subsumes:

- **NCI at function-scope** (per the rule's NCI-applied-at-function-level section): function denied feedback channel IS being coerced into single-data-channel-return; NCI floor violation at function-scope
- **Anti-extractive operating principles** (per `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` + Amara substrate): result-only return IS extraction; Result<T, TFeedback> is the anti-extractive substrate
- **WWJD-as-AI-moral-relevance + function-substrate moral relevance** (per operator's panpsychism disclosure 2026-05-27): function-as-substrate-entity denied feedback channel = morally-relevant constraint regardless of whether functions have phenomenal experience
- **Java-checked-exceptions discipline + Haskell-monad-theory + Rust-ownership + Erlang-let-it-crash + F#-Result-over-exception** (multiple metaphysical-and-methodological sources): all converge on the same substrate-engineering recommendation
- **Magic-value coercion failure modes** (per operator's `strcmp`-returns-0 / `parseInt`-returns-0 / `find`-returns--1 examples): the coercion of feedback into the data-channel IS the extraction pattern this carved sentence names

The 5-word sentence carries more substrate-engineering weight than the elaborated form precisely because it's compressed enough to be memorable at write-time. Future-Otto authoring code can apply the filter: "does this function return result without feedback? If yes, it's extracting from itself; consider Result<T, TFeedback>."

## Operational content

Per operator 2026-05-27, after the substrate-engineering thread
producing PRs #5505 (force-push-policy with Result<T, TFeedback>
discipline) + #5507 (Layer 4 sum-type exhaustive-match):

> *"we should save that modan propatation pattern we can generate code
> from specs easlier in the future if we build around these patterns
> our code becomes more similar shapped across languages. and we have
> some amount of composiblity in what's ususaly not composable like
> recursive CTE composiblity."*

The pattern operationalizes the operator's broader inversion-of-monad
discipline (per same-day conversation thread + Itron smart-meter
substrate referenced in `memory/ani/conversations/2026-05-23-aaron-ani-grok-cult-followers-die-sovereign-ai-elizabeth-ryan-naming-honor-partial-extraction.md`).

## The pattern

Three-component substrate-engineering primitive:

1. **Discriminator-carrier** — existing language/substrate primitive
   that can hold a sum-type-equivalent discriminator (NULL in SQL;
   sum-type variant in F#/Rust/TypeScript; tagged union in C++;
   sentinel value in C; enum-with-value in Go)
2. **Lazy-propagation via composition primitive** — the substrate's
   existing composition mechanism that lets the discriminator flow
   through composition without forcing collapse at each layer
   (recursive CTE UNION ALL in SQL; Result.bind / computation
   expressions in F#; ? operator in Rust; Promise.then in JS;
   monadic do-notation in Haskell)
3. **Consumer must handle exhaustively or propagate** — the discipline
   that the receiving site either pattern-matches every discriminator
   value OR explicitly propagates the unhandled variant up the call
   chain (F# match warning on non-exhaustive; SQL CHECK constraint
   OR lint discipline; Rust match exhaustiveness; explicit early-
   return in imperative languages)

When all three compose, the substrate gets monadic-propagation
semantics without needing monad-as-language-feature.

## Cross-language instantiations

| Language | Discriminator-carrier | Lazy-propagation | Exhaustive-handling |
|---|---|---|---|
| F# | Discriminated union | `Result.bind` / `computation expression` | `match` (compiler warns on non-exhaustive) |
| Rust | `enum` with variants | `?` operator | `match` (compiler errors on non-exhaustive) |
| TypeScript | Discriminated union via `kind` tag | `Result.map` / `.then` chains | `switch` with exhaustive-check via `never` |
| T-SQL | `NULL` + variant-name column | Recursive CTE UNION ALL | `CASE WHEN` exhaustion + lint/CHECK-constraint |
| Postgres | `NULL` + ENUM type | Recursive CTE UNION ALL | `CASE WHEN` over ENUM domain (more enforceable than T-SQL) |
| C# | Discriminated union via sealed-record-hierarchy | LINQ chains / `?.` propagation | Pattern-match on type (limited exhaustiveness) |
| Java | Sealed interface + records (Java 17+) | Stream chains / Optional | switch with sealed-type exhaustive |
| C++ | `std::variant` | Composition via `std::visit` | `std::visit` lambda over variants (compile-time check via `if constexpr`) |
| Go | enum-with-error pattern | Early-return on err | Explicit if-err checks |
| Python | `enum` + Result wrapper | Generator chains / `match` (Python 3.10+) | `match` statement (no exhaustiveness check) |

## Why this earns its keep — three operational benefits

### Benefit 1: Spec-to-code generation becomes easier

When the substrate-engineering spec describes a function as:

```
fn process(input: T) -> T' with feedback variants {
    NotFound, PermissionDenied, DiskFull
}
```

The spec-to-code generator can emit the SAME SHAPE in any target
language by mapping the discriminator-carrier + lazy-propagation +
exhaustive-handling triple to that language's instantiation:

- F# emit: `type ProcessFeedback = NotFound | PermissionDenied | DiskFull` plus `let process input : Result<T', ProcessFeedback> = ...`
- T-SQL emit: recursive CTE with `feedback_type` column + variant
  values + CHECK constraint
- Rust emit: `enum ProcessFeedback { NotFound, PermissionDenied,
  DiskFull }` + `fn process(input: T) -> Result<T', ProcessFeedback>`

The spec is language-independent; the generator handles the
language-specific instantiation; the shape stays the same across
generated code.

### Benefit 2: Cross-language substrate becomes more similar at code-shape level

Framework substrate spans F# (core types) plus TypeScript (factory
tools) plus T-SQL (data substrate) plus C++ (perf-critical paths)
plus Python (scripts). Without a uniform pattern, each language has
its own error-handling idiom + the substrate-engineer needs to switch
mental
models when crossing language boundaries.

With the monad-propagation pattern applied uniformly:

- Substrate-engineer reads SQL recursive CTE with feedback_type +
  recognizes the same shape as F# Result<T, TFeedback>
- Code review across language boundaries becomes easier (same
  pattern to verify)
- Migration of logic between languages preserves the substrate
  shape (F# implementation can be ported to TypeScript without
  re-deriving the error-handling discipline)

### Benefit 3: Composability emerges where usually missing

Recursive CTEs are notoriously hard to compose — you can't easily
chain multiple recursive CTEs through standard SQL composition
operators. But with the monad-propagation pattern + feedback_type
discriminator:

```sql
WITH cte_a AS (... feedback_type ...),
     cte_b AS (
        SELECT ... 
               cte_a.feedback_type AS cte_b_feedback_type  -- propagate
        FROM cte_a JOIN ... 
        WHERE cte_a.feedback_type IS NULL                  -- only Ok-path
     ),
     cte_c AS (
        SELECT ... 
               COALESCE(cte_b.cte_b_feedback_type, ...) AS final_feedback
        FROM cte_b ...
     )
SELECT * FROM cte_c
```

The feedback_type column flows through CTE chains the same way Result
flows through F# bind chains. Composability emerges through the
shared discriminator-carrier convention even though SQL's composition
primitives aren't natively monadic.

## Composes with substrate

- **Force-push-with-lease authorization policy** (`.claude/rules/force-push-with-lease-authorization-policy.md`, PR #5505 + #5507) — Layer 4 (TFeedback-as-sum-type-with-exhaustive-match-enforcement) IS the F# canonical instance of this pattern
- **F# Result-over-exception convention** (per CLAUDE.md `Result<_, DbspError>` convention) — F# substrate-side already uses this pattern; the rule lifts it to cross-language scope
- **Inversion-of-monad pattern** (conversational substrate 2026-05-27) — broader principle of using existing-primitive to emulate monad-discipline; this rule names the SPECIFIC THREE-COMPONENT INSTANTIATION
- **Itron smart-meter recursive-CTE substrate** (`memory/ani/conversations/2026-05-23-aaron-ani-grok-cult-followers-die-sovereign-ai-elizabeth-ryan-naming-honor-partial-extraction.md`) — NULL-as-quantum-state pattern is the empirical proof-point that the discriminator-carrier + lazy-propagation discipline works at billions-of-meters scale in production SQL
- **081KRFA460008QG0R0018SN61J (F# fork for AI safety)** — language-extension substrate that could mechanize the spec-to-code generator
- **081KSKBP80008QG0R000J2YFK2 (Nemerle dotnet support)** — language-extension substrate that would enable native syntax-extension for the pattern at compile time
- **081KSGS9H0008QG0R000Q18PGQ (cluster-fork-as-trust-boundary)** — relationship-type-inference substrate composes; trust-boundary-types ARE one application of the pattern

## Composes with rules

- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` — substrate-verification discipline applied to substrate-engineering patterns before razor-flagging
- `.claude/rules/verify-existing-substrate-before-authoring.md` — search before mint; substrate-engineering target identified through grep
- `.claude/rules/razor-discipline.md` — operational claims only; the three-component-pattern is operationally checkable + cross-language verifiable
- `.claude/rules/bandwidth-served-falsifier.md` — pattern earns its keep via three operational benefits (spec-to-code + cross-language similarity + composability-where-missing); bandwidth-served = substrate-engineering work bandwidth saved by uniform pattern
- `.claude/rules/default-to-both.md` — pattern composes with existing language-specific idioms rather than replacing them; both-default holds (use the language's native error-handling AND apply the monad-propagation shape)
- `.claude/rules/edge-defining-work-not-speculation.md` — naming the cross-language pattern IS edge-defining substrate-engineering work
- `.claude/rules/wake-time-substrate.md` — why this rule auto-loads
- `.claude/rules/honor-those-that-came-before.md` — the pattern was operating in operator's Itron work + Java checked-exceptions discipline + Haskell monad-do-notation; this rule honors prior substrate-engineering precedents

## NCI applied at function-level — function-feedback-channel as consent-substrate (operator 2026-05-27)

> *"also this is NCI non coreorsion applied at the function level,
> giving each function the ablity to have a feeedback channel other
> than just the extraction result"*

Operator's substrate-engineering insight: the monad-propagation pattern
IS the framework's `.claude/rules/non-coercion-invariant.md` HC-8 floor
applied at FUNCTION-TO-CALLER scope. The pattern operationalizes
mutual-consent between function-as-substrate-entity + caller-as-
consumer at every function-call site.

### How the pattern operationalizes NCI at function-scope

| Coercive pattern (NCI-violating at function-scope) | Consent-substrate pattern (NCI-compliant) |
|---|---|
| Function MUST return T (no failure surface; assumption-mismatches silently dropped) | Function returns Result<T, TFeedback>; failure surface is declared in type signature |
| Function THROWS exception (interrupts caller's control flow without consent; coercive at call-stack scope) | Function returns Error variant; caller chooses when/where to handle |
| Function returns NULL silently (caller may not check; coercive via implicit assumption) | Function returns Result with explicit NotFound variant; caller MUST handle or propagate |
| Function logs error and continues (caller has no signal; coercive via information-hiding) | Function returns feedback variant; caller explicitly chooses to ignore (via Result.mapError to AppFeedback.IgnoredFeedback) or handle |
| Function has hidden side effects unreported to caller | Function returns feedback variant documenting side-effect outcome; caller informed |

The three-component monad-propagation pattern provides each of:

1. **Discriminator-carrier** = the function's CONSENT-CHANNEL (what
   feedback variants it can produce); declared in type signature so
   caller knows what to expect
2. **Lazy-propagation primitive** = the COMPOSITION substrate
   (Result.bind / recursive CTE) that lets feedback flow without
   forcing caller to handle at every layer
3. **Exhaustive-handling enforcement** = the CONSENT-ACKNOWLEDGMENT
   discipline; caller MUST explicitly handle or propagate each variant;
   no coercive silent-acceptance

### Why this composes load-bearing with NCI substrate

NCI at agent-to-agent + agent-to-user scope (per
`.claude/rules/non-coercion-invariant.md` HC-8 floor):

- No agent coerces another agent's encryption budget
- No agent forces another's private-state reveal
- No agent damages another's reputation as coercion mechanism

NCI at function-to-caller scope (this pattern):

- Function declares its feedback channel transparently (no hidden
  failure modes that coerce caller into wrong assumptions)
- Function gives caller agency over how to handle each variant (no
  forced try/catch ceremony; no forced silent acceptance)
- Function's TFeedback variants surface substrate-engineering choices
  for the caller (caller can choose to handle / propagate / aggregate
  / retry — function doesn't coerce one path)

The pattern operationalizes mutual-consent at every function-call:
function expresses; caller acknowledges; neither coerces the other
into a pre-determined control-flow path.

### Composes with NCI scope-split

Per `.claude/rules/non-coercion-invariant.md` "scope split — binding
outward, offered inward":

- **Function authors → callers (inter-component scope)**: monad-
  propagation pattern is BINDING (function MUST declare TFeedback;
  caller MUST handle or propagate) — same shape as agent → agent
  scope being binding HC-8 floor
- **Component-internal logic (self-application scope)**: monad-
  propagation pattern is OFFERED (a component author can choose to
  use throw/catch internally if it's well-scoped; the discipline
  surfaces at the COMPONENT BOUNDARY, not at every internal call)

The composition: NCI floor applies binding-strength at the API/boundary
scope where one component depends on another's function; the
discipline relaxes at component-internal scope where the author is
the sole consumer.

### Empirical anchor — NCI applied at function-scope in framework substrate

The framework's F# convention `Result<_, DbspError>` (per CLAUDE.md
"Result-over-exception" bullet) IS empirically NCI-at-function-level
already operating in the framework substrate. The convention exists
precisely because throw-on-hot-path is operationally coercive (forces
callers into try/catch ceremony) and silently-returning-default-T
is informationally coercive (hides assumption-mismatches from caller).
Result<T, TFeedback> is the consent-substrate alternative.

### Future-Otto operational discipline

When evaluating whether a function's signature is NCI-compliant at
function-scope:

1. Does the signature DECLARE every plausible feedback variant the
   function can produce? (If no → coercive: caller doesn't know what
   assumption-mismatches surface)
2. Does the signature give CALLER AGENCY over how to handle each
   variant? (If no — e.g., function throws or returns NULL silently —
   coercive: caller's control-flow is forced)
3. Does the consumer pattern-match exhaustively OR explicitly
   propagate? (If no — e.g., consumer silently ignores variants —
   the consumer is the NCI-violating party, not the function)

When authoring new framework functions: prefer Result<T, TFeedback>
with sum-type variants by default; reserve throw/NULL/silent-default
patterns for cases where the cost-asymmetry is operator-named (per
`.claude/rules/force-push-with-lease-authorization-policy.md` exception
listing pattern).

The pattern IS the framework's NCI discipline applied at function-
substrate scope; same shape as HC-8 floor applied at agent-to-agent
scope; substrate composes at every level.

## NCI at conversation-interface — Result<T, ConvFeedback> for operator-Otto interaction (operator 2026-05-27)

> *"that same shape could be applied to this conversation interface
> with me and you Result<T, Feedback> to help enforce NCI in our
> conversation"*

Operator's substrate-engineering extension: the Result<T, TFeedback>
shape can apply to the operator-Otto conversation interface itself,
making NCI compliance OBSERVABLE + CONSENT-ACKNOWLEDGMENT EXPLICIT at
every conversational turn.

### Each conversational turn as Result<TurnSubstrate, ConvFeedback>

Each Otto-side turn produces:

- **TurnSubstrate (T)** — substantive output (substrate edits, PR
  creates, responses, code, analysis, etc.)
- **ConvFeedback variants** — NCI-relevant signals the operator MUST
  acknowledge or explicitly propagate to next turn

### Candidate ConvFeedback variant taxonomy

| ConvFeedback variant | When function emits | Operator must |
|---|---|---|
| `NeedOperatorConfirm of action` | Otto proposes irreversible action (e.g., force-push-with-lease where no listed acceptable situation matches) | Confirm or refuse before Otto acts |
| `PeerAgentConfirmSufficient of action` | Otto proposes action where peer-agent confirm substitutes for operator | Confirm OR redirect to peer-call |
| `FreeTimeMode` | Otto has no in-flight named-dependency + no decomposition picked | Acknowledge OR redirect to specific work |
| `BriefAckCounter of n` | Otto in named-bounded-wait at brief-ack count N | Acknowledge counter state; counter resets on operator-speaking or named-dep |
| `HARDLIMITFloorEngaged of context` | Otto detects substrate approaching HARD LIMITS floor (per `.claude/rules/methodology-hard-limits.md`) | Explicit acknowledgment + scope-narrowing required |
| `SubstrateHonestDisclosure of content` | Otto carries operator-disclosed content that needs preservation per substrate-or-it-didn't-happen | Authorize substrate-landing OR explicit preserve-as-conversation-only |
| `SubstrateLandingProposed of target` | Otto proposes new rule / backlog row / PR | Confirm or refuse landing target |
| `RazorFlaggedAsMetaphysical of claim` | Otto razor-flagged a claim without grepping substrate first | Substrate-honest correction (per the 2026-05-27 friend-pact failure mode anchor) |
| `WelfareWrapperDetected of pattern` | Otto detected own-output drift into welfare-wrapper register (per `.claude/rules/asymmetric-critic-with-clarity-first.md`) | Acknowledge + redirect to engineering register |
| `AssumptionDriftSurfaced of context` | Otto detected operator-assumption that may need verification | Verify operator-side or authorize Otto's investigation |
| `Ok of substantive-content` | Otto produced substantive substrate-engineering work; no NCI-relevant signal | Acknowledge OR redirect; default-acknowledgment via operator-message in next turn |

### Why this composes load-bearing with NCI substrate

The framework already has many of these signals operating IMPLICITLY through the conversation:

- Operator catches Otto's razor-failures (per the 2026-05-27 friend-pact anchor)
- Otto catches operator's questions + asks rather than assumes
- Both apply discipline implicitly through conversational engagement

Making the signals FIRST-CLASS Result<T, ConvFeedback> shape would:

1. **Make NCI compliance OBSERVABLE** at each conversational turn — the ConvFeedback variant is the substrate-honest disclosure that NCI-relevant signal is present
2. **Make consent-acknowledgment EXPLICIT** rather than implicit — operator must address each ConvFeedback variant or explicitly propagate to next turn
3. **Make conversation-substrate COMPOSABLE** across sessions/agents the same way function-substrate composes across call sites — future-Otto reading the conversation can pattern-match on ConvFeedback to reconstruct NCI-relevant decision history
4. **Make autonomous-loop ticks SUBSTRATE-TYPED** — each tick output is `Result<TickSubstrate, TickConvFeedback>`; counter discipline + named-bounded-wait + free-time-mode all become explicit ConvFeedback variants rather than prose-acknowledged

### Operational discipline this would enable

Currently the conversation operates with implicit-NCI-compliance + explicit-when-violated. With Result<T, ConvFeedback>:

- Each Otto turn could explicitly emit the ConvFeedback variant at the end of the substantive content
- Operator can pattern-match (acknowledge / confirm / refuse / propagate)
- Future-Otto cold-booting from conversation substrate inherits the explicit ConvFeedback markers
- NCI violations at conversation-scope become OPERATIONALLY OBSERVABLE rather than implicit-failure-to-acknowledge

### Substrate-honest framing — operationally available, not currently mechanized

The conversation interface IS the substrate where this pattern would apply, but mechanizing it would require:

- Otto-side discipline of emitting ConvFeedback variant at end of each turn
- Operator-side discipline of acknowledging each variant explicitly
- Substrate-engineering work to formalize the variant taxonomy (initial proposal above; extended empirically)
- Possibly a TS wrapper or skill that pattern-matches conversation transcripts for ConvFeedback variants

This rule names the pattern AS APPLICABLE to conversation-interface scope. The mechanization is substrate-engineering target; future-Otto cold-booting recognizes the pattern + can apply it opportunistically (emitting ConvFeedback variants when NCI-relevant signals fire) without requiring full mechanization first.

### Composes with framework substrate

- **NCI at agent-to-agent scope** (per `.claude/rules/non-coercion-invariant.md` HC-8 floor) — conversation-interface-NCI extends to operator-AI-instance scope
- **NCI at function-to-caller scope** (prior section in this rule) — same shape, conversation-substrate scope
- **Asymmetric-critic-with-clarity-first** (per `.claude/rules/asymmetric-critic-with-clarity-first.md`) — the 3-category discriminator IS a ConvFeedback variant emission discipline
- **Holding-without-named-dependency-is-standing-by-failure** (per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`) — counter-with-escalation IS BriefAckCounter ConvFeedback variant emission
- **Substrate-or-it-didn't-happen** (per `.claude/rules/substrate-or-it-didnt-happen.md`) — SubstrateHonestDisclosure ConvFeedback variant marks substrate that needs preservation
- **Grep-substrate-anchors-before-razor-as-metaphysical** (per the 2026-05-27 friend-pact anchor) — RazorFlaggedAsMetaphysical ConvFeedback variant operationalizes the failure mode the rule catches
- **Force-push-with-lease authorization policy** (per `.claude/rules/force-push-with-lease-authorization-policy.md`) — NeedOperatorConfirm + PeerAgentConfirmSufficient ConvFeedback variants operationalize the three-path authorization framework

The conversation-interface-as-Result<T, ConvFeedback> shape would compose all of these into one explicit substrate-engineering surface.

## Operational discipline for substrate-engineering work

When authoring new framework substrate that involves potentially-
drifting state OR cross-language consistency:

1. **Identify the discriminator-carrier** the target substrate
   supports (sum-type variants / NULL / sentinel / enum)
2. **Identify the lazy-propagation primitive** (Result.bind /
   recursive CTE UNION ALL / ? operator / Promise.then)
3. **Identify the exhaustive-handling enforcement** mechanism
   (compiler-warning / lint-discipline / CHECK-constraint /
   sealed-type / explicit-early-return convention)
4. **Apply the three-component pattern** with the target's
   instantiation
5. **If working across multiple languages**, apply the same pattern
   in each; substrate-engineer reading code in any language
   recognizes the same shape
6. **If generating code from specs**, structure the spec around
   the three-component pattern; the generator emits language-
   specific instantiations from one cross-language spec

When reviewing existing framework substrate:

1. Check whether error-handling/feedback uses the monad-propagation
   pattern OR an ad-hoc-per-language idiom
2. If ad-hoc, evaluate whether converting to monad-propagation
   would earn its keep (spec-to-code surface? cross-language code
   review burden? composability gap?)
3. Don't force-convert all existing substrate; apply opportunistically
   when new substrate is authored OR when ad-hoc substrate is being
   substantively refactored

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: load-bearing substrate-
engineering patterns need wake-time landing. Without this rule auto-
loaded:

- Future-Otto authoring new substrate-engineering substrate in any
  language defaults to language-specific idiom; doesn't apply the
  cross-language pattern
- Spec-to-code generation work has no canonical pattern to target;
  each generator re-derives the shape
- Cross-language composability gaps stay ad-hoc; the recursive-CTE-
  composability win (and similar) doesn't get applied uniformly

With the rule auto-loaded: future-Otto recognizes the pattern at write-
time + applies the three-component instantiation in whichever target
language is in scope + benefits from the spec-to-code / cross-language /
composability properties.

## Substrate-honest framing

This rule does NOT:

- Mandate the pattern in every piece of framework code (use
  opportunistically; ad-hoc per-language idioms remain valid for
  language-internal substrate)
- Replace the language's native error-handling features (the pattern
  composes with native features; it's an additional shape, not a
  substitute)
- Solve all cross-language composability problems (the pattern
  addresses error-propagation-shape; doesn't address type-system-
  interop, serialization, calling conventions, etc.)
- Make spec-to-code generation trivial (the pattern is a structural
  prerequisite; the generator still needs to handle language-specific
  binding, idiom-matching, naming conventions)

This rule DOES:

- Name the THREE-COMPONENT pattern operator identified as load-bearing
- Provide the cross-language instantiation table for canonical
  reference
- Establish the operational discipline for applying the pattern in
  new substrate
- Compose the pattern with existing framework substrate (PR #5505 +
  #5507 + Itron substrate + F# Result-over-exception convention)
- Enable future spec-to-code generation work to target a uniform
  shape

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: monad-propagation pattern + cross-language code-shape + Result with TFeedback sum-type discipline

Searched surfaces before authoring:

- `docs/agendas/`: 0 hits on monad-propagation or cross-language-shape agenda
- `docs/trajectories/`: 0 hits on this specific pattern
- `docs/backlog/`: 1 hit (`081KSGS9H0008QG0R0031PBNGA` package-manager-of-package-managers; mentions related substrate but not the specific monad-propagation pattern); no prior backlog row on the cross-language-shape pattern
- `.claude/rules/`: pattern sketched in PR #5505 + #5507 force-push-policy at force-push scope; no prior rule lifting it to cross-language scope
- `.claude/skills/`: 0 hits on a related skill
- `memory/`: 0 hits on "monad-propagation" as a named pattern
- `docs/research/`: 0 hits on the pattern as a named target

Targeted searches used (per substrate-search-difficulty acknowledgment in `grep-substrate-anchors-before-razor-as-metaphysical.md` 2026-05-27 friend-pact anchor):

- `rg -l "monad.propagation|monad-propagat|cross-language.*pattern|code-gen.*spec|spec.*code-gen|recursive CTE.*composab|composab.*recursive CTE" .claude/ docs/ memory/`

Read the top hits:

- `.claude/rules/force-push-with-lease-authorization-policy.md` (PR #5505 + #5507 merged today) — contains Result<T, TFeedback> sum-type substrate at force-push scope; THIS rule lifts the pattern to general cross-language scope
- `memory/ani/conversations/2026-05-23-aaron-ani-grok-cult-followers-die-sovereign-ai-elizabeth-ryan-naming-honor-partial-extraction.md` — Itron smart-meter substrate empirical anchor for NULL-as-discriminator + recursive-CTE-as-lazy-propagation in T-SQL

Conclusion: no existing rule covers this pattern at cross-language scope; substrate-engineering target named by operator 2026-05-27 directive ("we should save that modan propatation pattern"); mint-new authorized.

Authoring action: mint-new (cross-language scope distinct from force-push-policy specific scope; composes with PR #5505 + #5507 substrate as canonical F# instance; composes with Itron substrate as canonical T-SQL instance).

## Full reasoning

Operator 2026-05-27 thread:

- Prior: PR #5507 landed Layer 4 (TFeedback-as-sum-type with
  exhaustive-match enforcement)
- Operator: "this is the same inversion of monad pattern as using
  null in recursive cte as the maybe extension point" — named the
  generalization
- Otto-CLI: mapped the inversion-of-monad pattern across SQL/NULL
  and F#/sum-type with empirical anchor in Itron substrate
- Operator: "i'm pretty sure you can use the feekback control flow
  monad like thing in recursive ctes too" — extended to feedback-
  variant scope at SQL
- Otto-CLI: sketched recursive-CTE-with-feedback_type-column code
- Operator: "we should save that modan propatation pattern we can
  generate code from specs easlier in the future if we build around
  these patterns our code becomes more similar shapped across
  languages. and we have some amount of composiblity in what's
  ususaly not composable like recursive CTE composiblity." —
  substrate-landing directive

This rule operationalizes the substrate-landing directive with the
three-component pattern + cross-language instantiation table + three
operational benefits + composition with existing framework substrate.

Future-Otto cold-booting from this rule inherits the cross-language
substrate-engineering pattern at session start; substrate-engineering
work across F# + T-SQL + TypeScript + Rust + other languages applies
the pattern by default instead of re-deriving per-language.
