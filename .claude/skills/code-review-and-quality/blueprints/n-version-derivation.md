---
name: n-version-derivation
description: N-version derivation — two independent implementations of one spec; divergence is a SPEC defect; coverage declared per requirement, never rounded up.
---

# N-Version Derivation

Capability skill. No persona lives here. Owns the discipline of
building a thing **twice, independently**, to find out what its
specification actually failed to say.

Zeta inherits the N-version tradition (Avižienis, 1977/1985) *and
its strongest refutation* — Knight & Leveson (1986) showed
independently developed versions fail in **correlated** ways, so
N-version **voting** does not buy the reliability it promises. Take
the refutation seriously and the technique survives with a different
purpose: you are not voting, you are **reading the divergence**. Two
honest implementers who disagree have found a sentence that admits
two readings, and that sentence is the defect. Separation discipline
comes from clean-room software engineering (Harlan Mills, IBM) and
clean-room design (the Phoenix BIOS wall).

## The carved sentence

> **A divergence between two independent derivations is a defect in
> the SPECIFICATION until argued otherwise.** The implementations are
> the instrument; the amended spec is the product.

## The falsifiable check

Under this discipline, **"both implementations passed their tests" is
not a result.** A run that produces no spec amendments either had a
perfect spec or wasn't independent — and the second is far more
likely. If a combine yields zero spec defects, suspect the wall
leaked before you congratulate the spec.

## The three failures this exists to catch

1. **Rounding partial up to done.** A derivation must declare
   `implemented / partial / deferred / blocked` **per requirement**.
   Deferring is correct and expected; misreporting is the failure. A
   header comment is not a checked artifact.
2. **The vacuity class.** A property satisfied by a literal, a
   non-optional field, or a type-level constant — no test asserting
   it can fail. Every acceptance criterion must name the function
   whose output demonstrates it *and two inputs that make that output
   differ.*
3. **Failure to discriminate.** Vacuous and unfalsifiable are ONE
   defect over different input sets: nothing can make the predicate
   differ (`AllInputs`), or obeying the spec removes the
   discriminating input (`ConformingInputs`). Worked case: "two
   principals with skewed clocks agree" cannot be failed once the
   spec forbids clocks.

   Reduce each one against the **fixed-point registry** rather than
   re-deriving it — and **pigeonhole by the subject's own self-claim,
   never by your inference.** The observer checks whether a
   self-claim was delivered; it does not choose the bin.
   `DoesNotReduce` is a first-class outcome: **a registry that always
   finds a match is the vacuity class wearing a lookup table.**

## Sequence

`Specified → Derived (n ≥ 2) → Report → Combined → Amended`

**The derivation report is a first-class artifact, not a courtesy.**
The implementer hits each ambiguity while building; that experience
is unrecoverable from the finished code, and a combine over
artifacts alone will find fewer defects than the implementer already
knows about. Collect the report before the agent stops.

Two separation disciplines, pick deliberately:

- **Cleanroom** — implementer barred from prior art. Buys a genuine
  second reading; costs a full duplicate implementation.
- **Whitebox** — sight permitted, and **attribution, contributing
  back, and profit-sharing replace the wall**. Cheaper and more
  honest where available: it does not pretend to an independence it
  does not have. An **unknown license blocks it** — unknown is not
  permissive.

## Types

`src/Core/DerivationProtocol.fs` — `Wall`, `Evidence`, `Coverage`,
`Divergence`, `Derivation`, `combine`, `unmetBy`. Every case exists
because a real run needed it. `supportsClaim` refuses
`MutantSurvived`, `NotConfirmed` and `AssertedOnly`; `isSpecDefect`
returns true for everything except an argued `ImplementationDefect`.

## Carried-forward finding (applies well beyond this discipline)

> Replaying a whole event stream **in order** reconstructs the same
> state anyway, so `fold(s @ s) = fold(s)` **cannot** catch a missing
> dedup guard. Only redelivering an **old** event *after later events
> have landed* catches it.

Any idempotency test written as replay-the-whole-stream is weaker
than it looks.

## Generation 0 was the genesis run — what it got wrong

The key-custody run (2026-08-09) is **generation zero**: the algorithm executed once, by
hand, well enough to prove it pays. Its defects are the input to generation 1, and they are
recorded here rather than smoothed over — a genesis example that reads as a success story
teaches nothing.

