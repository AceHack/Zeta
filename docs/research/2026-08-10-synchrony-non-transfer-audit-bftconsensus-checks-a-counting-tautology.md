# Synchrony non-transfer audit — and `BftConsensus.tla` checks a counting tautology

**Date:** 2026-08-10 · **Trigger:** Aaron, *"lets do all of them"* (item 2 of the ranked next-actions) ·
**Recorded by:** Otto (shadow)

**What this is:** the audit asked for by the singular-limit result — *a property verified under a
synchrony assumption does not transfer to `τ > 0` by continuity, because the limit is singular, so
uniformity in `τ` must be proven rather than inherited* (see
[`…delay-is-the-decoupling-operator…`](2026-08-10-delay-is-the-decoupling-operator-timescale-separation-differentiation-and-entropy-metered-into-privacy-budget.md) §3c).

**Headline: the corpus is healthier than the audit's first pass suggested, and one spec is worse.**
A naive detector flagged 9 of 31 TLA+ specs; **8 were false positives and several are exemplary**.
The one real hit has three further defects that only reading it surfaced.

---

## 1. The calibration, reported first because it is the more important half

The naive detector was: *spec prose mentions liveness/termination* ∧ *its `.cfg` has no `PROPERTY`
line*. It returned 9. Spot-checking before writing anything up (the anti-vacuity discipline applied
to my own detector) showed the rule is mostly wrong:

| spec | naive verdict | actual | why |
|---|---|---|---|
| `PermanentHarmHorizon` | mismatch | **exemplary** | states outright *"It does NOT prove LIVENESS"* and documents the route to it |
| `RecursiveSignedSemiNaive` | mismatch | **fine** | encodes termination as a *bounded invariant* on purpose — "faster, and catches…" |
| `SpineAsyncProtocol` | mismatch | **fine** | same technique — `InvFlushTerminates` |
| `PredictiveLookahead` | mismatch | **exemplary** | see below |
| `BftConsensus` | mismatch | **REAL** | §2 |
| 4 others | mismatch | not individually verified | assume the same base rate until checked |

`PredictiveLookahead.cfg` deserves quoting as the standard: it records that liveness is
*deliberately* unchecked, that mixing a state `CONSTRAINT` with a liveness `PROPERTY` is **unsound
in TLC** (the constraint creates artificial sinks that corrupt fairness), and that in a sound
bounded model `EventualCommit` is **VIOLATED**. That is the opposite of a false green — it is a
spec that refuses to bank a result it knows would be spurious.

> **So the detector is NOT shipped.** A ~1-in-9 precision rule that fires on healthy specs would
> manufacture exactly the noise this session has been removing. Recorded here as a measured
> negative result: "prose mentions liveness + no `PROPERTY`" does not discriminate, because the
> two legitimate patterns — *scoping liveness out explicitly* and *encoding it as a bounded
> invariant* — both look identical to it. A detector that works would have to read the
> **relationship** between claim and check, which is the same problem the proof-closure auditor
> solved by parsing structure rather than matching words.

Bare counts, for the record: 31 `.cfg` files, 22 with no `PROPERTY` line. That is **not** a defect
measure — safety-only checking is a legitimate and common choice.

## 2. `BftConsensus.tla` — the real finding, and it is not primarily about synchrony

The header states two properties:

> *"Safety: no two honest nodes commit different values. Liveness: if enough honest nodes propose,
> consensus is reached."*

Neither is what the spec checks. Four distinct defects, each verified by reading the source and
the config rather than inferred — and §2b is now confirmed by **execution and mutation**, added
below after the original write-up.

### (0) EXECUTED 2026-08-10 — the green is real, and it survives deleting the protocol

The original audit argued §2b from a counting argument and left open whether TLC actually runs
this spec. Both questions are now settled empirically.

**TLC does run it, and the green is not a silent skip.** `tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs`
carries ``TLC validates BftConsensus``, and it passed in 801 ms. That timing was initially
suspicious — `assertSpecValid` *"skips silently"* under several conditions (no `.cfg`, missing
jar, non-Linux CI, non-x64, slim runner), and a silent skip reports as **Passed**, not Skipped.
Running TLC directly on the spec took **0.828 s**, matching. So the runner genuinely executes it;
the skip suspicion was wrong and is recorded as such.

**The model check is exhaustive.** TLC reports *"Model checking completed. No error has been
found"* — **982 states generated, 99 distinct, complete state graph to depth 6, 0 states left on
queue.** The whole reachable space is explored. This is a real, complete, passing verification.

**And the mutation test shows it verifies nothing about the protocol.** Removing the quorum guard
from `Decide` — so that *any* node may decide *any* value at *any* time, with no quorum
whatsoever — leaves TLC still reporting **"No error has been found"**, now over **1270 states
generated, 243 distinct**. The state count changing 99 → 243 confirms the mutation genuinely
altered the model rather than being ignored.

> **A deliberately broken consensus protocol passes this spec's safety check unchanged.** That is
> the counting argument in §2b, demonstrated rather than asserted: the invariant constrains the
> *state representation*, not the protocol. It is the strongest available evidence that this green
> is vacuous, and it is reproducible in under a second.

(Mutation performed in a scratch copy; the in-tree spec is untouched.)

### (a) The stated safety goal is not expressible in the model

