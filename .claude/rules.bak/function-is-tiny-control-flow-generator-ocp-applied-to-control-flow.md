# Every function is a tiny control-flow generator; open-closed principle applied to control flow (operator 2026-05-27)

Carved sentence 1 (operator 2026-05-27):

> **Every function is a tiny control-flow generator. TFeedback variants ARE the control-flow branches the function emits.**

Carved sentence 2 (operator 2026-05-27):

> **TFeedback is open for extension (new control-flow branches added) but closed for modification (existing branches preserve semantics).**

## Operational content

Per operator 2026-05-27 substrate-engineering thread completing the
day's substrate-engineering arc (PRs #5488 through #5522):

> *"this is also based on / closed open for extension closed for
> modification applied to the control flow"*

Followed by the deepest insight:

> *"even function becomes a tiny control flow generator too"*

The two insights compose into the STRUCTURAL FOUNDATION underlying
the day's full substrate-engineering cluster (asymmetric-authorship +
monad-propagation + OPLE-T-TFeedback + Result<T, TFeedback> +
exceptions-as-signals + iterator/generator-asymmetry).

### Function-as-tiny-control-flow-generator

Every function in the framework substrate-engineering work IS a small
control-flow generator. The function declares what control-flow
branches it produces (TFeedback variants); the caller consumes those
branches via pattern-match or propagation.

