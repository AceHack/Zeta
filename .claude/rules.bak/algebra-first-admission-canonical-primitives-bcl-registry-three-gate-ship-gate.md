# Algebra-first admission to the canonical-primitives BCL registry — three-gate + ship-gate

Carved sentence (Aaron 2026-06-02):

> Before minting any new structure, run the **algebra-first admission procedure**;
> only **quality + uniqueness + composability** gate entry; the registry **IS our
> cross-language BCL** and is the **ship gate** — we don't ship what's not in it
> except named asymmetric exceptions. Everything earns its place by *not* being
> needed: prefer express-as-algebra > already-covered > use-existing > add-new.

## Operational content

When about to author *any* new primitive / collection class / "special index" /
container / structure, run this **before** writing it. (Full treatment + worked
examples + the registry itself: [`docs/backlog/P1/081KT2T2J0008QG0R0008TFHJT-*`](../../docs/backlog/P1/).)

### 1. Algebra-first admission procedure (ordered)

1. **Can it be an algebra?** (generic-math / monoid-group-ring / the Z-set family /
   the codec algebra / the temporal-operator algebra) → **YES → do that.** Express
   it as the algebra; it lives on an algebraic axis. Stop.
2. **Else — does the existing algebra completely cover its use case anyway?** →
   **YES → stop** (don't add; redundant).
3. **Else — do any other existing rules / primitives apply?** → **YES → use them.**
   → **NO → add it to the registry** (then it must clear the three gates).

Algebra-first by design: every step before the last is a reason **not** to grow the
registry. This is `earn-its-keep` / `all-complexity-is-accidental-in-greenfield` /
`razor-discipline` at *primitive* scope.

### 2. The three gates — the only barriers to entry

A candidate is promoted **only** when it passes all three (nothing else gatekeeps —
no taste, no seniority, no politics):

- **Quality** — stated laws + tests (FsCheck; **byte-lock golden vectors** for
  anything that crosses a language/wire boundary).
- **Uniqueness** — not a duplicate / view / composition (the 4-question triage:
  already-have-it? a view? does existing decompose into it? or it into existing?).
- **Composability** — composes at the HKT level with the rest (`081KT2T2J0008QG0R0038CRFJM`).

### 3. The registry IS our BCL + the ship gate

- The canonical-primitives registry is the **Zeta Base Class Library** — multi-axis
  (data Z-set algebras · codec algebra · temporal-operator algebra · generic-math
  base; everything-is-algebra is the convergence target).
- **Registry-membership is the precondition to ship** (via Ace, `081KR2E4K0008QG0R002YE3MMD`/`081KSGS9H0008QG0R0031PBNGA`).
  We don't ship what's not in the registry. Goal: everything in it eventually —
  "or else what's it for."
- **Only off-ramp: a named asymmetric exception** (host adapter / interop shim /
  bootstrap that *can't* be cross-language-guaranteed) — shipped as a flagged
  exception with the waived guarantee stated, per the human-audit risk-acceptance
  attribution pattern, **not** a silent bypass.
- The cross-language guarantee **compounds**: each promoted primitive ships its
  cross-language contract (per-language algebra + byte-lock vectors), so the more we
  ship the larger the provably-identical-across-languages surface. Minimality is
  *why* it's trustworthy — every entry is a contract Ace maintains across every
  target language.

### 4. What registers vs what adapts — the closed four-bucket sort (Amara 2026-06-02)

> The registry stores **atoms and laws**; sources, views, and transports **adapt**
> into those laws. **Do not register a source when you can register the algebra it
> emits.**

Every candidate sorts into exactly one bucket — only the first is the registry/BCL:

| Bucket | What | Examples |
|---|---|---|
| **registers** | atoms + laws = **algebras** | Z-set family · codec algebra · Tick algebra · generic-math base |
| **adapts** | **sources · views · transports** | `TickSource*` (Manual/Timer/CircuitStep/WebSocket/GitEvent) · Rx + event-index (views) · the wire under the codec (transports) |
| **executes** | **runtimes** | the DBSP Circuit step-loop |
| **waives** | named **asymmetric exceptions** | host adapters that can't be cross-language-guaranteed |

So when a candidate is a *source* (it emits values), register the **algebra it
emits**, not the source — e.g. register the **Tick algebra** (`Tick`/`Delta`/`zero`/
`advance`/`order`/`monotonicity`/`z⁻¹`); `WallClock`/`Timer`/`CircuitStep`/`WebSocket`/
`GitEvent` tick-sources are adapters. The algebra-first procedure is the registry's
**immune system**: it sorts every candidate into these four and admits only the
algebras.

## Why this auto-loads

Per [`wake-time-substrate.md`](wake-time-substrate.md): this fires at
**authoring time** — the moment before a new structure is written, in any language.
Auto-load puts the algebra-first procedure + three gates + ship-gate in working
memory *before* the special-class is minted, not after it leaks in. Aaron 2026-06-02:
"any rules [that] are minimal like that we should likely save."

## Composes with

- [`numerical-algebra-shaped-into-the-generic-math-interface.md`](numerical-algebra-shaped-into-the-generic-math-interface.md) — algebra-first step 1 (get it into generic-math)
- [`bcl-interface-boundary-own-your-interfaces-hexagonal.md`](bcl-interface-boundary-own-your-interfaces-hexagonal.md) — own the interfaces; the registry IS the BCL the boundary protects
- [`verify-existing-substrate-before-authoring.md`](verify-existing-substrate-before-authoring.md) — the uniqueness gate / 4-question triage is this at primitive scope
- [`all-complexity-is-accidental-in-greenfield.md`](all-complexity-is-accidental-in-greenfield.md) + [`razor-discipline.md`](razor-discipline.md) — the procedure is the razor at primitive scope
- [`monad-propagation-pattern-cross-language-substrate-shape.md`](monad-propagation-pattern-cross-language-substrate-shape.md) — composability gate (HKT-composes) + cross-language shape
- [`human-audit-and-legal-risk-acceptance-pattern-in-settings.md`](human-audit-and-legal-risk-acceptance-pattern-in-settings.md) — named asymmetric exceptions are documented waivers
- [`wake-time-substrate.md`](wake-time-substrate.md) — why this auto-loads
- 081KT2T2J0008QG0R0008TFHJT (the registry + full treatment), 081KT2T2J0008QG0R0038CRFJM (minimal vocabulary), 081KR2E4K0008QG0R002YE3MMD/081KSGS9H0008QG0R0031PBNGA (Ace), 081KT07NV0008QG0R003BE6MJ2 (Bonsai codec), 081KRFA460008QG0R0018SN61J (HKT), 081KT2T2J0008QG0R000S7GHQ8/081KT2T2J0008QG0R003BT1RS7 (the engine using the primitives)

## Full reasoning

Aaron 2026-06-02 derived these across the 081KT2T2J0008QG0R0008TFHJT arc: the suspicion test →
4-question triage → the registry → the three gates → multi-axis (codec/time) →
codecs-are-algebra → algebra-first procedure → registry-is-BCL/ship-gate →
tick-source-folds-to-algebra. The minimal procedures are saved here as the
auto-loaded authoring discipline; 081KT2T2J0008QG0R0008TFHJT holds the full substrate + the worked
audit/procedure-runs.
