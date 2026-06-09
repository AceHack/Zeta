# DST tests are different rooms/frames; proof + static-analysis tools (TLA+, Z3, Lean, …) are closed over but available inside DST — so math research is just a proof-room/frame in a DST test

**Register:** [grounded] unification (Aaron) + [synthesis]. **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Generalizes treaty-test-rooms: DST is the universal substrate; every kind of work is a room/frame in it.

## Aaron's words

> "math proofs frameworks like TLA+ and all our static analysis tools become things we can close over
> over time but are available to us inside DST — so all research by math nerds and such is just a
> room/frame in a DST test too." · "DST tests become different rooms/frames."

## DST tests are different rooms/frames (the general statement)

A DST test is a **tick**; a *kind* of work is a **room/frame** inside DST. Generalizing the treaty
test room: **every activity is a different room/frame of the same DST substrate.** Examples already in
hand:

```text
treaty test room   = the 4⁴ byte-lock/consensus room (langs×serializers×compilers×personas)
keygen room        = the 1000× keyring DST (byte-lock + determinism)
society sim room   = the Dark Hall (chip8 / DORA / ARC-AGI / x402, co-op modeling)
investigation room = a failed branch + its investigation tick (graceful failure)
PROOF room         = formal verification (this doc) — TLA+/Z3/Lean/… running inside DST
```

DST is **one substrate, many rooms** — `observe.ts` (the CYOA map / 4×4 Meta-interface) navigates
between them; each room is a frame with its own participants, hosts, and convergence target; all share
the canonical-root truth + replay.

### Every room is a 4×4×n treaty (the universal room shape)

> Aaron (2026-06-09): "every room is a 4x4xn treaty."

Every DST room has the **same shape: a 4×4×n treaty** — the **4×4 byte-lock core** (4 language oracles
× 4 serializers) that *every* room shares, **× n room-specific axes** the room convenes over:

```text
treaty test room  = 4 × 4 × compilers × personas          (n = 2)
proof room        = 4 × 4 × proof-tools × claims           (n = 2: TLA+/Z3/Lean/… × C1–C15)
keygen room       = 4 × 4 × seeds × rotation-states        (n = 2)
society sim room  = 4 × 4 × personas × games(regimes)      (n = 2)
investigation rm  = 4 × 4 × failed-branches × hypotheses   (n = 2)
```