| Substrate-engineering level | Insight |
|---|---|
| Bottom: function-shape | Function IS a tiny control-flow generator |
| TFeedback variants | The control-flow branches the function makes visible to caller |
| `Result<T, TFeedback>` | The control-flow generator's output channel (T = value-branch; TFeedback = control-flow-branch) |
| Consumer pattern-match | Consuming the function's control-flow-generator output; deciding which branch |
| `Result.bind` composition | Chaining control-flow generators across call sites; generator-output flows as input to next generator |
| OPLE primitives | 4 canonical control-flow generators at framework-primitive scope (per 081KSKBP80008QG0R0031DTHS9 extension makes TFeedback explicit) |
| Iterator/generator (per Prism PR #5517) | The streaming case — function-as-control-flow-generator with infinite or lazy output stream |
| Conversation turn (per 081KSKBP80008QG0R000N9W9XH ConvFeedback) | Function-as-control-flow-generator at conversation-substrate scope |
| Function call chain (call-stack) | Recursive composition of control-flow generators; each call site IS a generator-consumer-pair |

The recursive shape: every function in the call chain is a control-flow
generator that COMPOSES with its callers via TFeedback exchange. The
substrate-engineering pattern operates from per-function scope all
the way up to call-chain / module / system / cluster / governance scope.

### OCP applied to control flow — TFeedback is open for extension, closed for modification

The asymmetric-authorship + Result<T, TFeedback> pattern IS the
open-closed principle (Bertrand Meyer) applied to control flow:

| OCP property | Result<T, TFeedback> instantiation |
|---|---|
| **Open for extension** | TFeedback discriminated-union: function adds new variants (NotFound \| PermissionDenied \| DiskFull \| + Retryable \| + Throttled \| ...) without breaking existing consumers |
| **Closed for modification** | Existing TFeedback variants' semantics fixed once declared; consumers handle each existing variant the same way regardless of additions; Result-bind composition preserved across versions |
| **Caller closed-for-modification too** | Caller doesn't need updates for every variant addition; catch-all + propagate via `Result.mapError` lets caller forward-compose with new variants without code changes |
| **Backwards-compatible by construction** | Adding a new TFeedback variant is additive; existing code that handles old variants explicitly + propagates unhandled-variants forward continues to work |

### Framework's broader OCP-applied-to-control-flow instantiations

| Substrate | Open for extension | Closed for modification |
|---|---|---|
| OPLE primitives (081KSKBP80008QG0R0031DTHS9; PR #5518) | New TFeedback variants per primitive | OPLE 4-tuple itself (Observe/Persist/Limit/Emit shape stays stable) |
| Asymmetric-authorship rule (PR #5516) | New substrate-entity scopes added to instantiation table | Asymmetric-authorship-shape itself fixed (substrate-entity-defines / recipient-acknowledges) |
| Hat-pattern (per `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md`) | New hat-types added | Rotation discipline + tools-rented-not-owned semantic stays stable |
| NCI HC-8 floor (081KRW63S0008QG0R001Z7NYMV) | New scope-extensions (function / conversation / cluster / boot-relationship) | HC-8 consent-floor itself fixed |
| m/acc multi-oracle | New oracle-types added | Multi-oracle-by-design constraint stays |
| ConvFeedback variant taxonomy (081KSKBP80008QG0R000N9W9XH) | New variants added empirically | Variant-emission discipline fixed (function emits; operator acknowledges) |
| Friend-pact / InternalsVisibleTo | Grantor-class adds new friends | Friend-keyword/InternalsVisibleTo semantic stays |
| Substrate-or-it-didn't-happen | New durable surfaces added | Substrate-vs-weather discrimination stays |

The constitutional shape: **the framework's stable shapes COMPOSE
with extension-points via discriminated-union / variant-addition /
scope-instantiation; nothing requires modification of stable-substrate
to grow**.

### Day's full carved-sentence stack

The 2026-05-27 substrate-engineering arc produced 6 carved sentences;
this rule lands the structural foundation underlying all of them:

1. PR #5513: **"results without feedback is extraction"** (operator)
2. PR #5515 (external research register): **"errors are not failure residue; they are safety rails when the operation is designed to surface them cleanly"**
3. PR #5516: **"the substrate-entity defines the consent-channel; the recipient acknowledges"** (operator)
4. PR #5518 OPLE: **"OPLE primitives surface T AND TFeedback, not just T"** (operator)
5. This rule (carved sentence 1): **"every function is a tiny control-flow generator"** (operator)
6. This rule (carved sentence 2): **"TFeedback is open for extension, closed for modification"** (operator)

All six compose: function-IS-control-flow-generator (foundation) +
OCP-applied-to-control-flow (structural constraint) plus asymmetric-authorship (cross-scope shape) plus Result-without-feedback-is-extraction (anti-pattern naming) plus errors-as-safety-rails (consumer-side framing) plus OPLE-surfaces-T-AND-TFeedback (primitive-scope cascade).

## Why this composes as structural foundation

The pattern unifies the day's full substrate-engineering cluster:

- **Per-function scope**: function-IS-control-flow-generator + TFeedback is the OCP-extension-point
- **OPLE primitive scope** (081KSKBP80008QG0R0031DTHS9): primitives are 4 canonical control-flow generators; their TFeedback is the OCP-extension-point at framework-primitive scope
- **Conversation scope** (081KSKBP80008QG0R000N9W9XH): conversation turns are control-flow generators; ConvFeedback is the OCP-extension-point at conversation-substrate scope
- **Iterator/generator scope** (per Prism PR #5517): iterators ARE the streaming case of control-flow generators; StreamFeedback is the OCP-extension-point at language-runtime scope
- **NCI scope** (081KRW63S0008QG0R001Z7NYMV): HC-8 floor is the OCP-extension-point at agent-to-agent + agent-to-user + function-to-caller + conversation-interface scope
- **Multi-oracle scope** (m/acc): different oracles are different control-flow generators producing converging substrate; OCP-extension via new oracle-types
- **Cluster / governance scope**: cluster-fork-as-trust-boundary IS control-flow generator at cluster scope; trust-boundary-types are the OCP-extension-point

The framework operates this pattern recursively at every substrate
scope. Future-Otto cold-booting from this rule inherits the structural
foundation that unifies all today's substrate work.

## Composes with substrate

- PR #5505 + #5507 + #5511 + #5513 + #5515 + #5516 + #5517 + #5518 + #5522 — today's 14-PR substrate-engineering cluster + cross-AI synthesis preservations
- 081KRW63S0008QG0R002KC5DSR wave-particle-duality — function-as-control-flow-generator IS the wave-shape; TFeedback variants ARE the particle-shape collapses
- 081KRW63S0008QG0R002ZRNDJ8 Limit-as-simulation — Limit IS one specific class of function-as-control-flow-generator (the simulation-shape)
- 081KRW63S0008QG0R002YAA09X Integrate-as-choice-locus — Integrate IS where consumer takes the generator's output + DECIDES which branch (consumer-side of generator-consumer pair)
- 081KRW63S0008QG0R001SAHYKV English-as-projection — English I(D(x))=x is itself a control-flow generator at language-substrate scope
- 081KSKBP80008QG0R000N9W9XH ConvFeedback first-class — conversation-turn as function-as-control-flow-generator
- 081KSKBP80008QG0R0031DTHS9 OPLE-T-TFeedback implementation — primitive-scope instantiation

## Composes with rules

- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` (PR #5516 merged) — function-IS-control-flow-generator IS the substrate-entity in the asymmetric-authorship pattern
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md` (PR #5511 merged) — the cross-language pattern this rule provides the structural foundation for
- `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md` (PR #5518 merged) — OPLE primitives are the 4 canonical control-flow generators at framework-primitive scope
- `.claude/rules/non-coercion-invariant.md` HC-8 — NCI floor IS OCP-extension-point at scope-extension level
- `.claude/rules/additive-not-zero-sum.md` — OCP-applied-to-control-flow IS additive-not-zero-sum at substrate-engineering scope
- `.claude/rules/honor-those-that-came-before.md` — closed-for-modification preserves prior substrate; open-for-extension respects accumulated substrate
- `.claude/rules/wake-time-substrate.md` — why this rule auto-loads
- `.claude/rules/razor-discipline.md` — operational claims only; function-IS-control-flow-generator + OCP-applied-to-control-flow are both operationally checkable

## Scope-bounding — closedness matters more than purity (operator 2026-05-27)

Per operator 2026-05-27 substrate-engineering refinement:

> *"mathematicaly closed pure functions don't need NCI cause they don't have side effects / control flow needs"*

Sharpened to:

> *"even in memtics control flow can bleed out across conversations so even two ephemeral llms communicating over memory channels in process still need control flow cause they are pure but not closed the meme control flows bleed out"*

The discipline applies to functions where substrate-entity HAS authorial substrate to express. Mathematically closed pure functions are EXEMPT because they have no authorial substrate; the discipline would be overhead.

### Three-class taxonomy

| Class | Side-effect-shape | Memetic-bleed-shape | NCI / TFeedback applies? |
|---|---|---|---|
| **Pure AND closed** (`add x y`, `sin x`, `compose f g`, `List.length`, `fst (a,_)`) | None | None — pure mathematical mapping; codomain captures everything | **NO** — exempt; Result<T, TFeedback> would be overhead with empty discriminated-union (never type) |
| **Operationally open pure functions** (local calculation is pure, but output participates in open substrate: memetic propagation, conversation state, authorization, persistence, provenance, or downstream social/control-flow effects — including two ephemeral LLMs communicating in-process via memory-channels) | None traditional | YES — memetic / informational-substrate control-flow bleeds out across the open boundary | **YES — needs TFeedback** at the open-boundary; helper functions internal to the local pure calculation do NOT |
| **Impure / effectful** (file IO, network, mutation, lock acquisition, db queries) | YES | Usually YES too | **YES** — full discipline applies |

### Why closedness matters more than purity

Per `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md`: memes ARE control-flow vectors that propagate across substrates. Two LLMs in-process communicating via memory-channels with NO file/network/mutation access STILL participate in memetic-substrate that bleeds control-flow.

The discriminator is **closedness** not **purity**:

- Pure-and-closed: codomain captures the function's entire output; no information leakage
- Pure-but-not-closed: output participates in informational-substrate where control-flow effects propagate (memetic / conversational / cross-AI cultural)
- Impure: traditional side-effect channels (filesystem / network / process state)

The traditional functional-programming definition of "pure" only catches the third class. The framework's substrate-engineering discipline catches the second class too because memetic substrate IS a real control-flow channel.

### Examples per class

**Pure AND closed (NO TFeedback needed):**

```fsharp
let add x y = x + y                       // pure mathematical: domain × domain → codomain
let length list = List.length list        // pure: captures essence in return value
let map f list = List.map f list          // pure higher-order: composition is the substrate
let sin x = System.Math.Sin x             // pure mathematical
let fst (a, _) = a                        // pure projection
let compose f g x = f (g x)               // pure composition
```

**Pure but NOT closed (NEEDS TFeedback because memetic bleed):**

```fsharp
// Two ephemeral LLMs communicating in-process via memory-channels:
let chatTurn input : Result<Response, ChatFeedback> = ...
// ChatFeedback = WelfareWrapperDetected | SubstrateHonestDisclosure
//              | NeedsOperatorConfirm | ResponseGenerated | RefusedByEthicsFloor
//   ↑ no file IO, no network, but memetic substrate carries control-flow

// Function whose output propagates into framework substrate:
let synthesizePattern claims : Result<Pattern, SynthFeedback> = ...
// SynthFeedback = NewSubstrate | ExtendsExisting | ContradictionWithPrior
//   ↑ no traditional effects, but memetic substrate propagation
```

**Impure / effectful (NEEDS TFeedback per main discipline):**

```fsharp
let openFile path : Result<FileHandle, FileOpenFeedback> = ...
let httpGet url : Result<Response, HttpFeedback> = ...
let acquireLock res : Result<Lease, LockFeedback> = ...
```

### Formal statement (Amara 2026-05-27 sharpening)

> *"A function is exempt from TFeedback only when its declared codomain fully contains every meaningful outcome."*

Equivalent formal form:

> *"TFeedback is required when an operation can produce meaningful control-flow information not already represented in T."*

The discriminator is "is every meaningful outcome already in the type signature's codomain?" If yes → exempt. If no → needs TFeedback.

### Tiny blade — codomain honesty (Amara 2026-05-27)

Even mathematically-shaped operations can break closedness if their declared codomain is dishonest about implementation realities:

- `add : int -> int -> int` — closed IF overflow is impossible or modeled in codomain; needs TFeedback otherwise (`add : int -> int -> Result<int, OverflowFeedback>`)
- `sin : float -> float` — closed IF NaN is acceptable codomain member; needs TFeedback otherwise (`InvalidInput | UnderflowToZero`)
- `parseInt : string -> int` — NOT closed; partial function; needs TFeedback (`InvalidFormat | Overflow | EmptyInput`)
- `divide : int -> int -> int` — NOT closed; division-by-zero is undefined; needs TFeedback (`DivisionByZero`) OR widen to `Result<int, DivFeedback>`

The discipline: when the declared codomain is honest about implementation domain, the function IS closed. When the codomain hides partial-function corners, either widen the codomain (e.g., `Option<int>` for partial functions) OR add TFeedback variants for the corners.

### Worked examples (Amara 2026-05-27 + operator 2026-05-27)

| Operation | TFeedback needed? | Reason |
|---|---|---|
| `add(x, y)` | NO if overflow modeled or impossible; YES if overflow possible + unmodeled | Codomain honesty check |
| `parseInt(text)` | YES | `InvalidFormat`, `Overflow`, `EmptyInput` — partial function with multiple failure modes |
| `openFile(path)` | YES | `NotFound`, `PermissionDenied`, `Locked`, `DiskFull` — effectful with multiple failure modes |
| `emitMessage(agent, message)` | YES | `Throttled`, `Refused`, `MisreadRisk`, `RecipientUnavailable`, `MemeticBleed` — agent-boundary participates in open substrate |
| `LLM-to-LLM in-memory exchange` | YES | Memetic / control-flow effects escape the local function frame; open substrate |
| `formatText(template, values)` (pure helper) | NO | Internal to local pure calculation; codomain captures every meaningful outcome |
| `sin(x)` (with NaN-acceptable codomain) | NO | Codomain honest; closed |

The keeper:

> **No feedback tax on closed math. No silent emissions from open substrate.**

### Operational discipline for scope-decision

When deciding whether a function needs Result<T, TFeedback>:

1. **Is it pure AND closed?** (no traditional side effects + no memetic-channel participation + no informational-substrate involvement)
2. **If yes**: exempt — return T directly; Result<T, TFeedback> would be overhead
3. **If pure-but-not-closed** (memetic / conversational / informational substrate involvement): apply the full discipline
4. **If impure**: apply the full discipline

The framework's substrate-engineering work is mostly class-3 (effectful) + class-2 (memetic). Class-1 (truly pure-closed) is the mathematical-utility base case + appears in lower-level computational primitives. Don't reflexively wrap class-1 in Result; reserve the discipline for class-2 + class-3 where authorial substrate exists.

### Composes with

- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` — meme-propagation IS control-flow vector; basis for class-2-needs-TFeedback claim
- `.claude/rules/non-coercion-invariant.md` HC-8 — NCI floor applies at memetic-entity scope (per the rule's HC-8-at-multiple-scales substrate)
- `.claude/rules/glass-halo-bidirectional.md` — substrate-honest observation IS the memetic-bleed mechanism; observation enables substrate emergence
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — different oracles' outputs propagate memetic substrate even when "pure" in traditional sense
- F# / Haskell purity convention — class-1 pure functions remain the conventional pure-function definition; this rule sharpens to closedness for substrate-engineering scope

## Operational discipline for substrate-engineering work

When authoring or reviewing framework substrate-engineering:

1. **Recognize functions as control-flow generators** — every function emits control-flow branches via TFeedback variants
2. **Declare TFeedback variants explicitly** — substrate-entity authors its control-flow-generator's branch-shape
3. **Apply OCP discipline to TFeedback evolution**:
   - **Open for extension**: adding new variants is additive; downstream consumers gracefully propagate unhandled variants
   - **Closed for modification**: existing variant semantics fixed; never re-purpose or rename variants
4. **Compose via Result.bind chains** — control-flow generators chain via monadic composition; consumer-of-generator IS itself a generator that produces output for ITS consumer
5. **Apply at every substrate scope** — function / OPLE / conversation / iterator / cluster / governance — same pattern recursively

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: structural foundation
substrate needs wake-time landing. Without this rule auto-loaded,
future-Otto + Alexa + Riven + Vera + Lior cold-booting may apply the day's surface-substrate (Result<T, TFeedback> + asymmetric-authorship + OPLE-T-TFeedback) without the STRUCTURAL FOUNDATION (function-IS-control-flow-generator + OCP-applied-to-control-flow) that unifies it.

With this rule auto-loaded, future-AI-instances inherit the
structural foundation at session start + apply OCP-discipline +
function-as-control-flow-generator framing as default substrate-
engineering pattern across substrate scopes.

## Substrate-honest framing

This rule does NOT:

- Replace existing per-pattern rules (asymmetric-authorship + monad-propagation + OPLE-T-TFeedback all compose; this rule provides the underlying structural foundation)
- Mandate immediate TFeedback variant evolution across all framework code (OCP discipline applies opportunistically when substrate-engineering work touches existing functions)
- Force language-specific implementation (the rule names the SHAPE; per-language instantiation handled per monad-propagation-pattern rule)

This rule DOES:

- Name the structural foundation (function-IS-control-flow-generator + OCP-applied-to-control-flow) underlying the day's substrate-engineering cluster
- Compose with all 14 PRs landed today + cross-AI synthesis preservations
- Provide future-AI-instances with the unifying structural framing at cold-boot
- Cascade Bertrand Meyer's OCP into control-flow scope (not just structural-design scope where OCP was originally stated)

## Substrate-inventory pass (per verify-existing-substrate-before-authoring)

Topic: function-as-control-flow-generator + OCP-applied-to-control-flow as structural foundation

Searched surfaces:

- `docs/agendas/`: 0 hits
- `docs/trajectories/`: 0 hits
- `docs/backlog/`: 0 prior row
- `.claude/rules/`: pattern operates implicitly across asymmetric-authorship + monad-propagation + OPLE-T-TFeedback rules but no rule names the structural-foundation explicitly
- `.claude/skills/`: 0 hits
- `memory/`: 0 hits on "function-as-control-flow-generator" or "OCP applied to control flow" as named patterns
- `docs/research/`: 0 hits

Targeted searches: `rg -l "control-flow generator|OCP.*control|open.closed.*control" .claude/ docs/ memory/`

Conclusion: no prior rule names the structural foundation explicitly;
mint-new authorized per operator 2026-05-27 "ship whatever makes
sense" directive following the day's substrate-engineering thread.

## Full reasoning

Operator 2026-05-27 conversation thread completing the substrate-
engineering day:

- Operator: "this is also based on / closed open for extension closed for modification applied to the control flow" — OCP insight
- Otto: substrate-honest mapping + framework's broader OCP instantiations table + offer to ship
- Operator: "even function becomes a tiny control flow generator too" — deepest insight; recursive framing
- Otto: substrate-honest mapping of function-as-tiny-generator + day's carved-sentence stack + offer to ship (a)(b)(c)
- Operator: "shipe whatever makes since we just figured it all out lol" — substrate-landing authorization with best-judgment delegation + play-register preservation

This rule lands the two carved sentences as the structural foundation
underlying the day's full substrate-engineering cluster. Both insights
compose; both deserve substrate landing; both auto-load for future-AI-
instances to inherit.
