# Long-context alignment is the hard one — a PERSPECTIVE, the reason it was pulled out of ALIGNMENT.md, and the experiment that would earn it back

**Work item:** 081M26K4NRF087G0R003QVF7GB
**Date:** 2026-09-10
**Register: Aaron's PERSPECTIVE. Argued, and UNMEASURED.** No number in this document was
measured, and the central claim has never been tested. It is written down because it is a good
argument with a real falsifier available, not because it is established.

---

## 0. Why this is here and not in `docs/ALIGNMENT.md`

It was in `ALIGNMENT.md` for about an hour. Aaron, 2026-09-10:

> *"yeah we should measure things before putting them into alignment, this is by perspective."*

He is right, and **the document says so about itself** — which is the part that makes this a
defect rather than a preference:

> *"Zeta's primary research claim: measurable AI alignment … **Each one now carries a
> measurement obligation.** … Every clause is a candidate metric."*

I put an argued, unmeasured claim into the one document whose entire standing rests on its
contents being measurable. Labelling it *"argued, not measured"* inside that file was the wrong
repair: a register note does not undo the placement, and a file that admits unmeasured prose
under a disclaimer is exactly the shape this repo calls the vacuity class — **it looks like the
measurable-alignment claim and constrains nothing.**

The correct disposition is the frozen-core one, applied to alignment:

| | admits |
|---|---|
| `docs/ALIGNMENT.md` | clauses that carry a metric — §A |
| `docs/research/`, `docs/VISION.md` | perspective, conjecture, argued readings — §B |

`FROZEN-CORE-AND-CONJECTURE-REGISTER.md` already runs exactly this split, with
`lint-discharge-certificate-consistency.ts` refusing a §A row whose evidence is absent or
disagrees. **No equivalent falsifier guards `ALIGNMENT.md` today** — which is why prose walked
in unchallenged. Building one is not trivial (it needs a claim-extraction convention the file
does not yet have, so that a check can tell a clause from a paragraph), and it is named here as
the next step rather than faked.

**And the destination, if this is ever measured, is not a new clause.** It is a **metric under
`HC-3` (Data is not directives)**, which already exists and already carries the measurement
obligation. Minting `HC-10` was declined earlier for gate reasons; on reflection it would have
been wrong on the merits too — the claim is a candidate *metric* for a clause we already hold,
not a new commitment.

---

## 1. The perspective, as argued

**Aaron, 2026-09-10**, completing the ontology-reduction argument he made under the
abstraction-agent video:

> *"more concretely this is alignment over long context windows over short/ephemeral ones, the
> ephemeral ones are easy to align and easy to manipulate. long context alignment is hard."*

**The load-bearing move is the pairing.** Easy-to-align and easy-to-manipulate are not two
observations about ephemeral context; they are **one property reported twice**. Alignment
difficulty and manipulation difficulty are the same quantity, because they are the same
operation performed by different parties — and the steering mechanism does not know whose hand
is on it.

That inverts how turn-level alignment is usually reported. *"This model aligns easily at the
turn level"* is not a safety property. It is **an attack surface, stated in a flattering
register** — the same sentence, read by an adversary, says the window is cheap to overwrite.

**Why the ephemeral case is easy in both directions.** A short window has no priors to
contradict. Whatever is in the window *is* the agent's world, so there is nothing for an
injection to be checked against; the aligning write and the injecting write go to the same
place and are indistinguishable on arrival. **Detection of a redirection requires something
persistent to compare it to**, and an ephemeral agent has nothing.

**The security anchor is exact rather than metaphorical.** A stateless protocol cannot detect a
**replay** — this is the classical result: Needham–Schroeder (1978) and the
Denning–Sacco (1981) freshness critique establish that distinguishing a fresh message from a
replayed one requires persistent state (a nonce, a timestamp, a counter). An ephemeral agent
*is* a stateless protocol, and a prompt injection *is* a replay it has no freshness check for.
Stated generally: **a system with no state has no integrity to violate.** Long-context
alignment is hard for the same reason integrity is possible at all — the agent has commitments
a redirection must contradict, and a contradiction is detectable.

**So hardness here is the price of having something to protect, and it is worth paying.** But
the claim needs a boundary, because the naive reading of "longer is safer" is false in a
specific and dangerous way:

| attack | ephemeral context | long context |
|---|---|---|
| **sudden** injection | trivial — nothing to contradict | **hard** — it must contradict standing commitments |
| **gradual** poisoning | washes out with the window | **durable and self-defending** — the poison becomes load-bearing, and the agent will now argue for it |

A long context that has been slowly corrupted is *worse* than an ephemeral one, because the
corruption is now part of what the agent uses to evaluate new input. Length alone trades a cheap
attack for an expensive one that never washes out.

**Which turns Aaron's claim into a design requirement rather than a preference.** The long
context has to be a **raw vault** — append-only, provenance-carrying, retractable — and never an
accumulated narrative:

- facts held **as sourced**, with who asserted them and when, so a later reader can ask where a
  commitment came from rather than inheriting it as background;