`decided` is a **single global variable** (`decided \in Values \cup {"none"}`), not a per-node
function. There is exactly one decision in the entire state space by construction, so *"no two
honest nodes commit different values"* has no representation — it is not proven, disproven, or
checkable. The property the header advertises is absent from the model, not merely unverified.

### (b) The invariant that IS checked cannot fail — it is pigeonhole, not protocol

```
QuorumSize == (2 * MaxFaulty) + 1                 \* = 3, with MaxFaulty = 1
HasQuorum(v) == Cardinality({n \in Nodes : votes[n] = v}) >= QuorumSize
NoConflictingQuorum == ~ \E v1, v2 \in Values : v1 # v2 /\ HasQuorum(v1) /\ HasQuorum(v2)
```

`votes` is a **function** `Nodes -> Values ∪ {"none"}`, so each node contributes exactly one vote.
Two distinct values each holding ≥ 3 votes requires ≥ 6 nodes. `Nodes` has 4. **No reachable state
can violate it, and no action could — including `ByzantineVote`, which changes a node's vote but
cannot give it two.**

So the green is a **counting tautology about the state representation**, true independent of the
protocol. This is the vacuity class in its purest form: a check that cannot fail is not a check.
It would stay green if `Decide` were deleted, if `CastVote` were deleted, or if the quorum rule
were wrong.

### (c) Liveness is claimed in prose and does not exist anywhere in the file

Zero temporal operators, zero `<>`, zero `~>`, zero liveness definitions, and no `PROPERTY` in the
`.cfg`. This is the one genuine instance in the corpus of a spec advertising liveness it never
formalises — and it is worth contrasting with `PredictiveLookahead`, which formalises liveness
properties and then explains precisely why it declines to check them.

Note the deeper reason this matters and is not pedantry: with no message model at all (no network
variable, no in-flight state, no delivery), `HasQuorum` reads the **global, current** vote function
atomically. That is a synchronous shared-memory model. Deterministic consensus liveness is
impossible in an asynchronous system with one faulty process (**FLP 1985**) — so liveness here is
not merely unchecked, it is claimed in a setting where the honest version of the claim requires a
synchrony or partial-synchrony assumption that the spec never states.

### (d) `DecisionStable` is defined but never checked

```
DecisionStable == decided # "none" => [][decided' = decided]_vars
```

Defined in the module, absent from `BftConsensus.cfg`, which lists only `INVARIANT SafetyInvariant`.
Also `THEOREM Spec => []SafetyInvariant` is stated with no proof, and TLAPS is run on
`NciSafetyProofs` / `NciNonUrgencyProofs`, not on this file.

### What the spec does honestly, and should keep credit for

Its scoping comment is genuinely good and should survive any rewrite: it says the model assumes a
**fixed, authenticated node set**, that sybil resistance is an economic property proven elsewhere
(the bond curve), and that these are *"two different proofs for two different threats."* That is
correct separation of concerns. The defect is in the properties, not the framing.

## 3. Disposition

Recorded, **not repaired**. Rewriting a BFT spec — introducing a message/network model, making
`decided` per-node, adding partial-synchrony assumptions and a conditional liveness property — is
design work with real judgement in it, not a mechanical fix, and it belongs with whoever owns the
consensus surface rather than with an autonomous tick.

**What a repair would have to do, in priority order:**

1. Make `decided` a per-node function so the advertised safety property becomes *expressible*.
2. Then `NoConflictingQuorum` stops being pigeonhole, because two nodes deciding differently
   becomes a reachable shape to exclude.
3. Add a message/network variable so quorum is computed over *received* votes rather than global
   ones — without it, no delay-related property can even be stated.
4. Either check `DecisionStable`, or delete it.
5. Either state liveness as conditional on a partial-synchrony assumption and check it, or scope it
   out explicitly in the `PredictiveLookahead` style. The current header is the only unacceptable
   option.

**Falsifier for this audit itself:** exhibit a reachable state of `BftConsensus.tla` violating
`NoConflictingQuorum` under `Nodes = {otto, vera, riven, lior}`, `MaxFaulty = 1`. If one exists the
tautology claim in §2b is wrong. (Predicted: none, by the counting argument.)

## 4. Anchors

- **Fischer, Lynch & Paterson (1985)** — impossibility of deterministic asynchronous consensus with
  one faulty process; why §2c's liveness claim needs a synchrony assumption it never states.
- **Dwork, Lynch & Stockmeyer (1988)** — partial synchrony, the standard honest form of that assumption.
- **Lamport, Shostak & Pease (1982)**; **Castro & Liskov (1999)** — the BFT results the spec gestures at.
- **Hale (1977)** — functional differential equations; the singular-limit result that motivated this audit.

## 5. Pointers

- `src/Core.TLA/specs/BftConsensus.tla` · `BftConsensus.cfg` — the subject
- `src/Core.TLA/specs/PredictiveLookahead.cfg` — the standard to copy for declining to check liveness
- `src/Core.TLA/specs/PermanentHarmHorizon.tla` — the standard for scoping liveness out in prose
- [`…delay-is-the-decoupling-operator…`](2026-08-10-delay-is-the-decoupling-operator-timescale-separation-differentiation-and-entropy-metered-into-privacy-budget.md) §3c — the singular-limit result this audit executes
- `src/Core.TypeScript/hygiene/audit-proof-closure-claims.ts` — the detector that *did* work, by parsing structure instead of matching words