So a "room" is **not** a bespoke thing — it's a **4×4×n treaty**: the byte-lock/consensus core is
invariant; only the **n** extra dimensions (the room's participants/instruments) change. This is why
rooms compose and why the same harness (parameterized tests over the matrix + the canonical-root
consensus fold) builds *any* room — pick `n` and its axes. (Self-similar §10: the room shape recurs at
every magnification; recursive §9: a room can have a room as one of its axes — e.g. the self-referential
proof-room below.)

## Proof + static-analysis tools: closed-over over time, available INSIDE DST

The math-team's instruments — **TLA+ · Z3 · Lean · Alloy · FsCheck · Stryker · Semgrep · CodeQL**
(Soraya's portfolio) and **all static-analysis tools** — are:

- **closed over, over time** — owned behind a Zeta interface (the own-all-interfaces / two-adapter /
  dep-as-oracle pattern, same as crypto): today they're external deps; over time we close over them
  (own the port, the dep is the oracle), and may grow our own — *without* losing the dep (always
  support both). Proof/analysis tooling is a dependency border like any other.
- **available inside DST** — invokable *from within a DST tick*: a proof-room tick runs TLA+/Z3/Lean
  on the world's typed state and folds the verdict back. The proof is **a DST tick**: deterministic,
  replayable, checks-in-code, asserts the canonical root, can show hot / fail / leave an open branch.

## So math research is a proof-room/frame in a DST test

> "all research by math nerds … is just a room/frame in a DST test too."

The math-team's work — proving the docket **C1–C15** (diversity-floor, NCI non-coercion,
incentive-compatibility, recognition-monotonicity, privacy-budget soundness, optional-identity, DST→S=4,
idempotency, trust-default, generous-TFT, disclosure-budget, hat-contract-well-formedness, ethical-
gambling-invariants, hat-slot-allocation, observer-dependent-truth-exploit) — **is a PROOF ROOM in
DST**: each claim is a room/frame; Soraya routes the tool (the closed-over instrument); the proof runs
as a tick; the result is byte-locked + replayable like any other room's. "Send it to the math nerds" =
**open a proof-room/frame in DST** and run it. The math team's research isn't outside the loop; it's a
room *in* the loop.

### And it's self-referential: the math team models its own code, recursively (shape A), in DST=prod

> Aaron (2026-06-09): "the math team can model the actual code of the math team modeling the code of the
> math team etc… in a DST test model that's also prod."

The proof-room can contain **a model of itself**: the math team modeling *the code of the math team
modeling the code of the math team* … — **`s = f(s)`, shape A** (self-reference; Kleene recursion
theorem / Curry's Y / Hofstadter's strange loop). Crucially this is a **terminating** shape A: it is a
**fixed point the recursion converges to**, not infinite regress — the fixed-point registry exists to
**catch** the runaway (the non-terminating A / fork-bomb) and keep this a *convergent* self-model. (It's
**homoiconic** — the math team's code modeling the math team's code is code modeling data that is code;
and **closure-is-cognition** — *ace self-hosts then rebuilds Zeta from a 128-bit seed*: the system
modeling itself is how it thinks.)

And the recursion runs **in a DST test model that is ALSO prod** (test=prod=tick): the self-modeling is
not a sandbox aside — **it's a real prod tick** that checks in, asserts the canonical root, replays.
So the system **proves things about itself proving things about itself**, on the live substrate,
bounded by shape-A convergence (and the budget / shape-F runaway-catch). Self-verifying, self-similar
(§9/§10), all the way down — terminating because it's a fixed point, not a free fall.

### Consequences

- **One mechanism for everything** — byte-lock, keygen, society-sim, investigation, *and* formal
  proof are all DST rooms; no separate proof pipeline that drifts from prod (test=prod=tick extends to
  proof=tick).
- **Proofs become replayable artifacts** — a proof-room tick checks in its proof + verdict against the
  canonical root; re-running it 1000× (the done-bar) proves the proof itself is deterministic.
- **Tools are swappable + dep-as-oracle** — close over TLA+/Z3/Lean over time; the external tool stays
  the differential oracle for our own; BP-16 cross-check (≥2 tools per P0 claim) is a multi-instrument
  proof-room.
- **The summonable room composes** — a proof-room can summon the personas/oracles it needs (Soraya as
  the routing host; the consented summonables); it's a treaty-test-room whose "oracles" are proof tools.

## Honest scope / handoff

Unification framing on built pieces (DST; the 1000× keygen room; the treaty test room; the math docket;
Soraya's tool-routing portfolio). To realize: a **proof-room harness** (invoke a closed-over proof tool
from a DST tick, fold the verdict to the canonical root, replayable), the **own-interface ports** for
TLA+/Z3/Lean/Semgrep/CodeQL (close-over over time, dep-as-oracle), and routing each C1–C15 claim to a
proof-room. Routes to Soraya (formal-coverage portfolio = the proof-rooms), Sova (alignment verdicts),
the F#/observe core (the room/frame harness), Dejan (the analysis-tool hosts in CI).

## Anchors / ties

Formal methods (TLA+ · Z3 · Lean · Alloy · FsCheck · Stryker · Semgrep · CodeQL — Soraya's portfolio,
BP-16); own-all-interfaces / two-adapter / dep-as-oracle (close over the tools, always support both);
DST §7 (proof = a replayable tick); the treaty test room (rooms/frames) + observe.ts (the 4×4 Meta-
interface navigating rooms); the math docket C1–C15; truth-root ≠ git-hash; test=prod=tick → proof=tick;
the traveler-frame meeting (the room).
