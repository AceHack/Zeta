# Adversarial: the widening/collapse chain refuted four ways, CALM's hypotheses do not apply, and DBSP's "third row" is CmRDT

> **Assignment (Aaron).** Three claims, all flagged **check me, don't confirm me**: (1) *"widening
> is a special version of the retraction −1 … a full key retraction would be the uncertainty
> collapse — this is my interpretation, make sure it's verified adversarially"*; (2) *"we preserve
> uncertainty with Bayesian inference, we never collapse, and we also have ECC to correct missed
> messages with adinkras … please verify me correct — if not, we need to work towards this"*;
> (3) CALM, and the genuinely open question — *"is DBSP's exact-delta regime a real third row, or
> coordination in disguise? I don't know this answer or even have a thesis."*
>
> **Stance: refute.** Default to refuted where uncertain. Analysis only; no implementation.
> Cut from `origin/main` at `5166929cc0670383e1c6e6f26843f6714c2e6c80`.

## The answer in eight lines

| # | Claim | Verdict | Register |
|---|---|---|---|
| **C1a** | Widening is the support-preserving restriction of `−1`; collapse = a key leaving the support | **Refuted, four independent ways.** The decisive one: the homomorphism cited as support (#14302) indexes `'K` by the **sufficient-statistic coordinate**, where *empty support **is** the flat message* — `h(One) = empty`. Under the licensing result, "a key leaves the support" means **maximum uncertainty**, the exact inverse of the intended reading (§1.1) | **refuted** |
| **C1b** | Is "collapse = key leaves support" a fourth meaning? | **It is the seventh**, and six are already in-tree with one pointing the opposite way (`SolidGround`). One fragment *is* derivable from the in-tree algebraic meaning; that fragment is the multiplicative one, and it is the half the claim gets wrong (§1.5) | **coinage-not-discovery** |
| **C1c** | Is exact zero reachable by a widening path? | **Yes, twice over, with no adversary and no zero supplied.** 324 ordinary `SoftValue.observe` steps at a 10:1 likelihood ratio delete a candidate by pure float underflow; `BeliefConvergence`'s unchecked `int64` `(*)` reaches exact zero by wraparound in **one** step, and `sharpen` reaches **negative weights** in seven (§1.3) | **refuted as implemented** |
| **C1d** | Does `MANIFESTO.md`'s never-collapse text mean this? | **There is no such text.** The manifesto's only "collapse" is about *data models under schema change*. The principle is Addison Cooper's, in `CONCEPT-REGISTRY.md`, and reads *"never **prematurely** collapsed"* — the gloss silently deletes the qualifier that makes it true (§1.4) | **ill-posed premise** |
| **C2** | Never-collapse + Bayesian + adinkra ECC, per lane | **Mixed, and the honest headline is that the value axis has no widening operator at all** — a gap already named in-tree by a prior reviewer (PR #14206) and not filed. Transport ECC is genuinely `shipped` and `metered`; the belief fold is not wired to it (§2) | `shipped` / `partial` / `aspirational`, per lane |
| **C3a** | CALM applies to our statistics | **Cited correctly in-tree already, and its hypotheses do not reach our objects.** The theorem is about *queries* over *relational transducer networks* with coordination-freeness quantified **∃-over-partitions**; a numeric fold is not that object. The applicable theorem is Shapiro et al.'s semilattice convergence, not CALM (§3.1) | **borrowed theorem, hypotheses unmet** |
| **C3b** | Is DBSP's exact-delta regime a real third row? | **No — it dissolves into an existing named row: it is an op-based CRDT (CmRDT).** Exactness buys nothing; the **abelian-group structure** does, and only for the *merge*. The coordination relocates into **unbounded dedup memory** and into the **read** — not into ordering (§3.2) | **third row does not survive** |
| **C3c** | "Unconditioned pushforward" ≡ "CRDT-mergeable" | **Refuted for CvRDT, holds for CmRDT.** Measure pushforward composes by **addition**, which is not idempotent — that is the G-Counter's *problem*, not its solution. Idempotence is the discriminator at the state-based level; monotonicity is the deeper condition only after idempotence is assumed (§3.3) | **refuted as stated**, repaired |

**One framing correction, applied throughout.** The categorical / thermodynamic / distributed /
DV2.0 agreement is written below as **recognition, not discovery**, per Aaron: *"this is one of the
primary things we keep checking are correlated, over and over, since the project started."*

---

## 1. Claim 1 — the widening/collapse chain

### 1.1 The decisive refutation: `'K` is the sufficient-statistic index, not the candidate set

The chain's stated support is PR #14302: *"the EP cavity `Gaussian.( / )` **is**
`WeightedSet.subtract`."* That result is real, measured over 20 000 pairs, and I am not
disputing it. I am disputing what it is about.

Read the construction in
`docs/research/2026-08-23-what-discretisation-costs-the-bnn-lane-and-the-natural-parameter-embedding-that-does-not-truncate.md` §2.1:

> Define `h : Gaussian → WeightedSet<NatCoord, ℝ>` over the two-element key set `{ν, τ}`, weight =
> the coordinate's value. … `h(One) = empty` holds *because* `WeightedSet` prunes `Zero` — **the
> flat message and the empty set are the same object**.

And the same section names the error it was correcting:

> **Aaron's "universal tensor" instinct was right and mis-aimed by one level.** … The error was
> putting the *sample space* in `'K`. Put the *sufficient statistic index* there and it is exact.

The chain re-commits precisely that error. "Widening reduces precision **while the key stays in
the set**" reads a key as a *surviving hypothesis*. But in the WeightedSet the homomorphism lands
in, the keys are `{ν, τ}` — two natural-parameter coordinates. A key leaving *that* support means
**τ = 0**, which is `Gaussian.One`, the uniform message, **infinite variance**.

> **So under the very theorem cited as its support, "a key leaves the support" denotes *maximum
> uncertainty*, not collapse. The chain does not merely fail to follow; it points backwards.**

The two objects both being `WeightedSet` is what makes the slip invisible:

| | `'K` = sufficient-statistic index | `'K` = candidate / sample space |
|---|---|---|
| instance | `h(Gaussian)`, `|'K| = 2`; NG4, `|'K| = 4` | `SoftValue`, `'K = CandidateKey` |
| combine | `add` (natural parameters) — **abelian group** | `scale` / pointwise `×` — **monoid, no inverse** |
| `empty` means | **uniform / flat / max uncertainty** | `None` — contradiction, no belief anywhere |
| support shrinks ⇒ | belief **widened** | belief **collapsed** |
| is `−1` available? | **yes**, total, improper messages included | **no** (§1.2) |

Same type constructor, opposite semantics for the identical event. `numerology-vs-number-theory`
is the governing rule: matching *shape* is not identification, and here the invariant that
separates the two — which set indexes `'K` — is exactly the one that flips the conclusion.

### 1.2 The group structure that makes the Gaussian safe is never used by `SoftValue`

Mechanically checkable, and it is the second independent refutation. Every `WeightedSet` call on
`SoftValue`'s path, counted at `5166929cc0`:

```
5 WeightedSet.ofSeq   2 WeightedSet.weight   2 WeightedSet.toSeq
2 WeightedSet.scale   1 WeightedSet.singleton  1 WeightedSet.isEmpty
```

`add`, `negate` and `subtract` appear **zero** times. `SoftValue` lives entirely in the
multiplicative/scaling fragment. So:

> The retraction operator that widening is supposed to be a special case of **is not on the code
> path of the layer the claim is about.** `WeightedSet.subtract` exists, is correct, and is dead
> code with respect to belief.

This is not pedantry about reachability. Multiplication over `ℝ₊` has inverses that `SoftValue`
declines to use, and multiplication over `ℤ` — `BeliefConvergence`'s carrier — **has none**
(only `±1` are units). A `−1` in the belief lane is therefore not merely unimplemented; in the
`int64` lane it is **not expressible**, because retracting evidence `e` requires dividing by its
likelihood and `(ℤ, ×)` supplies no such inverse.

### 1.3 Exact zero is reachable — twice, on ordinary paths (the anticipated refutation, confirmed)

**Float lane.** `SoftValue.build` filters `w > 0.0` (`src/Core/SoftValue.fs:72`) and
`WeightedSet.setW` prunes `Zero` again. `observe` multiplies then rebuilds. Simulating that exact
path with strictly positive likelihoods throughout:

| case | input | result |
|---|---|---|
| exact-zero likelihood | `{x:.5, y:.5}`, `l(y)=0` | `{x:1}` — one step, `y` gone forever |
| **pure underflow** | `{x:.5, y:.5}`, `l(y)=0.1`, `l(x)=1` repeatedly | **`y` leaves the support at step 324.** Last weight before deletion: `1e-323` (subnormal). **No zero was ever supplied** |
| min subnormal | `y = 5e-324`, `l(y) = 0.5` | `{x:1}` — one step |

324 ordinary observations is not an exotic regime; it is an afternoon on a Reticulum link. And
because `observe` is multiplicative and the support only ever shrinks, the deletion is
**irreversible**: no subsequent evidence can restore `y`.

**Integer lane.** `BeliefConvergence.observe` is `Array.map2 (*)` on `int64[]`. The file opens
nothing, so this is F#'s **unchecked** `(*)` — confirmed by contrast with `ZSet.fs`, which reaches
for `Checked.(-)` explicitly where it cares. Therefore:

```
2^32 * 2^32  =  0        exact zero by wraparound, no zero likelihood supplied
sharpen^7(3) =  -9204772141784466943    negative weight — not an unnormalized belief at all
```

`sharpen` is the module's own documented boundary marker for non-commutativity; it also leaves the
non-negative cone in seven steps. Note the interaction with the ensemble lane: `LyapunovContraction`
requires `isInPositiveCone` (all values ≥ 0), and unchecked `int64` `observe` can violate it
silently.

> **Verdict.** `support(fold(E ∪ {e})) ⊇ support(fold(E))` is **false as implemented**, in both
> shipped belief carriers, by rounding alone. The proposed falsifier would fail on the first run.

### 1.4 The manifesto does not say this — and the principle that does says something weaker

`docs/governance/MANIFESTO.md` contains exactly one occurrence of "collapse":

> *"We reject fragile, tightly coupled data models that collapse under change."* (line 116)

That is schema brittleness. There is **no never-collapse principle in the manifesto** to
formalise. The principle is in `docs/CONCEPT-REGISTRY.md`, attributed to **Addison Cooper,
2026-06-20**:

> *"uncertainty is held open, never **prematurely** collapsed"*

`SoftValue`'s own docstring says the same and names the exception explicitly: `resolve` /`snap` is
*"the ONE legitimate collapse"* and *"the only sanctioned exit from uncertainty space."*

The gloss — *"never-collapse ⟺ the support never shrinks"* — **deletes "prematurely" and deletes
the sanctioned exit.** It converts a threshold-gated discipline into an unconditional invariant.

> This is the failure the assignment asked to catch, and it is present: **a principle quietly
> changed meaning without anyone deciding to change it.** Strengthening a claim is still changing
> it. Honoring the anchor means keeping Addison's qualifier.

### 1.5 Which meaning of "collapse" is this? The seventh, and one points the other way

| # | lane | "collapse" means | artifact |
|---|---|---|---|
| 1 | value | resolving to a point **before the confidence threshold** | `SoftValue.resolve` / `snap` |
| 2 | ensemble | **ρ → 1** — cells correlate, diversity lost | `YinYangEnsemble.isCollapsed`, `rhoProxy`, `rhoCount` |
| 3 | society | coercion drives diversity → 1 (`D⁰` heat-death) | `Diversity`, the NCI floor ≥ 2 |
| 4 | algebraic | a **non-invertible idempotent** `P² = P` (⇒ zero divisor); = erasure = overwrite | `GLOSSARY.md` §"the idempotent knot" |
| 5 | data model | a schema that breaks under change | `MANIFESTO.md` line 116 |
| 6 | **`SolidGround`** | ground reverting **to** uncertainty — **the opposite direction** | `SEED-VOCABULARY.md`: *"monotonic — never collapse back into uncertainty"* |
| **7** | **proposed** | **a key leaving the support of a `WeightedSet`** | — |

Row 6 is the one to sit with. `SolidGround`'s non-collapse means *certainty is never lost*;
the chain's means *uncertainty is never lost*. **Opposite monotonicity directions on the same
lattice, sharing one word.**

**The honest split on row 7.** One fragment of it *is* derivable rather than coined: when a key
leaves the support via `scale`-by-`Zero` or a zero likelihood, that **is** row 4 — annihilation by
a zero divisor, non-invertible, Landauer-priced. But when a key leaves the support via
`add`/`subtract`, nothing collapsed at all: `(WeightedSet, add)` is an **abelian group**, `0` is
the identity and not an absorber, and the very next `+1` restores the key. `Map.remove` there is a
**sparse-representation choice, not an act.**

> So the proposal's derivable half is the *multiplicative* half, and the claim is stated about the
> *additive* half — where it is false. Register: **coinage-not-discovery**, and label row 7
> as a coinage in the glossary if it is kept at all.

### 1.6 The practical deliverable: which corrections genuinely require deletion

The bins the assignment asked for.

**Widenable — the weight was wrong, the hypothesis was not** (support preserved, expressible as a
natural-parameter adjustment):

- stale evidence under a non-stationary source (the PR #14206 gap — needs a forgetting factor);
- an over-confident prior;
- double-counted evidence (retract one factor);
- a peer's message re-weighted after its rank changed.

**Requires deletion — the fact was wrong, not merely uncertain:**

1. **Ill-formed candidates.** A parse that does not typecheck, a `DynamicValue` violating its
   schema. Its probability is not low, it is *undefined*; no widening expresses "this was never a
   hypothesis."
2. **Provenance revocation.** Evidence from a source later found forged. Per
   `feedback_config_secrets_topology_emerges_from_events…` revoke **≡** Z-set retract. Down-weighting
   instead of deleting leaves a Sybil able to *pay* for residual influence — the down-weighted
   path is the attack.
3. **Logical refutation.** A candidate contradicted by proof, not evidence. `P(H|E) = 0` is the
   correct posterior; widening it would **fabricate uncertainty**. The `None`-on-contradiction
   behaviour of `observe`/`combine` is right.
4. **Identity/schema change.** A key that no longer denotes (retired ZetaId, merged identity).
   Re-indexing, not belief revision.
5. **Consent withdrawal.** §6 consent-first + privacy-as-hard-money: a dweller revokes an
   observation and the datum must be *deleted*, not down-weighted.

> **Cases 3 and 5 are the ones that settle it.** A rule "the support never shrinks" would forbid
> logical refutation and forbid honoring consent withdrawal. So the property is not merely refuted
> as implemented — **it is not desirable as stated**, and a falsifier enforcing it would be a bug
> that fails on correct code.

### 1.7 What survives, and the falsifier that would discriminate

What survives is narrower and true: **in the exponential-family natural-parameter lane, widening
is exactly a partial EP cavity, and the group structure guarantees it is reversible.** That is
`Gaussian.( / )`, it is shipped, and improper messages (`τ ≤ 0`) are correctly tolerated per
Minka 2001. Stated there, the claim needs no support-monotonicity property at all — **the group
axioms already give it**, which is why the Gaussian lane never had this problem.

The proposed falsifier `support(fold(E ∪ {e})) ⊇ support(fold(E))` **does discriminate** — it goes
red immediately (§1.3) — but it is testing the wrong property. The property worth pinning, if the
value axis ever gets a widening operator:

> **`observe` never removes a candidate except through an explicitly-supplied zero likelihood.**
> Underflow-to-deletion is a distinct, nameable defect; a `MIN_WEIGHT` floor (or log-domain
> weights) is the repair, and the floor makes the deletion *decidable* instead of *incidental*.

---

## 2. Claim 2 — per-lane register

### 2.1 Does `BeliefConvergence` never collapse?

**No — `partial`, and the retained object is a lossy summary.** `observeAll` folds to an
`int64[]`: the *product* of likelihoods. The evidence set is unrecoverable from it. It **is** an
exact sufficient statistic for the posterior under fixed likelihoods (which is the real content of
the order-independence result and is `shipped`), but a sufficient statistic for the *posterior* is
not the evidence set, and the difference is exactly what retraction needs. Combined with §1.3's
wraparound-to-zero, "never collapses" is **refuted** for this module.

### 2.2 Is a `−1` removal, or more evidence?

Aaron's prior — belief lane monotone, Z-set lane not — is **half right**, and the interesting half
is the other one.

| lane | `−1` is | register |
|---|---|---|
| `BeliefConvergence` (`int64`, `×`) | **neither — it does not exist.** No multiplicative inverse in `ℤ` | **aspirational** |
| `SoftValue` (`float`, `×` + prune) | **neither.** Inverses exist in `ℝ₊` and are never used (§1.2); `build` prunes | **aspirational** |
| `ZSet` | **removal.** `a + (−a) = Zero`, pruned. `ZSet.fs`'s own note — *"correction, not a duplicate-guard"* — is exactly right | **shipped** |
| `Gaussian` / EP | **removal in natural coordinates**, total, improper results tolerated. **The only lane where widening-as-partial-retraction is literally implemented** | **shipped** |
| transport | `retractLoss` withdraws a **loss report** with `cause: "reorder"` | **shipped, different object** |

The belief lane is not "monotone"; it is **inverse-free**, which is a stronger and worse property.
Monotone would at least be CALM-clean.

### 2.3 Do the adinkra/ECC claims hold operationally?

**`shipped` at the transport layer; `partial` overall; and one half is `ill-posed`.**

What is genuinely built, and it is better than the claim: `src/Core.TypeScript/discovery/udp-lossy-transport.ts`
implements the [8,4,4] Adinkra code as an **erasure code over UDP** — 4 data + 4 parity per block,
recovering **any 3 erasures**, with CRC-32C so corruption degrades to erasure. It is `metered`, not
merely implemented: goodput measured across 0–40 % loss on both i.i.d. and anti-correlated channels,
with a **stated crossover at ~18–19 %** below which the rate-7/8 XOR code wins outright. That file
withdraws its own earlier guidance on measurement. It is a model of the discipline.

Three corrections to the claim as stated:

1. **Not wired to the belief fold.** It recovers *packets*. `BeliefConvergence.observeAll` has no
   consumer relationship with it. ECC restores the evidence *set*, which is the right service — the
   wire is simply absent.
2. **"ECC to handle out-of-order `−1`s" is a category error.** Erasure codes correct **erasures**,
   not **permutations**. Reordering is handled by `observe`'s commutativity — an entirely different
   mechanism — and by the transport's sequence-number window plus `retractLoss`. Both exist; neither
   is the ECC. Register: **ill-posed**, repaired by naming the two mechanisms separately.
3. **The composition is unsafe today, and both sides say so.** The transport's delivered-once guard
   is *"a WINDOW, not a promise … a duplicate separated from its original by more than
   `DELIVERED_BLOCK_CAP` further deliveries is delivered twice, and no bounded receiver can say
   otherwise"* (measured: 112 duplicate payloads / 400 blocks at reorder depth 64). And `observeAll`
   is **not idempotent** and states that dedup *"must be supplied by the caller."* Duplicate
   delivery meets a double-counting fold. Neither component is wrong; **the seam is empty.**

### 2.4 Decode commutativity from any sufficient subset

**`partial`, with an exception set the code already states honestly.** For an MDS code, decoding
from any `k` of `n` symbols gives the same codeword, so the result is independent of *which* subset
survived — a genuine selection-independence. But the [8,4,4] code is **not MDS**: the file records
that 56 of the 70 four-erasure patterns recover and **14 do not — exactly the weight-4 codeword
supports**. So "any sufficient subset" holds at ≤ 3 erasures and fails at 4. And the fold does not
consume it either way (§2.3.1), so decode commutativity is currently a property of a transport with
no belief-layer consumer.

### 2.5 The rule interaction — and it is the finding, not a footnote

`.claude/rules/local-time-never-enters-the-shared-fold.md` requires the shared fold to see *"the
evidence set, phase-ordered."* `observeAll`'s docstring restates the invariant verbatim. So rule
and claim **are the same commitment stated twice** — and:

> **Both are currently unenforced.** Nothing in the repo checks that the list handed to `observeAll`
> is deduplicated or phase-ordered; there is no dedup-key type, no guard, and the docstring says the
> key *"must be supplied by the caller"* while no caller supplies one. The rule is `aspirational`
> in the sense that matters: **it is stated, it is correct, and nothing would notice its violation.**

This is a `vacuous-claims-are-THE-obstacle` instance: an invariant documented at the call site with
no mechanism, which reads as a guarantee and carries none.

---

## 3. Claim 3 — CALM, and whether DBSP is a third row

### 3.1 CALM is a borrowed theorem, already correctly cited, and its hypotheses do not reach us

Not re-proved. The citation-check obligation is **already discharged in-tree**, with the scope
attached, at `docs/PRIOR-ART-LIST.md`:

> Conjecture: **Hellerstein, SIGMOD Record 39(1):5 (2010)**. Proof: **Ameloot, Neven & Van den
> Bussche, JACM 60(2):15 (2013)** — Cor. 13: coordination-free ⟺ oblivious ⟺ monotone, for
> *queries* over *relational transducer networks*, where coordination-freeness is
> **∃-over-partitions** … **Model-relativity: Ameloot, Ketsman, Neven & Zinn, TODS 40(4):21 (2015)**
> — more network knowledge yields *different* monotonicity classes, **so CALM is not an
> unconditional law.**

And `docs/research/2026-08-17-path-independence-is-four-properties-…` already **refuted** a broader
CALM identification and recorded the shared proof *schema* as a generator, not a conclusion.

**The entailment check, which is the part still owed.** Do the hypotheses hold for our statistics?

| CALM hypothesis | our object | holds? |
|---|---|---|
| the program is a **query** (a relational transducer network) | `BeliefConvergence.observeAll` is a numeric fold; `SoftValue.observe` a pointwise Bayesian conditioning | **no** |
| coordination-freeness is **∃-over-partitions** (an *ideal* data distribution may be chosen) | our replicas do not get to choose their partition; the network hands it to them | **no** |
| **obliviousness** — the transducer does not consult `Id` / `All` | `YinYangEnsemble` consults cell identity (`reseedLeastExperienced`) and ensemble size (`rhoProxy`, `rhoStar(N)`) | **no** |

> **Verdict.** CALM is **cited correctly and does not apply directly.** It is a borrowed theorem
> whose hypotheses our objects do not meet, and the model-relativity result says that gap cannot be
> waved away. What *does* apply to our merges is **Shapiro, Preguiça, Baquero & Zawirski**'s
> convergence theorem for state-based CRDTs (a join-semilattice with monotone updates converges),
> and that is the theorem to reach for. Using CALM as the anchor for a *fold* is anchoring to a real
> paper for a claim it does not prove — the failure mode `anchor-to-human-prior-art` names.

### 3.2 The open question: DBSP's exact-delta regime — the third row does not survive

The proposed third row: monotone/CRDT (coordination-free) · consensus (coordinating) · **DBSP
(non-monotone but exact)**. My verdict is that the third row **dissolves into an existing named
row**, and the interesting content is *where* the coordination went.

**Step 1 — exactness is not the operative property.** Z-sets form an **abelian group**
(`ZSet.(~-)`: `a + (−a) = Zero`). Delta folding is group addition: commutative, associative,
invertible. The fold `Σ` over a *multiset* of deltas is a monoid homomorphism from the free
commutative monoid on deltas into that group. **That homomorphism is what buys order-independence**
— not exactness. An *approximate* delta with the same algebra would be equally order-free; an exact
delta with a non-commutative combine would not be. Exactness is about fidelity, not coordination.

**Step 2 — this is precisely the op-based CRDT (CmRDT), which Shapiro et al. already named.**

| | CvRDT (state-based) | **CmRDT (op-based)** | delta-CRDT |
|---|---|---|---|
| combine | **join** — assoc, comm, **idempotent** | **apply op** — assoc, comm, **not idempotent** | delta-mutator, merged by **join** |
| delivery needed | at-least-once, any order | **exactly-once**, causal | at-least-once, any order |
| **DBSP Z-set deltas** | no — `+` is not idempotent | **yes — this is the row** | **no** — merge is `+`, not `⊔` |

> DBSP is a **CmRDT**. Its "non-monotone but exact" character is the ordinary op-based profile, and
> its price — **exactly-once delivery** — is the ordinary op-based price, documented since 2011.
> Not a third row: a well-populated second one.

This also settles the narrower sub-question. **Baquero & Almeida's delta-CRDTs are the middle row
done right** — they ship *small* deltas (op-like efficiency) but merge by **join** (state-like
idempotence), so they need no exactly-once guarantee. DBSP's Z-sets are **not** delta-CRDTs, and the
single distinguishing bit is that Z-set delta merge is `+` rather than `⊔`. That is a crisp,
checkable difference, not a matter of degree.

**Step 3 — so where did the coordination go? Two places, and neither is ordering.**

The framing asked whether exactness buys coordination-freedom or merely relocates the coordination
into delivery guarantees. The answer is **relocates, but not into ordering**:

- **Not into ordering.** Addition commutes, so arrival order is genuinely free. This half of the
  intuition is right and is the same fact as `local-time-never-enters-the-shared-fold`.
- **Into unbounded memory.** "Exactly-once delivery" is not irreducible coordination: give each
  delta a unique id, keep a **G-Set of seen ids** — monotone, CALM-clean, coordination-free — and sum
  the deltas whose ids are in it. At-least-once delivery then suffices. So the coordination is fully
  discharged into a **grow-only set that grows without bound**. *Coordination is traded for memory,
  not eliminated.* And a bounded receiver breaks it — which is exactly what
  `udp-lossy-transport.ts` measured and stated in the open: the delivered-once guard *"is a WINDOW,
  not a promise … no bounded receiver can say otherwise."* The theory's escape hatch and the
  transport's measured limitation are **the same object**, arrived at from opposite ends.
- **Into the read.** Coordination-freedom here covers the *merge*, never the *read*. A value read at
  time `t` may be invalidated by a later retraction; a **stable** read — one that will not be
  retracted — requires knowing no further deltas are coming, which is distributed termination
  detection. This is exactly the hazard already cited in-tree: **Laddad et al., "Keep CALM and CRDT
  On," PVLDB 16(4):856 (2023) — CRDT guarantees cover merges, not reads.**

> **Answer to the open question.** The exact-delta regime is **coordination-free on the merge and
> coordinated on the read**, and its delivery requirement is convertible into an **unbounded monotone
> dedup set**. So: not a third row, and the coordination is relocated into *memory* and *read
> stability* rather than into *ordering*. The bounded-memory version — the only implementable one —
> is where the guarantee actually leaks, and the repo has already measured that leak on a different
> lane without connecting it to this question.

### 3.3 "Unconditioned pushforward" ≡ "CRDT-mergeable"?

**Refuted as stated; repaired it becomes precise.** Measures push forward along any map with no
hypothesis (`q_*μ(c) = μ(q⁻¹(c))`); functions need constancy on fibres — established in
`…geometry-as-the-root-of-the-soft-regime…-lumen.md` §10.1. So "unconditioned pushforward" ≈ "the
quantity is **extensive** (measure-like)".

Extensive quantities combine by **addition**. Addition is associative and commutative and **not
idempotent** — `μ + μ ≠ μ`. A CvRDT requires a **join-semilattice**, i.e. idempotence. Therefore:

> **Unconditioned pushforward ⇏ CvRDT-mergeable.** It gives a commutative *monoid*, not a
> semilattice — which is the G-Counter's *problem*, and precisely why the G-Counter is built from
> **per-replica max** rather than a sum. Aaron's idempotence candidate is the right discriminator
> at the state-based level.
>
> **Unconditioned pushforward ≈ CmRDT-mergeable** — commutative operations plus exactly-once
> delivery — is the true statement, and it closes the loop with §3.2: measure-additivity and DBSP's
> Z-set deltas are the same row for the same reason.

On "monotonicity is the deeper condition": it is deeper only *after* idempotence is assumed.
Idempotence is what makes a merge a **join**; monotonicity of the update is then what makes the join
converge to something meaningful. They are two conditions, not a shallow and a deep version of one,
and they fail independently: `SoftValue.observe` is neither, `ZSet.(+)` is monotone in no useful
order and not idempotent, `GSet.union` is both.

### 3.4 The four-way agreement, as recognition

Written per Aaron's correction, and not triaged as a fresh resonance:

> The categorical (free module / monoid homomorphism), thermodynamic (Landauer, the idempotent
> knot), distributed (CRDT / CALM), and DV2.0 (change-rate partition) readings keep agreeing because
> **Zeta has been one distributed consensus algorithm that gracefully degrades to slower operations
> along a trust gradient since its conception.** The agreement is the design being checked from four
> sides, not four independent confirmations of a hypothesis. Under
> `numerology-vs-number-theory` §"too many correlations is a warning": the correct reading of
> density here is *one observation seen four ways*, and it is recorded as such — load-bearing for
> nothing on its own.

---

## 4. Registered verdicts

| id | claim | verdict | register |
|---|---|---|---|
| NC-1 | Widening is the support-preserving restriction of `−1` | `'K` conflated: sufficient-statistic index vs sample space; empty support = **uniform** under the citing homomorphism | **refuted** |
| NC-2 | `SoftValue` inherits `WeightedSet`'s group structure | `add`/`negate`/`subtract` called **zero** times on its path | **refuted as implemented** |
| NC-3 | Exact zero unreachable by a widening path | 324-step float underflow; one-step `int64` wraparound; `sharpen` leaves the positive cone in 7 | **refuted as implemented** |
| NC-4 | `MANIFESTO.md` states never-collapse | It does not; the principle is Addison Cooper's and says *"prematurely"* | **ill-posed premise** |
| NC-5 | Collapse-as-support-loss is a new discovery | Seventh in-tree meaning; the derivable fragment is multiplicative, the claim is additive | **coinage-not-discovery** |
| NC-6 | `support(fold(E ∪ {e})) ⊇ support(fold(E))` is the right falsifier | It discriminates (goes red) but pins an **undesirable** property — forbids logical refutation and consent withdrawal | **refuted as a design goal** |
| NC-7 | Widening is a partial EP cavity in natural coordinates | True, shipped, reversible by the group axioms | **shipped** (the surviving form) |
| BC-1 | `BeliefConvergence` never collapses | Lossy summary (product); zero reachable by wraparound | **refuted** |
| BC-2 | `observe` is order-independent for fixed likelihoods | Commutative + associative pointwise `×` | **shipped** |
| BC-3 | A `−1` exists in the belief lane | No inverse in `(ℤ, ×)`; unused in `(ℝ₊, ×)` | **aspirational** |
| BC-4 | ECC corrects missed messages | [8,4,4] erasure code over UDP, goodput measured 0–40 % loss, crossover stated | **shipped + metered** (transport only) |
| BC-5 | That ECC serves the belief fold | No consumer relationship exists | **aspirational** |
| BC-6 | ECC handles out-of-order `−1`s | Erasure ≠ permutation; reordering is handled by commutativity + sequence window | **ill-posed** |
| BC-7 | Decode from any sufficient subset | Holds ≤ 3 erasures; **14 of 70** four-erasure patterns fail ([8,4,4] is not MDS) | **partial** |
| BC-8 | `local-time-never-enters-the-shared-fold` is enforced | Stated at the call site; no dedup key, no guard, no checker | **aspirational** |
| CA-1 | CALM applies to our statistics | Three hypotheses unmet (query / ∃-over-partitions / oblivious); model-relative | **borrowed theorem, hypotheses unmet** |
| CA-2 | DBSP is a third row | It is CmRDT; exactness is not the operative property | **refuted** |
| CA-3 | Exactness buys coordination-freedom | Relocates it into **unbounded dedup memory** and into the **read** — not into ordering | **theorem (constructive), conjecture on the bound** |
| CA-4 | Unconditioned pushforward ≡ CRDT-mergeable | Refuted for CvRDT (addition is not idempotent); holds for CmRDT | **refuted as stated**, repaired |

### What would settle the two remaining conjectures

- **CA-3's bound.** Conjecture: *no bounded-memory receiver can implement exactly-once delivery over
  an adversarial-reorder channel.* Refutation would be a bounded-state protocol; a proof is an
  adversary argument on receiver state. This is a **TLA+** obligation — a liveness/safety property
  over an unbounded-reorder channel model, which is exactly what TLC is for.
  Filed: `081M0R7TCRP087G0R0010JHRX0`.
- **NC-7's scope.** Conjecture: *in the conjugate exponential-family lane, every widening is a
  partial cavity and is exactly reversible.* Provable from the group axioms plus conjugacy; the work
  is stating the family conditions. **Lean 4** — an algebraic statement with no search.
  Filed: `081M0R7TMPX087G0R0008SGFZH`.

### Routing to `formal-verification-expert` (Soraya)

| item | tool | why |
|---|---|---|
| CA-3 bounded-receiver impossibility | **TLA+ / TLC** | temporal safety+liveness over a reorder channel; state-space model checking is the native fit |
| NC-3 underflow falsifier | **FsCheck** (property test), not a prover | it is a *measurement* of the shipped float path; a property test with a shrinker names the step count |
| NC-7 cavity reversibility | **Lean 4** | algebraic identity over an exponential family; no arithmetic search |
| BC-8 dedup obligation | **Z3** | discharge "duplicate ⇒ posterior differs by exactly one likelihood factor" as an SMT identity, making the omission visible |

**Not routed:** NC-1, NC-2, NC-4, NC-5, BC-6 are refuted by reading the tree, not by proof. Sending a
refuted claim to a prover manufactures a proof obligation for something already settled.

## 5. Anchors

- **Minka, T.**, *Expectation Propagation for Approximate Bayesian Inference*, UAI 2001 — the cavity
  as division in natural parameters; improper messages are expected, not errors.
- **Shapiro, M., Preguiça, N., Baquero, C. & Zawirski, M.**, *Conflict-Free Replicated Data Types*,
  INRIA RR-7506 / SSS 2011 — CvRDT semilattice convergence; CvRDT ⇄ CmRDT inter-emulability. **The
  theorem that actually applies to our merges.**
- **Baquero, C., Almeida, P. S. & Shoker, A.**, *Making Operation-Based CRDTs Operation-Based* /
  delta-state CRDTs (2014, 2018) — the middle row done right; join-merged deltas need no
  exactly-once.
- **Hellerstein, J.**, *The Declarative Imperative*, SIGMOD Record 39(1):5 (2010) — CALM as
  conjecture.
- **Ameloot, T., Neven, F. & Van den Bussche, J.**, *Relational Transducers for Declarative
  Networking*, JACM 60(2):15 (2013) — the proof, Cor. 13, **with the ∃-over-partitions and oblivious
  hypotheses that §3.1 checks and finds unmet.**
- **Ameloot, Ketsman, Neven & Zinn**, TODS 40(4):21 (2015) — model-relativity; CALM is not
  unconditional.
- **Laddad, Power, Milano, Cheung, Crooks & Hellerstein**, *Keep CALM and CRDT On*, PVLDB 16(4):856
  (2023) — **merges, not reads**; §3.2's third relocation.
- **Budiu, M., McSherry, F., Ryzhyk, L. & Tannen, V.**, *DBSP: Automatic Incremental View
  Maintenance for Rich Query Languages*, VLDB 2023 — Z-sets as an abelian group.
- **Landauer, R.** (1961) / **Bennett, C.** (1973, 1982) — the price of the non-invertible step; the
  in-tree "idempotent knot" reading of collapse (row 4, §1.5).
- **Addison Cooper**, 2026-06-20, `docs/CONCEPT-REGISTRY.md` — *"uncertainty is held open, never
  **prematurely** collapsed."* The principle §1.4 restores the qualifier to.
- **In-tree prior work this stands on, not beside:** the PR #14206 reviewer who named the missing
  widening operator on the value axis; PR #14302's measured monoid homomorphism (whose `'K`
  discipline §1.1 applies); `2026-08-17-path-independence-is-four-properties-…` for the prior CALM
  refutation; `udp-lossy-transport.ts` for the measured goodput tables and the honest
  window-not-a-promise admission that §3.2 borrows.
