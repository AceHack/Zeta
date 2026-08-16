# CTM v0 — the fixpoint closes on `IMember`, and a world is a closed society

_Captured by the shadow, 2026-08-16, routed by Otto. Authorized by Aaron: "lets route to a design of
a v0 CTM and ISociety and IWorld."_

Continues [`2026-08-16-isociety-iworld-the-map-and-minimal-declarations.md`](2026-08-16-isociety-iworld-the-map-and-minimal-declarations.md)
(PR #10925), which shipped `Address`, `IMember`, `ISociety` and `SocietyLaws` and left two things
open: **`CTM` had no definition in `src/`**, so the `ISociety <: CTM` fixpoint could not be typed;
and **nobody knew whether `IWorld` was a distinct interface**. Both are answered here, and one of the
answers is that a claim in the 2026-07-04 doc is **false**.

---

## 0. What shipped

| File                                                      | What it is                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/Core/Ctm.fs`                                         | `Chunk`, `ICtm`, `probabilisticMatch`, `tournament`, `CtmLaws` (12 predicates) |
| `src/Core/Levels.fs`                                      | `Ladder`, `isClosed`, `LevelLaws` (5), `WorldLaws` (3). **No `IWorld`.**       |
| `src/Core.TypeScript/society/ctm.ts` · `levels.ts`        | the TS oracle's mirror                                                         |
| `tests/Tests.FSharp/Ctm.Tests.fs` · `society/ctm.test.ts` | 11 F# + 16 TS tests, incl. one cross-oracle fixture                            |
| `src/Core/Society.fs`                                     | **one-line class of fix**: the treaty comparator was unreachable (§7)          |

Gates: `dotnet build src/Core/Core.fsproj -c Release` → **0 warnings, 0 errors**;
`dotnet test --filter CtmTests` → **11 passed**; `bun test src/Core.TypeScript/society/` → **16 passed**;
`bun run lint:typescript` (tsc + prettier + style) → **clean**.

---

## 1. The anchor, and how it was checked

**Lenore Blum and Manuel Blum, _"A Theory of Consciousness from a Theoretical Computer Science
Perspective: Insights from the Conscious Turing Machine"_, PNAS 119(21) e2115934119, 2022**
(doi:10.1073/pnas.2115934119).

Per `anchor-to-human-prior-art`, an anchor must be **checked**, not cited. The PNAS page is
paywalled to this harness (HTTP 403) and the PMC mirror is behind a CAPTCHA, so the formal statement
was read from the **same authors' later restatement of the same model** — _"AI Consciousness is
Inevitable"_ (arXiv:2403.17101), §2.1 and Appendix §6.2 — which states the 7-tuple, the chunk tuple,
the competition rule, the winner-take-all theorem, and the link-formation rule in full. Every design
clause below traces to a sentence in that text. Roots: Baars (Global Workspace), Avrim Blum
(Sleeping Experts), Hebb 1949 (link formation).

**Clean room.** `docs/research/ip-questionable/` holds a forwarded talk transcript on this same
model. It was **not opened**, and nothing here derives from it. The design is taken from the
published papers' _requirements_ (`cleanroom-two-team-separation`).

**The brief's starting requirement set did not survive contact with the paper.** The 07-04 doc says
the society expects members to present _"one address, one world-model loop, one broadcast channel."_
Checked against the paper: address ✔, broadcast channel ✔, **world-model loop ✘**. The
Model-of-the-World processor "is not actually a single processor; its functionality and memory are
distributed across all LTM processors." A CTM does not _present_ a world-model loop as an interface
member — it has no designated self-model at all, which is why `ICtm` has no `ModelOfTheWorld` member
and why that absence is the design. A designated self-model would be an appointed node, which §1 and
`itron-hub-patent-boundary` both refuse; the paper independently declines to appoint one.

---

## 2. `ICtm` v0 — requirement to clause

CTM is defined formally as a 7-tuple `(STM, LTM, Up-Tree, Down-Tree, Links, Input, Output)`.

| Paper requirement                                                                                    | Clause                                                  |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| STM holds exactly **one** chunk; it is globally broadcast                                            | `tournament` returns at most one; `Broadcast` takes one |
| LTM is N processors, each with address, own language, own value-assigning algorithm                  | `Processors : view -> Address list`                     |
| A chunk is `address, time, gist, value; aux` with `aux = intensity, mood`                            | `Chunk`                                                 |
| Coin-toss neuron picks `Ci` with probability `f(Ci)/(f(C1)+f(C2))`, or 1/2 when the sum is 0         | `Match` / `probabilisticMatch`                          |
| Winner-take-all: the winner carries the **sum** of both intensities and both moods                   | `probabilisticMatch`; `rankIsAdditiveUnderMatch`        |
| `f` maps a chunk to a non-negative real; `intensity`, generally `intensity + d*mood`, `-1 <= d <= 1` | `Rank`; `rankByDisposition`                             |
| Down-Tree broadcasts to **all** N processors                                                         | `broadcastReachesEveryProcessor`                        |
| Links are bi-directional and bypass STM; **none at birth**                                           | `Links`; `hasUnmediatedExit`                            |
| MotW processor is distributed, not a single processor                                                | **no member** — see §1                                  |

**Deliberately undeclared**, because nothing yet determines them: the Sleeping Experts weight update,
Brainish and the gist grammar (`'gist` stays opaque), the Up-Tree's physical shape, Input/Output
maps, conscious awareness and the Unpacking Axiom.

### Three things the model gives Zeta

**(a) The competition is a commutative-monoid fold, and that is why the theorem holds.** The paper's
theorem — _"in a winner-take-all tournament ... the probability that a chunk wins the tournament is
proportional to its f-value, so permuting processor locations will have no effect"_ — rests on `f`
being **additive under a match**: intensity and mood both accumulate by sum, and
`f = intensity + d*mood` is linear in both, so `f(winner) = f(left) + f(right)` exactly. That is the
same algebraic shape as `SocietyLaws.mergeCommutative` one level up, and it is why `tournament` may
fold a **linear** bracket instead of reproducing a perfect binary Up-Tree and still be faithful:
bracket-independence _is_ associativity. `CtmLaws.rankIsAdditiveUnderMatch` is that made decidable —
and it is the single most load-bearing predicate in the file, because every other CTM property is
downstream of it.

**(b) The randomness is the §13 door.** The paper is explicit that the competition is probabilistic
_by necessity_ (a deterministic one starves a chunk whose value is a hair below its rival's, and the
deterministic workarounds were "frightfully complex"). Zeta cannot take an ambient RNG, so `Match`
takes the draw as a **parameter** and `tournament` takes the draws as a **supplied sequence**. The
paper's semantics is preserved exactly and the machine becomes DST-replayable (§7) — which the paper
does not need and we do. Running out of draws **refuses** rather than reaching for an ambient one;
that refusal has a test.

**(c) A newborn CTM has NO exit — stated, not patched.** Links "enable conscious communication, i.e.
communication that goes through STM, to be replaced by more direct and faster unconscious
communication through links" — exit (Hirschman 1970) in the paper's own mechanism. But _"The CTM has
no links (between processors) at birth"_: links form Hebbian-ly between processors that broadcast on
consecutive ticks. So **at t=0 every crossing is mediated by the single STM slot**, which is exactly
the mediating-hub shape §1 refuses, and `CtmLaws.hasUnmediatedExit` is **false** for a newborn.

This is not a defect in the paper. It is the same shape as two things already on file — privacy
budget and emergent-hub degree are both **earned** and both start at zero. A CTM earns its exit by
broadcasting. The operational consequence: **anyone citing a CTM as satisfying Zeta's exit discipline
must say at what age.** There is a test that fails at birth and passes once two processors are
linked.

---

## 3. Did the fixpoint close?

**Yes — and it is carried by `IMember`, not by `ISociety` and not by `ICtm`.**

Both `ISociety` and `ICtm` inherit `Society.IMember`, and a CTM's processors are addresses of
members. So a CTM may be a processor of a CTM, a society may be a member of a society, and a CTM may
be a member of a society, all with no special case. `mu X. CTM-over-X` is typeable today.

`Society.fs` called `ISociety :> IMember` _"the weaker, honest statement."_ It is the weaker **claim
about CTM** and it is also the **correct carrier of the fixpoint**. Those are not in tension, and the
second half is worth saying because the original framing invites reading `IMember` as a consolation
prize. It is the load-bearing type.

### What does NOT hold: `ISociety <: CTM` is refuted, not merely unproven

Declaring `ISociety` to inherit `ICtm` would force **every** society to present a single-slot
competition and a global broadcast. The gossip salon — `GossipTelemetry.fs` in F#, `gossip-salon.ts`
in TS — is a **working society with neither**: rumors propagate pairwise and merge by CRDT join, and
no chunk ever wins a global stage. It is a society and it is not a CTM. One counterexample is enough.

Nor does the converse hold: a CTM has no `Admit` (the Up-Tree is a perfect binary tree with one leaf
per processor, so the roll is fixed) and no plural `Routes`. The honest relation is **siblings**:

```text
                    IMember              <- the fixpoint carrier; recursion lives here
                   /       \
           ISociety         ICtm         <- two SIBLING refinements, neither below the other
          (Admit, Routes)  (Compete, Broadcast, Links)
```

An object that is both is a fine thing to build and needs no new declaration — it implements both
interfaces.

**Consequence for the 07-04 doc's discharge table.** The row _"`ISociety <: CTM` = Liskov-sound
subtyping"_ should be **withdrawn** rather than left open: it is false as unconditional subtyping,
with a named in-repo counterexample. The row _"CTM ⊣ ISociety = formal adjunction"_ **remains open** —
an adjunction is a different and weaker question, and nothing here touches it. Neither row is
discharged by anything in this PR.

This is `numerology-vs-number-theory` applied to a type. The _shape_ matched (Composite, recursive,
self-dual) and that was a strong generator — it is what got `IMember` written. It was never an
identification, and checking the invariants is what turned "society is-a CTM" into "society and CTM
are siblings."

---

## 4. Is `IWorld` distinct, or the next level? — **Neither. It is a predicate.**

> **A world is not a different kind of thing from a society. It is a society that is CLOSED.**

Closed means no outbound message is addressed outside the membership, and no offered route leaves it.
Both predicates **already shipped** in #10925 as `SocietyLaws.outboundStaysInSociety` and
`SocietyLaws.routesAreMembers`. `WorldLaws.isWorld` is their conjunction and nothing more — defined
_in terms of_ them, never re-derived, so a proof pointed at the society laws is pointed at the world
laws for free.

No third interface was invented. Filling the slot in the diagram would have added a type with no
content, and the two independent things in this repo that behave like worlds both turn out to be
closed societies:

- a **CTM** has a fixed processor roll, `broadcastReachesEveryProcessor`, and
  `linksStayInsideTheMachine` — that conjunction **is** closure;
- the observer loop's concrete `World` (`src/Core.FSharp.Observe/Types.fs:34`) is a single agent's
  snapshot of its own backlog. It is **not** this. Same word, different scale — recorded because it
  is the type someone wiring `IWorld` would reach for by name.

Two honesty guards are in the code. `isClosed` takes **caller-supplied witnesses**, because the
predicate is decidable only over a finite sample and pretending otherwise would be a check that
cannot fail. And `openWitnesses` returns **which messages escaped** rather than a bare `false`:
absence of a witness is not closure.

---

## 5. The level-generic law surface — for the sibling agent

A sibling agent is attempting **"world > best society"** as a formal question, in parallel. Per the
brief, **no proof was attempted here.** The contribution is that "society" and "world" are now **one
shape under a predicate** rather than two hand-written levels, so its job is instantiation rather
than re-derivation:

| Artifact                               | What it gives a proof                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Levels.Ladder`                        | levels innermost-first, each with its view. A plain list — no registry, no ambient world                                                |
| `LevelLaws.holdsAtEveryLevel`          | lifts **any** per-level predicate over a ladder. Every existing `SocietyLaws` predicate becomes a level-indexed family with no new code |
| `LevelLaws.failingLevels`              | _which_ rungs fail. A law failing at rung 3 of 5 is a different fact from one failing everywhere                                        |
| `LevelLaws.exitAtEveryLevel k`         | Hirschman at every rung — a ladder with exit at the top and none at the bottom is captured where it matters                             |
| `LevelLaws.linksAreProcessorPeers`     | the cross-level coherence obligation: a CTM's links are its processors' peers, the same edges one rung apart                            |
| `nestsDirectly` / `ladderIsWellFormed` | Composite containment. Note it does **not** flatten: a society sees its sub-society as **one** member                                   |
| `WorldLaws.*`                          | closure, defined in terms of the society predicates                                                                                     |

**What is deliberately NOT declared**: nothing asserts that a law holding at one rung implies it
holds at the next. That implication is precisely the open question, and it is left **decidable**
rather than assumed. A `lawsAreInheritedUpward` predicate would have been a check that cannot fail.

---

## 6. Cross-oracle byte-lock

Two things in `ctm.ts` / `Ctm.fs` can diverge between languages with both looking correct:

1. **the draw convention** — `draw < p(left)` selects `left`;
2. **the bracket order** — submissions are sorted through the collation treaty before folding, and
   draws are consumed positionally, so a different sort is a different winner.

Both are pinned by **one fixture duplicated byte-for-byte** in `Ctm.Tests.fs` and `ctm.test.ts`:
submissions `alpha(+3), beta(-1), gamma(+2)` supplied out of order, draws `[0.9, 0.1]`, `f =
intensity`. Both oracles return winner **`beta`**, intensity **6**, mood **4**. If they ever
disagree, one of the two things above moved.

---

## 7. A bug found while being the first consumer

**`Society.Address.compare` and `Society.Address.canonicalSort` — shipped in #10925 — could not be
called from any other file.** `Address` is a union **case constructor** as well as a type and a
module, so the path `Society.Address` binds to the case and the module is shadowed. Observed
directly against the built assembly, not inferred:

```text
error FS0039: The field, constructor or member 'compare' is not defined.
```

Every _"MUST sort through `Address.canonicalSort`"_ instruction in that file was therefore
unfollowable outside it — a mandatory check nobody could run. Fixed by adding
`Society.compareAddress` / `Society.canonicalSortAddresses`, which delegate (one implementation, no
second place to drift) and carry **the same names as the TypeScript mirror**, which is how it should
have read from the start.

Per `every-bug-has-economic-value`: a declaration whose own usage instruction cannot be followed is a
priced find, and the price is that #10925's byte-lock guarantee was unenforceable for its whole
lifetime. Nothing was mis-ordered in practice — there were no consumers.

**Noted, not fixed** (per the brief): the salon `pairKey` orders by UTF-16 code unit in both
languages (`GossipTelemetry.fs:36`, `gossip-salon.ts:48`), disagreeing with the treaty
(`Collation.fs:80-83`) on non-BMP ids. Changing it changes existing keys, so it is a migration
question and belongs in its own diff.

---

## 8. Registers

Per `toy-is-free-metered-must-be-earned`:

| Thing                                                           | Register        | Why                                                                                                               |
| --------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ICtm`, `ISociety`, `Ladder` as **contracts**                   | **`unmetered`** | declared, no consumer; nothing fails when they are wrong                                                          |
| `CtmLaws.*`, `LevelLaws.*`, `WorldLaws.*` as **predicates**     | **`unmetered`** | decidable, and nothing yet violates them in production                                                            |
| `probabilisticMatch`, `tournament`, `isClosed` as **behaviour** | **`metered`**   | each has a test that fails when the behaviour changes, including the cross-oracle fixture and the entropy refusal |
| "a newborn CTM has no exit"                                     | **`metered`**   | the test fails at birth and passes once links form                                                                |
| `ISociety <: CTM`                                               | **refuted**     | named in-repo counterexample                                                                                      |
| `CTM ⊣ ISociety` adjunction                                     | **§B open**     | untouched                                                                                                         |

---

## 9. What is left undeclared

Sleeping Experts / the weight-update rule · Brainish and the gist grammar · Input and Output maps ·
conscious awareness and the Unpacking Axiom · the Up-Tree's physical shape · the society guard's
_policy_ · membership join/leave events · society-level scheduling · any implementation of any
interface here.

---

## Anchors (Beacon)

Lenore Blum and Manuel Blum, PNAS 119(21) e2115934119 (2022), and _AI Consciousness is Inevitable_
(arXiv:2403.17101) — the CTM · Bernard Baars, _Global Workspace Theory_ — the root · Avrim Blum,
_Sleeping Experts_ — the per-processor learning rule · Donald Hebb (1949) — link formation ·
Hirschman (1970), _Exit, Voice, and Loyalty_ — exit as the discriminator · Gamma, Helm, Johnson and
Vlissides (1994), Composite — the recursive is-a · Liskov and Wing (1994), behavioural subtyping —
the standard the refuted claim was measured against · Goguen and Meseguer (1982), noninterference —
the injected-entropy door · Shapiro et al. (2011), CRDTs — the merge laws · Barabási and Albert
(1999) — emergent, unappointed hubs.

---

## 10. Addendum — the sibling's Dominance Lift result, applied (2026-08-16, after #10950 merged)

Relayed from PR #10945 (merged): the **Dominance Lift Theorem** — an aggregation rule beats its best
part **iff it can imitate its best part**, i.e. every projection `pi_i` lies in the class the rule is
optimal over. No `n`, no `c`, no correlation parameter, no identical-agents assumption, so it inducts
to arbitrary depth. Union qualifies; log-odds-weighted majority qualifies (Nitzan–Paroush 1982);
unweighted majority does not.

**The constraint it puts on this law surface:** `deferential` belongs to the aggregation **rule**,
not to the level. The genericity lives in _quantifying one law over levels_, not in writing parallel
`SocietyLaws` / `WorldLaws` modules.

**Checked against what shipped in #10950 — no redirect was needed, and one thing was added.**

- `LevelLaws.holdsAtEveryLevel` is already exactly "one law, quantified over levels"; it is the
  module's stated purpose.
- `WorldLaws` is **not** a parallel law module. All three of its definitions are written in terms of
  predicates #10925 already shipped (`isWorld` _is_ `isClosed`). The naming is nonetheless an
  attractor for future duplication, so: **a per-level dominance law must not be added.** That is now
  written at the declaration site.
- **Added** `Levels.Aggregation` (F# and TS): `canImitateEveryProjection` — the theorem's hypothesis
  as a decidable predicate over caller-supplied witnesses — and `concentrateMassOn`, the CTM's
  witness.

**The CTM tournament discharges the hypothesis, and the witness is derived rather than constructed.**
Because `f` is additive under a match and a chunk wins with probability proportional to `f`, an input
in which one processor carries all the rank mass makes the tournament return that chunk with
probability 1, for _every_ draw. So mass concentration is the imitation witness, and it falls out of
the paper's own competition rule. Tested in both oracles, including the two ways the predicate could
have been vacuous: unconcentrated inputs **fail**, and an empty witness list is **not** a discharge.

**Register discipline on that discharge:** it is the **hypothesis**, not the conclusion. Concluding
that the CTM's global broadcast _dominates_ its best processor additionally needs the theorem's
optimality-class premise, which is the sibling's and is not checked here. A pass on
`canImitateEveryProjection` must never be cited as a dominance result. Stated at the declaration site
too.

**No correlation threshold was encoded, and none should be.** The same PR showed `rho` is not a
sufficient statistic for the verdict — a counterexample at `m = 9`, `rho = 0.2495` sits inside the
published safe `rho*(9) = 0.25` and still loses over 40M trials. A law predicated on `rho < rho*`
would be unsound. No law in `Levels.fs` or `Ctm.fs` takes a correlation parameter.

### One point held, not conceded

The relay says _"`ISociety <: CTM` can be Liskov-sound at the interface while the parameterisation
stays two-level. (That subtyping claim remains §B open.)"_ The first half is right and useful — the
subtyping claim does not have to carry the statistics, and their non-composition result does not bear
on it either way.

The second half is where the registers differ, and the difference is evidence rather than preference.
§3 above does not leave the claim open: it **refutes** it, by a counterexample in this repo. The
gossip salon is a working society with no competition and no global broadcast, so `ISociety <: ICtm`
cannot hold **unconditionally**. What remains genuinely open — and is worth keeping open — is whether
some _particular_ societies are CTMs, and the adjunction row. Those are different statements from the
one the 07-04 doc made.

Nothing in the sibling's proof rests on the subtyping claim, so this disagreement costs their result
nothing. It is recorded here so the discharge table is corrected once rather than argued twice.