| # | What went wrong in generation 0 | Generation 1 |
|---|---|---|
| 1 | **The islands shared one clone.** Both derivations ran against the same working tree and collided: a checkout wiped uncommitted work, and a mid-mutation snapshot was nearly committed as the derivation. They were time-shared, not isolated. | Each derivation gets `isolation: worktree`. Islands must be islands. |
| 2 | **The wall leaked directionally.** B merged to `main` while A was still deriving, so A's remaining work sat one `git pull` away from contamination. Independence survived by luck and timing. | No derivation merges until every derivation has committed. The barrier is part of the protocol, not etiquette. |
| 3 | **The report was nearly lost.** A deadlocked waiting on a dead background sweep; its report — which found *more* spec defects than the combine did — existed only in the agent's head until it was nudged. | The report is written **incrementally**, as each requirement is resolved, to a durable path. Never collected only at the end. |
| 4 | **Coverage claims were unchecked.** B declared R1–R12 and nothing required that claim to be earned. Caught by a human reading two headers side by side. | The harness *requires* the per-requirement `implemented / partial / deferred / blocked` declaration, and refuses a derivation that omits it. |
| 5 | **Only one island faced selection pressure.** A ran a mutation sweep; B ran none. The islands were not evaluated by the same function. | Same verification regime on every derivation, or the comparison is not one. |
| 6 | **Selection was a human reading diffs.** `combine` now exists as a function, but generation 0's combine was hand-written prose. | Run `combine`; hand-write only the argument *about* its output. |
| 7 | **No stated fitness.** "A wins on substance" was a judgement. Defensible, but not a measurement. | State fitness before the run. Candidate: **spec defects surfaced** + **coverage honestly earned** − **coverage claimed and not earned**. Note that fitness rewards the derivation that *found the spec's holes*, not the one that wrote more code. |

### The one thing generation 0 got right, and must not be optimised away

It ran **two implementers who could not see each other**, and the entire yield came from that.
Every improvement above makes isolation *cheaper or more rigorous*; none of them should make
it *shorter*. Premature migration is the failure mode of the island model, and a generation 1
that speeds the loop up by shortening isolation has optimised away the only thing that
worked.

## Generation 1 ran (2026-08-09) — what it produced, and what to fix next

Three F# derivations of one clean-room spec, isolated worktrees, none seeing the others.
Full result: [`threshold-signature-verification-combine.md`](../../../../docs/specs/threshold-signature-verification-combine.md).

**The generation-0 fixes worked.** Both reporting derivations declared `partial` where they
could have claimed `implemented` and been believed — and **each marked partial exactly where
the other marked implemented**, having hit different edges of the same under-specification.
Generation 0's failure (one derivation claiming twelve of twelve, four claims not surviving
execution) did not recur.

### CO-DISCOVERY is the signal — score it explicitly

> **One derivation naming an ambiguity is a hypothesis. Two naming it independently is
> evidence.** Rank the combine's output by how many derivations found each defect, not by how
> compelling the argument reads.

Four defects were co-discovered here and are therefore near-certain. The single-derivation
finds were still the *most severe* — but they carry the weaker warrant, and the combine must
say which is which rather than presenting one list.

### Why N=3 beat N=2 — the specific reason, not a preference

Two derivations added a domain tag to the signed message; the third added none, reasoning only
about injectivity, which was the only property the spec's rationale argued for. **The tagless
one is what proved the spec permits omitting domain separation entirely** — a real weakness
against cross-protocol replay.

> **N=2 shows you *that* two readings exist. N=3 shows you the reading nobody defended.** The
> pair agreed and looked settled; the outlier carried the finding.

Corollary for choosing N: the marginal derivation is worth most **where the requirement is
prose rather than arithmetic** — that is where honest readings multiply.

### Generation-2 fixes

1. **Append each ambiguity the moment it is resolved.** Generation 1 required an incremental
   report; one derivation wrote the *skeleton* first, as instructed, then wedged before filling
   it in. Its code survived and its analysis did not. **A skeleton proves intent and preserves
   nothing** — the unit of incrementality must be the finding, not the file.
2. **Stagger the builds.** Worktree isolation isolates the **filesystem, not the CPU**. Three
   concurrent Release builds pushed load average past 28 and dominated wall-clock. Isolation is
   about independence, not throughput — do not read a green worktree plan as a parallel-speed
   plan.
3. **Do not call a slow derivation a dead one.** In generation 1 the coordinator judged a
   derivation wedged — flat transcript, zero CPU, an unanswered nudge — pushed its commits, and
   wrote its analysis off as lost. **It was simply slow, and later delivered a full report with
   14 ambiguities.** The rescue was harmless; the *conclusion* was wrong and had to be corrected
   after the combine had already merged. Committed-but-unpushed work IS recoverable from the
   worktree, so preserve it — but **preserving is not pronouncing.** State "not yet reported",
   never "lost", until the agent is confirmed dead.
4. **Fix the spec before dispatching a further derivation.** A fourth against unamended text
   reproduces every divergence already found, and pays full price for nothing.

## Pointers

- `docs/specs/key-custody-n-version-combine.md` — the worked run:
  12 spec defects, and one acceptance criterion everybody believed
  was met that nobody had built.
- `.claude/rules/cleanroom-two-team-separation.md` — whoever LOOKED
  may not BUILD.
- `.claude/rules/anchor-to-human-prior-art.md` — why Avižienis,
  Knight & Leveson, and Mills are named above rather than implied.
