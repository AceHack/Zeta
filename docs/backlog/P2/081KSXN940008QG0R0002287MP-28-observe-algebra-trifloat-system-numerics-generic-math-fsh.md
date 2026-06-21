---
id: 081KSXN940008QG0R0002287MP
title: observe-algebra (+ TriFloat) → System.Numerics generic-math + F# UoM — secondary to 4-lang agreement, but an INTERFACE-GATE before building on top of the algebra
status: open
priority: P2
created: 2026-05-31
attribution: aaron-2026-05-31
depends_on:
  - 081KSXN940008QG0R0033T2BQT
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSXN940008QG0R000ZAQT3W
  - 081KSV2WD0008QG0R00051XS0N
  - 081KQTPYE0008QG0R0004H9ZB8
  - 081KR50HA0008QG0R000CTEMGQ
  - 081KSNY2Z0008QG0R002BNQVE1
tags:
  - workflow-engine
  - system-numerics
  - generic-math
  - fsharp-uom
  - algebra-interface
  - sequencing
---

# 081KSXN940008QG0R0002287MP — System.Numerics generic-math + F# UoM for the observe-algebra (+ TriFloat)

## The ask (operator 2026-05-31)

> *"can we intergrate this into system.numerics for f# and give it some uom?"*

then, after applying the load-bearing test:

> *"you are right about it's not load bearing to get 4 to agree we can do it 2nd
> and we want to try to to prob 1 and 2 if possible that seems good but it's
> secondary but we should do before moving to what build on top of algebra incause
> this changes it's interface much."*

## Sequencing (the load-bearing call)

