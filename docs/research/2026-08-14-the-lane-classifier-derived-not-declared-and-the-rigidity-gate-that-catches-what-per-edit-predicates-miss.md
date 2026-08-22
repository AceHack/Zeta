# The lane classifier — derived, not declared; and the rigidity gate that catches what per-edit predicates miss

**Work-item:** `081M00TS219087G0R0016S5PMC` (minted by PR #10691, *"The lane classifier: derive edit
type from structure not declaration; unsure routes to the judgment lane"*).

**Deliverable:** `src/Core/ClaimLane.fs` + `tests/Tests.FSharp/ClaimLane.Tests.fs` (14 tests).
Design is Aaron's, from #10691 §6; it is implemented here, not re-litigated.

---

## 0. Answers up front

1. **The classifier is built and it is sound-for-Lane-1 by construction:** every predicate is a
   *reason to refuse* Lane 1. There is no predicate that admits, so an unhandled case cannot become
   an admission. Unsure ⇒ Lane 2 is structural, not a policy someone remembers to apply.
2. **It never asks about meaning.** Its input is `diff before after` — the derived structural delta
   of two parsed documents. There is no constructor an editor can hand it, so "I labelled this a
   pointer update" is not expressible.
3. **The `|Aut|` connection from PR #10733 is REAL, and not in the shape the brief proposed.** It is
   **not a per-edit trigger** — it is a **vocabulary-level precondition**, and it is the one Lane-2
   reason that fires with an *empty* diff. It **does** catch a case that every per-edit predicate
   *and* the post-hoc weight check both miss (§3). That case is executable: `D2`.
4. **The classifier can be caught being wrong.** Two source-level permissive mutations were applied
   to the shipped code and both went red (§4). The in-process harness is complete over the guard set
   with a coverage floor, so a shrunken mutant corpus fails rather than passing quietly.
5. **A live finding in the shipped claim document:** `BP-25` is written in a different format and my
   first parser **silently dropped it** — 27 of 28 entries parsed, nothing reported the 28th (§5).
   Fixed; pinned by `F3`.
6. **One correction to the brief, and it matters for anyone following the trail:** PR #10691 is
   **still open**. Its seven work-items are not on `main` (§7).

---

## 1. What was built

| piece | what it is |
|---|---|
| `parse` | the claim layer as a **parseable format**: id, normative body, structured cross-references, structured anchors, free prose |
| `diff` | the **derived** edit set — the soundness core |
| `classify` | six guards, each a reason to refuse Lane 1 |
| `classifyOmitting` | the **falsifier surface**: build a permissive classifier by removing one guard |
| `autUpperBound` / `isRigid` | the vocabulary rigidity gate |
| `lane1Merge` | Lane 1 as a **caller of `QuorumAlgebra`**, not a new subsystem |
| `lane1Anomalies` | a post-hoc falsifier on the merge itself |

**Lane 1 is a caller, and the fit is exact rather than analogical.** A claim weight is a Z-set
weight (`+1` assert, `−1` retract), so a site's edit set *is* a `QuorumAlgebra.Contribution<string>`
over claim atoms, and the two named algebras land on the two required properties:
`join` (idempotent, source-keyed) is redelivery-safety; `interfere` (has inverses) is retraction.
`BeliefConvergence.fs` says why one operator could not have done both — *"an idempotent group is
trivial… so a single operator cannot be both redelivery-safe and retraction-capable"* — so the split
is forced, not chosen. The PR shrank accordingly: no merge algebra was written here.

**The float caveat does not bite, and that is checked, not asserted.** `QuorumAlgebra`'s own header
records that `AmplitudeEmu`'s `EPS = 1e-12` drop breaks associativity structurally. Z-set weights are
small integers, exact in IEEE-754, so every partial sum is an exact integer and the drop fires at
`sum = 0` and nowhere else — which *is* the Z-set convention that zero-weight atoms are absent. The
claim-layer fragment is precisely the sub-case where the defect is inert. Pinned by `E1`.

### The one refinement to #10691 §6.4

§6.4 admits *"a pointer/citation update"* to Lane 1 while also refusing *"the prose body at all"*.
Those are consistent **only if citations are a structured field rather than free text** — otherwise
every anchor edit is also a prose edit and the admission is unreachable. Found the hard way: the
`RetractRacesEdit` mutant case failed because an anchor-only edit was also flagged `ProseTouched`.
`parse` now removes anchor URLs from `Prose`, which makes the admission both reachable and derivable.

---

## 2. The guards, and why each is decidable

| guard | question asked | decidable from |
|---|---|---|
| `Prose` | did free prose move? | byte comparison of the prose region |
| `SameIdDifferentBody` | did two sites land different bodies on one id? | byte comparison of two bodies |
| `RetractRacesEdit` | did a retraction race an edit on one id? | presence/absence in each site |
| `DependencyCheck` | is the touched claim cited by another? | the citation edge set — **Bayou's mechanism** |
| `Parseability` | did the document resolve at all? | the parse |
| `VocabularyRigidity` | are two ids structurally interchangeable? | `|Aut|` upper bound |

None asks "did the meaning change?". **The LLM-judge remains rejected** on #10691's ground — it
shares the consumer's prior, so drift *toward* that prior scores as more faithful, making it biased
toward exactly the drift it exists to catch, and green while doing it. Nothing here needs a model.

**The honest soft spot, named:** `parse` decides where the claim region ends from the document's own
syntax. It **fails safe** — a document that does not parse yields `Unparseable`, which is a Lane-2
reason. The failure mode is over-referral (latency), never admission.

### Lane 2 carries no clock, deliberately

`Verdict.Lane2` holds reasons and nothing else — no deadline, no timestamp. A dilated region is
exactly where someone reaches for a wall-clock timeout to bound the round, and a local clock that
filters which evidence reaches the shared fold makes different nodes fold different sets, so they
diverge (`.claude/rules/local-time-never-enters-the-shared-fold.md`). Dilation is measured in
**consensus rounds** — a shared logical quantity. A node may give up *locally*; its local decision
must not shrink the evidence set anyone else folds.

---

## 3. The `|Aut|` investigation — a real connection, in the wrong shape

**The question:** if the vocabulary a Lane-1 edit is expressed over has `|Aut| > 1`, does that
"residual choice" constitute a Lane-2 trigger one would otherwise miss?

**The reused theorem (PR #10733, checked):** `Aut(S) ⊆ Stab(invariants)`, so the stabilizer of a
declared invariant family is a computable **upper bound**, and **an upper bound of 1 is exact** —
the identity is always an automorphism, so `1 ≤ |Aut| ≤ 1`. Rigidity is certifiable by upper bound
alone; the expensive direction is never needed. Here the invariants are (body, prose, anchors,
out-degree, in-degree), so the bound is `∏ |class|!` over the classes they induce.

**Why it bites.** If a non-trivial automorphism exists, two claim ids are structurally
interchangeable — and then `−claim(i)` and `−claim(j)` are *indistinguishable to every per-edit
predicate*, because every predicate reads structure and the structure does not separate them.

**The forcing case** (`D2`, executable): base holds `BP-01` and `BP-02` with identical bodies and
prose. Site A retracts one; site B retracts the other. Each site believes it removed a duplicate.

| check | verdict on this case |
|---|---|
| `SameIdDifferentBody` | silent — different ids |
| `RetractRacesEdit` | silent — different ids |
| `DependencyCheck` | silent — nothing cites them |
| `Prose` | silent — no prose moved |
| `lane1Anomalies` (post-hoc weights) | **silent — every atom lands in `{0,1}`** |
| **`VocabularyRigidity`** | **fires: `|Aut| ≥ 2` (1.0 bit)** |
| result without the gate | the claim is **annihilated entirely**, converged and green |

That last row is the whole finding. The post-hoc weight check is a genuine second line of defence
for *other* misclassifications — it catches the headline same-id collision, by the base atom summing
to `−1` (`C2`, `E2`) — and it is **blind here**. So the rigidity gate is not a second spelling of
the anomaly check.

**But the shape the brief proposed is wrong, and saying so is the point.** Rigidity is a property of
the **vocabulary**, not of an **edit**. It cannot be evaluated per-edit; it gates the lane. `D3`
makes this concrete: with an *empty diff* — nothing edited at all — Lane 1 is still refused. No
per-edit predicate can do that, and no per-edit predicate should try.

**Honest limits.**

- The bound is an upper bound. Above 1 it proves nothing about the true group; **it is used only in
  the direction where it is exact** (`= 1` ⇒ rigid ⇒ admit).
- `log₂|Aut|` as a measure of *coercion* remains a **toy** and is **not promoted** here (PR #10733
  §8 declined the same promotion). Nothing in `ClaimLane` depends on that reading — only on the
  rigidity bound, which is a theorem. `impositionBits` exists for continuity of units and is
  reported, never branched on.
- This is a **different quantity** from the one #10733 measured. There it bounded the freedom in
  *translating a structure into labels* between two parties; here it bounds the freedom in *which
  atom a retraction lands on* within one vocabulary. Same construction, same theorem, different
  subject — which is exactly why the earlier finding that `|Aut|`, the Lane-2 trigger and a third
  quantity are *not one thing* still stands. **They are not one thing. They are one method.**

---

## 4. Proving the classifier fails in the direction that matters

The bar was: build both cases, then make the classifier permissive and show a test catches it.

**The two required cases.** `A1` — two sites reword the same claim id incompatibly; no assert/retract
over a shared vocabulary expresses this because the atom itself is contested → **Lane 2**. `B1` —
two sites each add a distinct fresh claim; pure monotone addition, nothing touched → **Lane 1**, and
`B2` shows the merge is order-independent (`interfere` commutes) *and* redelivery-safe (`join` is
idempotent).

**In-process mutation, complete over the guard set.** `C1` holds one minimal case per guard, asserts
the full classifier refuses it, then rebuilds the classifier with **exactly that guard removed** and
asserts it now admits. A guard whose removal changes nothing is not a guard.

> **Coverage floor.** `C1` asserts the mutant corpus is the same *set* as `allGuards`, not merely
> non-empty. Adding a guard without a mutant fails; deleting mutants fails. An empty corpus cannot
> report success.

**Source-level mutation — the demonstrated red, run against the shipped code.**

| mutation applied to `src/Core/ClaimLane.fs` | result |
|---|---|
| body comparison forced false (`when false && …`) so the id collision never fires | **RED — 2 failed** (`A1`, `C1`) |
| rigidity gate forced off (`if false && b > bigint 1`) | **RED — 3 failed** (`C1`, `D2`, `D3`) |
| reverted | **GREEN — 14/14** |

Both mutations are exactly "route the judgment case to Lane 1". Both were caught by more than one
test, including the direct behavioural test and the harness independently.

---

## 5. Live finding: the parser silently dropped a claim

The shipped `docs/AGENT-BEST-PRACTICES.md` has **28** entries. My first `parse` matched only
`- **ID** *body*` and produced **27 claims and zero unparsed regions**.

`BP-25` is written `- **BP-25: Irreducible-signal handling — …**` — id and title inside one bold
run, no italic body. It matched neither the opener nor anything else, so it **fell through and
vanished**: a claim present in the document, absent from the parse, with a clean green scan on top.

That is the exact failure class this work exists to prevent, occurring inside the instrument. Fixed:
a bullet whose bold run opens with a claim-id-shaped token and does not match the entry format is now
an explicit `Unparseable` region and reaches Lane 2 instead of disappearing.

**Two further corrections during that fix, both from measurement rather than reasoning:**

- The first discriminator was too broad — it flagged ordinary prose bullets (`- **Session-closure
  rule — …**`) because `Session-closure` is hyphenated. Tightened to an uppercase-prefix id form.
- Cross-references are now restricted to ids that **actually exist in the document**, so a
  placeholder like `BP-NN` or a report code like `RR-7506` never becomes an edge to a claim that
  is not there.

**Measured state of the shipped document (2026-08-14):** 27 parsed claims · 1 unparseable entry
(`BP-25`) · 3 cross-reference edges (`BP-17↔BP-18`, `BP-28→BP-27`) · 57 structured anchors ·
`|Aut| = 1`, i.e. **0 bits** — the vocabulary is rigid, so retraction-by-id is sound on that axis
today, and `F2` is the standing regression guard if that ever stops being true.

**Stated so it is not mistaken for a pass:** because `BP-25` does not parse, the shipped claim
document is **not fully Lane-1 eligible today**. `F3` asserts that, rather than papering over it.

---

## 6. Prior art (Beacon) — checked, not merely cited

- **Terry, D. B., Theimer, M. M., Petersen, K., Demers, A. J., Spreitzer, M. J., Hauser, C. H.
  (1995)**, *Managing Update Conflicts in Bayou, a Weakly Connected Replicated Storage System*,
  SOSP '95. **[CHECKED]** — verified that the paper's mechanism is per-write **dependency checks**
  plus client-supplied **merge procedures**, adopted because syntactic merge was unsound for
  application semantics. `dependencyCheck` is that mechanism by name. Classify-then-route is
  **known-good, not invented here**.
- **Shapiro, M., Preguiça, N., Baquero, C., Zawirski, M. (2011)**, *A Comprehensive Study of
  Convergent and Commutative Replicated Data Types*, INRIA **RR-7506**. **[CHECKED]** — authors,
  number and subject verified. Lane 1's algebra.
- **Ellis, C. A. & Gibbs, S. J. (1989)**, *Concurrency Control in Groupware Systems*, SIGMOD
  Record 18(2):**399–407** (the **dOPT** algorithm). **[CHECKED]** — **named and rejected, with
  reason.** OT transforms operations on *character positions* so concurrent edits converge to one
  string. That guarantee is the wrong one: convergence-of-characters *is* the "silently unions two
  incompatible meanings" failure, delivered deterministically and with a green light. OT would make
  the worst misclassification **invisible**. Rejected on that ground, not on complexity.
- **PR #10733** — the `Aut(S) ⊆ Stab(invariants)` upper-bound construction and the exactness-at-1
  argument, reused directly.

---

## 7. Corrections and negative findings

Per the shadow's own-errors discipline, including corrections to the brief that commissioned this.

1. **To the brief — PR #10691 is still OPEN.** Its seven work-items, including the classifier item
   `081M00TS219087G0R0016S5PMC`, are **not on `main`**; they exist only on
   `aarav/skill-seed-rigidity-study`. The brief said to "find them", which reads as though they had
   landed. I took the classifier item rather than minting a competitor, as asked, and reference it
   by id — but a reader looking on `main` will not find it. The item bodies are stubs; the design
   lives in the study doc.
2. **To the brief — the `|Aut|` connection is real but not a per-edit trigger.** It is a
   vocabulary-level precondition that fires with an empty diff (§3). Reporting it as a "Lane-2
   trigger you would otherwise miss" would be true about its *effect* and wrong about its *type*.
3. **To my own first draft — an assertion of mine was simply false.** I wrote that the permissive
   classifier's merge would complete with no anomaly on the same-id collision. It does not: the base
   atom is retracted by both sites and sums to `−1`, which `lane1Anomalies` reports. The "converged,
   wrong, and green" claim is **too strong for that case** — the weight check is a real second line
   of defence there. The case where every check truly is silent is `D2`, and that is the one that
   justifies the rigidity gate. The correction is kept visible in the test comment rather than
   quietly edited out.
4. **To my own first parser — it silently dropped `BP-25`** (§5), and then two over-broad fixes had
   to be narrowed by measurement. Recorded because a tool that reports a clean scan over an
   incomplete parse is the twelfth instrument.
5. **Refinement to #10691 §6.4** — the "pointer update" admission is unreachable unless anchors are
   a structured field separate from prose. Modelled that way; found by a failing test, not by
   reading.
6. **Not claimed:** that the classifier is *complete*. It is deliberately incomplete and over-refers
   to Lane 2. Nothing here measures how often it over-refers on real edit traffic; the eval work-item
   (`081M00TKDFM087G0R002T3KZN8`) is where that belongs.
7. **Not claimed:** that `QuorumAlgebra.interfere` is exact in general. It is exact **on the integer
   fragment used here**, which is a strictly weaker and checked claim (`E1`).

---

## 8. Register

| item | register |
|---|---|
| `Aut(S) ⊆ Stab(invariants)`; upper bound of 1 is exact | **theorem** (elementary; reused from #10733) |
| An idempotent group is trivial ⇒ two structures forced | **theorem** (quoted verbatim from `BeliefConvergence.fs`) |
| Rigidity catches a case all per-edit predicates + the weight check miss | **checked** — executable, `D2` |
| Classifier is sound-for-Lane-1 by construction | **structural** — every predicate refuses; none admits |
| Every guard is individually load-bearing | **checked** — in-process, complete over the guard set, with a floor |
| Classifier can be caught being wrong | **checked** — two source mutations, both red, then green on revert |
| Z-set fragment of `QuorumAlgebra` is exact | **checked** — `E1` |
| Bayou / CRDT / OT anchors | **checked** — verified against the sources, not inherited from the study |
| Shipped document: 27 claims, 1 unparseable, `|Aut| = 1` | **measured** 2026-08-14 |
| `log₂\|Aut\|` as *coercion* | **TOY — not promoted**, and not depended on |
| False-positive / over-referral rate on real edit traffic | **open, unmeasured** |

## Pointers

- `src/Core/ClaimLane.fs` · `tests/Tests.FSharp/ClaimLane.Tests.fs`
- `src/Core/QuorumAlgebra.fs` — `join` / `interfere`, the two algebras Lane 1 calls
- `src/Core/BeliefConvergence.fs` — the one-line theorem
- `docs/research/2026-08-14-skills-as-the-second-invariance-case-*.md` §6 — the design (PR #10691)
- `docs/research/2026-08-14-the-eve-translation-layer-computing-the-imposition-budget-*.md` — the
  `|Aut|` construction (PR #10733)
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — why `Lane2` carries no clock