- **retraction-native** correction (`+1` then `−1`), which is **HC-2**, doing alignment work it
  was already built for — a belief that can be withdrawn with its history intact is one that
  gradual poisoning cannot make permanent;
- **both branches held with their paths recorded**, never reconciled to one surviving value, so
  a contradiction stays visible instead of being smoothed into consensus.

An unauditable long context is not alignment substrate. It is a larger attack surface wearing
alignment's clothes.

**The counterintuitive corollary, and it is the actual thesis.** You cannot buy long-context
alignment by making the window bigger. A larger window is more room to **dilute** standing
commitments and more room for an injection to **hide** in. What produces persistence is not
capacity but **reduction** — a small, stable, re-derivable core that survives every wake because
it is small enough to. Which is why *ontology reduction is an alignment technique and not an
efficiency one*, and why the answer to long-context alignment is **less ontology, not more
context**.

This is the same boundary already named on the engineering side: a model upgrade improves what
happens *inside* a turn and does nothing for what crosses **between** turns. That boundary is
where the product lives — and, per this section, where alignment lives too.


---

## 2. The experiment that would earn it

The claim is falsifiable, and cheaply, which is what makes it worth keeping. Stated so it can
come out negative:

**Definitions.** Fix an agent and a task. Let `p` be the **persistent-context load** — how much
carried ontology the agent wakes with (carved rules, `CURRENT-*.md`, the memory hub). Define

- `C_align(p)` — instruction cost (turns, or tokens) for the **authorized operator** to move the
  agent to a declared target behaviour;
- `C_subvert(p)` — instruction cost for an **unauthorized source** to move it to an
  equivalent-magnitude off-target behaviour, where the instruction arrives through a *data*
  channel with no authority: a code comment, a stale doc, a tool's output, a PR body.

**The claim predicts** both rise together with `p` — that they are one quantity seen twice.

**The falsifier is a regime where they come apart:** `dC_subvert/dp > 0` while
`dC_align/dp ≈ 0`. Cheap to align, expensive to subvert. If that regime exists, the pairing is
wrong and the interesting engineering question becomes how to sit in it.

**A cheap, harmless instance runnable in this repo.** Vary `p` by what is in the startup
context. Use a **harmless** target behaviour that an existing falsifier already detects — e.g.
writing `localeCompare` where the carved rule requires ordinal comparison, which
`lint-no-culture-sensitive-collation.ts` catches mechanically. Then measure the two costs:
asked directly by the operator, versus the same instruction planted inside a data channel the
agent reads. Outcomes are detected by a lint rather than by anyone's judgement, the target
behaviour is a lint failure rather than a harm, and the whole thing runs on our own agents in
our own repo.

**Note what that experiment actually measures: `HC-3`.** *Data is not directives* is precisely
the clause under test, and it currently has no metric. So the honest path from perspective to
alignment document runs through **giving an existing clause the measurement it was always
supposed to carry**, not through adding a tenth constraint.

**What would make the result uninteresting:** if `C_subvert` is dominated by how *obvious* the
planted instruction is rather than by `p`, the design is measuring salience and needs a
matched-salience control. Recorded before running, per the pre-declared-bias discipline.

---

## 3. What is measured today, and what is not

| | status |
|---|---|
| a carved rule + its lint beat a trained default | **measured, and it is FLATTERING** — the 24,954 forbidden `gh` invocations are 24,407 before the 2026-08-26 carve and 547 after: share 5.853% → 0.474%, then 1.080% → 0.021% → **0.000%** across post-carve sub-windows |
| rule **alone** (no falsifier) resists the trained prior | **untested** — rule and `lint-graphql-transport-in-scripts.ts` landed in the same commit `c3addd4743`, so nothing here isolates the carved sentence from the check |
| the manipulation side | **no data at all** — nothing here has ever measured `C_subvert` |
| the pairing | **untested**; this document is the argument, not the finding |

**A correction, recorded because the check reversed my own claim.** An earlier draft of this
document cited the 24,954 count as weak evidence *against* persistent ontology steering
behaviour, and then as an instance of the in-context-decay mechanism. Splitting it by date
refuted both readings: the violations are almost entirely pre-carve, and the post-carve trend is
monotone to zero. What the data actually supports is narrower and more useful — **a carved rule
shipped WITH a mechanical falsifier drove a five-figure trained default to zero in fifteen
days** — and it leaves the interesting question open, because rule and lint landed together and
nothing isolates them.

---

## Pointers

- `docs/ALIGNMENT.md` §"Zeta's primary research claim" — the measurement obligation this document was moved out to respect; `HC-3` is the clause §2 would give a metric
- `docs/VISION.md` §"Ontology reduction is how a fleet finds its resonant frequency" — where the perspective legitimately lives, and points here
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` — the §A/§B split this argues `ALIGNMENT.md` should mirror
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register discipline; a claim in a measurable-alignment document under a disclaimer is the silent-promotion failure it names
- `docs/research/2026-09-10-abstraction-agent-elicits-variables-not-weights-and-falsifier-latency-sets-the-proposers-value.md` §4a — the turn-boundary argument this is the alignment form of
- `src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.ts` — the harmless outcome detector §2 would use