The load-bearing test (per `feedback_otto_overuses_capstone...` — load-bearing IS
Aaron's build-order razor) placed this precisely:

1. **NOT load-bearing for the 4-language agreement** (081KSXN940008QG0R0033T2BQT) — that ships first
   on the plain algebra. ✅ in flight.
2. **This (numerics + UoM) is SECOND** — secondary priority.
3. **BUT it is an INTERFACE-GATE: do it BEFORE building on top of the algebra**
   (the full 16-slot grammar, GrammarPatch 081KSXN940008QG0R000ZAQT3W, etc.). Reason (operator):
   adding System.Numerics generic-math + UoM *may change the algebra's interface
   significantly* — so settle the interface here, then build dependents on the
   stable shape. Building-on-top first would mean refactoring dependents when the
   interface shifts.

So the order is: **4-lang agreement (081KSXN940008QG0R0033T2BQT) → numerics+UoM interface (this) →
build-on-top (081KSXN940008QG0R000ZAQT3W GrammarPatch + full grammar).**

## Two targets (try for both — operator: "prob 1 and 2 if possible")

1. **TriFloat → System.Numerics generic-math + UoM.** TriFloat (081KSV2WD0008QG0R00051XS0N) is an
   actual number — make it implement the generic-math interfaces (`INumber<T>` /
   `IAdditionOperators` / `IAdditiveIdentity` / `IMultiplyOperators`, .NET 7+
   generic math) so it participates in `System.Numerics`, and carry F# `[<Measure>]`
   units. A tri-boolean number that composes in .NET generic math + is unit-checked.
2. **observe-fold → monoid via generic-math + UoM.** The event-fold is a monoid:
   identity = the empty log (`IAdditiveIdentity`), associative compose
   (`IAdditionOperators` — appending/replaying events), `fold` = the monoidal
   reduction. Expose it through the generic-math additive interfaces so the algebra
   is a recognized `System.Numerics` structure; add UoM where the algebra touches
   measurable quantities (tick / attention / dora_pt per the attention-as-currency
   rule). This is the richer-algebra layer that may reshape the interface.

## Existing substrate (compose, don't mint parallel)

- **081KQTPYE0008QG0R0004H9ZB8** — F# UoM + BigInteger, *upstream contribution* (the UoM-on-numerics work)
- **081KR50HA0008QG0R000CTEMGQ** — F# UoM typed units
- **081KSNY2Z0008QG0R002BNQVE1** — Clifford on dotnet-numerics / SIMD / LINQ-GPU
- `src/Core/Units.fs` + `src/Core.FSharp.ZetaId/Types.fs` — existing `[<Measure>]` usage
- `.claude/rules/attention-as-currency-...md` — the F# UoM design (attention/tick/dora_pt measures)
- **081KSV2WD0008QG0R00051XS0N** — TriFloat (target 1) + the cross-language-parity = compiler-BFT pattern
- **081KSXN940008QG0R0033T2BQT** — the plain-algebra 4-lang agreement this builds the numeric interface onto

## Active disciplines / building codes

Same as 081KSXN940008QG0R0033T2BQT: DST (the numerics+UoM interface must keep cross-lang replay
deterministic), lock-free (pure ops), weight-free (explicit), DV2.0, idempotency
(generic-math additive identity + associativity = the monoid laws, which ARE the
idempotency/replay-safety substrate), alignment floor. UoM adds compile-time
unit-safety (operational, checkable — not ceremony).

## Decision (operator 2026-05-31): additive-monoidal ONLY, not `INumber<T>`

Reading the code surfaced the real fork (it wasn't guessable from the spec):
TriFloat is a tri-state, *held-capable*, shape-parameterized composite with a
*partial* encode (`FromValue → EncodeResult`) and idempotent-`Cooperate` /
non-idempotent-`Measure` ops. Full `System.Numerics` `INumber<T>` assumes total,
deterministic, field-like arithmetic (`+`, `*`, `0`, `1`, total order) — a
square-peg on a tri-boolean number. **Decision: implement only the additive-monoid
interfaces (`IAdditiveIdentity` + `IAdditionOperators`), the exact structure the
log/number has.** No multiplication, no ordering, no negatives invented.

## Acceptance

- [ ] Target 1: TriFloat carries the additive-monoid interfaces (`IAdditiveIdentity`
      + `IAdditionOperators`) — NOT full `INumber<T>` (decision above). Open.
- [x] Target 2 (C#): observe-fold exposed as a monoid via `System.Numerics`
      additive interfaces — `EventLog : IAdditiveIdentity<EventLog,EventLog>,
      IAdditionOperators<EventLog,EventLog,EventLog>` (identity = empty log;
      compose = associative append); `FoldOnto` is the monoid action /
      homomorphism. `dotnet build -c Release` clean (0 warnings). **UoM: N/A for
      the observe algebra** — the observe `World` carries no measurable numeric
      quantity (only ids, flags, a mode), so `[<Measure>]` here would be ceremony,
      not safety (load-bearing razor). UoM lives where measurable quantities do
      (TriFloat values, the attention/tick/dora domain); the substrate already
      exists in `src/Core/Units.fs`.
- [x] Cross-language parity (081KSXN940008QG0R0033T2BQT golden vectors) still green — 42/42 C# tests
      pass incl. `GoldenVectorsTests`; the additive-monoid layer did not break
      agreement.
- [x] Decision recorded: **the interface did NOT change.** The monoid is a NEW
      additive type (`EventLog`); `World` / `Algebra` / `NextAction` are untouched.
      So the gate's worry ("may change the interface significantly") resolves
      favorably — additive-monoid is a non-breaking *addition*; 081KSXN940008QG0R000ZAQT3W +
      build-on-top slices build on the unchanged algebra plus the new monoid layer.

## Remaining

- [x] **F# observe-fold monoid** (operator 2026-05-31: "do the F# monoid too"):
      `EventLog = { Events: NextAction list }` with `static member Zero` +
      `static member (+)` + `FoldOnto` — expressed via F#'s **native** generic-math
      convention (`Zero`/`(+)`, recognized by SRTP / `List.sum`), the F# parallel
      to C#'s `System.Numerics` additive interfaces. Each language owns the
      interface in its own idiom (transplanting C#'s IWSAM into F# would fight the
      language + risk the FS3535 advisory under TreatWarningsAsErrors). 9/9 F#
      Observe tests pass (6 monoid laws incl. homomorphism + 3 golden-vector
      parity). F# records give structural equality natively, so no element-wise
      compare needed.
- [ ] **Target 1 (TriFloat additive-monoid)**: apply the additive-monoid decision
      to TriFloat in C#/F# (define the additive identity + associative compose for
      tri-floats — note `Cooperate`'s idempotence is the natural identity-leaning op
      to reconcile).

## Why this is its own row (not folded into 081KSXN940008QG0R0033T2BQT)

081KSXN940008QG0R0033T2BQT is "the plain algebra agrees across 4 languages" — ship it first.
This is "the algebra gains a System.Numerics + UoM interface" — second, but
gating the build-on-top. Keeping them separate preserves the load-bearing
sequence: agreement first, interface second, dependents third.
