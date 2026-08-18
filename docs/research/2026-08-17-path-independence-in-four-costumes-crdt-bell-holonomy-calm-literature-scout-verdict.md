# Path-independence in four costumes — CRDT · Bell/CHSH · holonomy · CALM: the literature-scout verdict

**Date:** 2026-08-17 · **Work-item:** `081M090Y71Y087G0R001JE2S54` · **Register:** Beacon
**Role:** literature scout (prior-art lens), run in parallel with a refuter (internal-attack lens).
**Question (Aaron 2026-08-17):** is the convergence real, or one fact wearing several costumes?

---

## 0. Verdict

**PARTIALLY KNOWN — and the part that is known is stronger and older than the claim made in
conversation, while the part that is novel is novel because it is *false as a biconditional*.**

Three of the four legs are bridged in print, by named humans, with theorems:

| bridge | status | who |
|---|---|---|
| (a) relational/merge structure ↔ (b) Bell locality | **KNOWN, exact, published** | **Abramsky 2013**; **Fine 1982**; **Vorob'ev 1962** ↔ **Beeri–Fagin–Maier–Yannakakis 1983** via **Barbosa** |
| (b) Bell locality ↔ (c) zero holonomy / flatness | **KNOWN, published** | **Abramsky–Mansfield–Barbosa 2012** (Čech cohomology); **Montanhano 2021/24** (holonomy, explicitly) |
| (b) Bell violation ↔ (d) coordination *cost* | **KNOWN, quantitative, published** | **Pironio 2003**; **Toner–Bacon 2003**; **van Dam 2005**; **Brassard et al. 2006**; **Arfaoui–Fraigniaud 2012/14** |
| **(d) CALM's coordination-freedom ⟺ local-polytope membership** | **not found in print — and the ⟸ direction is FALSE** | — |

So the convergence is not one fact in four costumes. It is **one fact (a↔b↔c) in three costumes,
already named "contextuality" by Abramsky's school**, plus **a fourth leg (CALM) that is genuinely a
different quantifier and does not close the loop.** The honest reading: Aaron's coincidence-index
fired correctly on three of four, and the fourth is where the over-correction would have happened.

The strong conversational claim — *"a coordination-free (monotone/CRDT) computation IS a local hidden
variable model, so coordination-free ⟺ inside the local polytope"* — splits:

- **⟹ is TRUE and trivial.** True because a replica that emits its output as a function of (its own
  local input, the shared state delivered to it) with no post-input messages is *literally* Bell's
  1964 factorisation `p(a,b|x,y) = ∫dλ ρ(λ) p(a|x,λ) p(b|y,λ)` with `λ =` the shared state. It is
  trivial because that is not a fact about CRDTs — it is the *definition* of the local polytope,
  which is exactly "all classical strategies with shared randomness and no communication after the
  settings arrive." Every coordination-free classical protocol lands inside it, along with every
  other classical no-communication protocol. Nothing is learned by the inclusion alone.
- **⟸ is FALSE.** The local polytope is strictly larger than the coordination-free class. Counter-
  example, minimal and checkable: the query *"is `x` **absent** from the replicated set?"* is
  **non-monotone**, so CALM says it needs coordination. But as a behaviour it factorises perfectly
  — each replica answers from its own delivered `λ` with zero communication, so the induced
  distribution sits **inside** the local polytope and violates no Bell inequality. Locality is a
  constraint on *where information came from*; monotonicity is a constraint on *what survives the
  arrival of more information*. They are different properties, and the non-monotone-but-local query
  separates them.

That single counter-example is the load-bearing result of this scout run. The biconditional is not
merely unproved; it is refuted by a one-line instance.

Two further quantifier mismatches, each fatal to "IS" on its own:

1. **CALM's coordination-freedom is ∃-over-partitions; Bell locality is ∀-over-settings.** Verbatim
   from Ameloot–Neven–Van den Bussche: *"Π is coordination-free on 𝒩 if for every instance I of
   𝒮_in, **there exists** a horizontal partition H of I on 𝒩 and a run ρ of (𝒩,Π) on H, in which a
   quiescence point is already reached by only performing heartbeat transitions."* An **ideal
   distribution is allowed to be chosen for you**. Bell grants no such choice — the inequality must
   hold for *every* setting pair. A property that gets to pick its favourable input distribution and
   a property that must survive an adversarial one are not the same property.
2. **Bell requires measurement independence (free choice): λ must be statistically independent of the
   settings.** In a replicated database the "setting" — which query a replica runs — is routinely
   causally *downstream* of the state. Drop free choice and the Bell bound evaporates (this is the
   superdeterminism loophole, already on file in-repo at
   `docs/research/2026-06-08-what-distinguishes-quantum-from-superdeterminism-*`). So the analogy
   silently imports an assumption that is usually **false** in the systems half.

**Register discipline:** state it as *"coordination-free computations lie inside the local polytope"*
(true, trivial, a containment), never *"coordination-free ⟺ local"* (false). Per
`numerology-vs-number-theory.md`: four things sharing the shape "order doesn't matter" is a **count**,
not an identification; the invariants that separate them are given above.

---

## 1. The known bridge, and why it is better than the one we reached for

### 1.1 Abramsky 2013 — relational databases **are** Bell scenarios (checked, not merely cited)

**Samson Abramsky, "Relational Databases and Bell's Theorem"**, in *In Search of Elegance in the
Theory and Practice of Computation* (Festschrift for Peter Buneman), LNCS 8000, Springer, 2013,
pp. 13–35. arXiv:1208.6416.

I read the paper, not the abstract. Its correspondence table, verbatim from §7:

| Relational databases | measurement scenarios |
|---|---|
| attribute | measurement |
| set of attributes defining a relation table | compatible set of measurements |
| database schema | measurement cover |
| tuple | local section (joint outcome) |
| relation/set of tuples | boolean distribution on joint outcomes |
| **universal relation instance** | **global section / hidden variable model** |
| **acyclicity** | **Vorob'ev condition** |

The entailment holds: Abramsky proves the claim he is cited for. The presheaf
`R = P ∘ T : Att^op → Set` sends attribute sets to relations, restriction to projection; a schema is
a **cover**; an instance is a **compatible family**; and — *Proposition 2.2* — *"An instance
(R₁,…,R_k) satisfies the gluing condition if and only if there is a universal relation R for the
instance."* Bell's theorem is then the statement that **`R` is not a sheaf**: quantum empirical models
exist with no global section. *Proposition 5.3*: a probabilistic LHV model implies its support table
has a universal relation, so **failure of a universal relation implies failure of LHV** (the converse
is false — the Bell table's *support* does glue; only the probabilities obstruct).

Two dividends we do not get from the CRDT framing:

- **The obstruction is graded, not binary.** Abramsky establishes the strict hierarchy
  **Bell < Hardy < GHZ** (probabilistic obstruction < possibilistic obstruction < strong
  contextuality: *Prop. 6.1*, GHZ models of type (n,2,2) are strongly contextual for all n ≥ 3).
  "Path-dependent" is not one bit; there are at least three strengths of failure-to-glue.
- **There is a structural criterion for when gluing always works.** **Vorob'ev (1962)** —
  *"Consistent families of measures and their extensions,"* Theory Probab. Appl. 7:147 — gives
  necessary and sufficient combinatorial conditions on the cover for *every* compatible family to
  extend. **Rui Soares Barbosa showed the Vorob'ev condition is exactly database acyclicity** in the
  sense of **Beeri, Fagin, Maier & Yannakakis, "On the desirability of acyclic database schemes,"
  JACM 30(3):479–513, 1983** (credited as personal communication in Abramsky 2013 §7; developed in
  Barbosa's Oxford work, e.g. arXiv:1412.8541 and his QCQMB 2019 talk *Acyclicity and Vorobev's
  theorem*). Frontier continuation: **Kolaitis et al., "Consistency of Relations over Monoids,"
  JACM 2025** (arXiv:2312.02023) and *"Consistency, Acyclicity, and Positive Semirings"*
  (arXiv:2009.09488) — the unifying framework Barbosa's question asked for.

That last row is the operationally valuable one and it is *not* what our conversation was reaching
for. It says: **whether local agreement forces global agreement is a property of the SHAPE OF THE
COVER (acyclic ⟹ always gluable), not of the merge operator.** For Zeta that is a design rule about
how we carve schemas and shard boundaries, and it is a theorem, not an analogy.

Related, same author, worth pulling: Abramsky & Brandenburger, *"The sheaf-theoretic structure of
non-locality and contextuality,"* **New J. Phys. 13:113036 (2011)** — the framework; Abramsky,
*"Relational Hidden Variables and Non-Locality,"* **Studia Logica 101(2):411–452 (2013)** — the
probability-free version; Abramsky, Gottlob & Kolaitis, *"Robust constraint satisfaction and local
hidden variables in quantum mechanics,"* **IJCAI 2013** — the complexity dividend.

Complexity anchors that come free: deciding the join-consistency property is **NP-complete**
(**Honeyman, Ladner & Yannakakis, IPL 10(1):14–19, 1980**), and deciding membership in the
correlation polytope is **NP-complete** (**Pitowsky**, below). Those are the *same* hardness, which
is itself a check on the correspondence rather than a coincidence.

### 1.2 Fine 1982 — the theorem the "shared state as λ" claim actually needs

**Arthur Fine, "Hidden Variables, Joint Probability, and the Bell Inequalities," Phys. Rev. Lett.
48:291–295 (1982).** The equivalence: *a deterministic hidden-variable model exists* ⟺ *a factorisable
stochastic model exists* ⟺ *a single joint distribution for all observables exists returning the
experimental marginals* ⟺ *the Bell inequalities hold*. Fine also establishes that in the (2,2,2)
scenario **CHSH is the complete set** — the eight CHSH inequalities are necessary and sufficient.

This is the correct anchor for "shared state as λ": the content is not "λ exists" (λ always exists in
a classical system, trivially) but "**a single global joint distribution exists**," i.e. the global
section. Citing Bell 1964 for the shared-state claim is weaker than citing Fine 1982, because Bell
gives you the inequality and Fine gives you the *equivalence*.

### 1.3 The local polytope and the LP dual — the conversational claim is right, with two caveats

The asserted "local polytope membership is an LP and the dual yields the maximally-violated Bell
expression" **checks out**, with a precise pedigree:

- **Itamar Pitowsky**, *Quantum Probability — Quantum Logic*, Lecture Notes in Physics 321, Springer
  (1989); and *"Correlation polytopes: their geometry and complexity,"* **Math. Programming
  50:395–414 (1991)**. Local behaviours form a **polytope** whose vertices are the deterministic
  local strategies; a behaviour is local iff it is in the convex hull. Membership is **NP-complete**;
  facet enumeration is worse (probably not in NP). By LP duality / the separating-hyperplane theorem,
  a non-member yields a hyperplane separating it from the polytope — and a hyperplane separating the
  local set **is** a Bell inequality; facet-defining hyperplanes are the tight ones.
- **Caveat 1 (normalisation).** "*The* maximally-violated Bell expression" is only well-defined
  relative to a fixed normalisation of the Bell functional; the dual optimum is maximal in the
  chosen norm, and a degenerate optimum need not be a facet.
- **Caveat 2 (this is where Pironio matters).** The sharpened, operational form of "the dual gives you
  the right inequality" is **S. Pironio, "Violations of Bell inequalities as lower bounds on the
  communication cost of nonlocal correlations," Phys. Rev. A 68:062102 (2003)** (quant-ph/0304176):
  *"for every probability distribution there exists an optimal inequality for which the degree of
  violation gives the minimal average communication."* And the worked number: reproducing the maximal
  CHSH violation classically costs **√2 − 1 ≈ 0.4142 bits** — necessary *and* sufficient.

Standard review to cite instead of re-deriving: **Brunner, Cavalcanti, Pironio, Scarani & Wehner,
"Bell nonlocality," Rev. Mod. Phys. 86:419 (2014)** (arXiv:1303.2849).

### 1.4 Bell ↔ holonomy is published — leg (c) is not ours either

- **Abramsky, Mansfield & Barbosa, "The cohomology of non-locality and contextuality,"** QPL 2011,
  EPTCS 95:1–15 (2012); and **Abramsky, Barbosa, Kishida, Lal & Mansfield, "Contextuality, Cohomology
  and Paradox," CSL 2015**, LIPIcs 41:211–228. The obstruction to a global section is a **Čech
  cohomology class**. That is precisely the "curvature is the obstruction to path-independent
  transport" statement, in the discrete setting.
- **Sidiney B. Montanhano, "Contextuality in the Bundle Approach, n-Contextuality, and the Role of
  Holonomy,"** arXiv:2105.14132 (2021, rev. 2024) — states it in so many words: contextuality relates
  to **non-triviality of the holonomy group** of the frame bundle over the measurement scenario, and
  builds an n-contextuality hierarchy indexed by the topology of the scenario's simplicial complex.
- **"The Gauge-Theoretic Structure of Non-Locality and Contextuality"** (Sahil, BCAM) — same programme.

Classical anchors for the geometry half, which the above are the quantum specialisation of:
**W. Ambrose & I. M. Singer, "A theorem on holonomy," Trans. AMS 75:428–443 (1953)** (holonomy is
generated by curvature); **Kobayashi & Nomizu, *Foundations of Differential Geometry* (1963)** (flat
⟺ trivial holonomy on a simply connected base — note the **simply connected** hypothesis: flatness
gives *local* path-independence; global path-independence additionally needs `π₁` to vanish, which
is the topological content the cohomological treatments above make precise).

### 1.5 Nonlocality ↔ communication/coordination cost — the real (b)↔(d) bridge, and the attributions

This is the leg the conversation gestured at, and it is well developed — but **as a cost gradient,
not as a biconditional**:

- **Wim van Dam, "Implausible consequences of superstrong nonlocality,"** quant-ph/0501159 (2005),
  published **Natural Computing 12(1):9–12 (2013)**; the result also appears in his 2000 Oxford
  thesis. **What he actually proves:** *perfect* PR boxes make communication complexity **trivial** —
  every distributed Boolean function computable with **one bit**. He does **not** prove a noisy
  threshold. Attributing "the threshold" to van Dam is a mis-citation.
- **Brassard, Buhrman, Linden, Méthot, Tapp & Unger, "Limit on nonlocality in any world in which
  communication complexity is not trivial," Phys. Rev. Lett. 96:250401 (2006)** (quant-ph/0508042).
  **What they actually prove:** *noisy* isotropic PR boxes with success probability **p > ≈0.908**
  already collapse communication complexity. **The "≈3.266" number is theirs, restated in CHSH
  units** — `S = 8p − 4`, and `8(0.9083) − 4 ≈ 3.266`. It is the *same* threshold, not a second one.
  Since Tsirelson's bound is `2√2 ≈ 2.828 < 3.266`, quantum mechanics is safely below it — the gap
  is open and is the point of the paper.
- **Mis-attribution to check for: Brunner & Skrzypczyk (PRL 102:160403, 2009)** is *not* the source of
  3.266. Their contribution is **nonlocality distillation** for a different class ("correlated
  nonlocal boxes"), improving on **Forster, Winkler & Wolf (PRL 102:120401, 2009)** whose protocol
  distils only up to **CHSH 3**, short of 3.266; Brunner–Skrzypczyk distil all the way to the PR box
  and thereby show *all* correlated nonlocal boxes trivialise communication complexity.
- **Toner & Bacon, "Communication cost of simulating Bell correlations," PRL 91:187904 (2003)** —
  **exactly one classical bit** suffices to simulate singlet correlations. Lineage:
  **Maudlin (1992)**, **Brassard–Cleve–Tapp (PRL 83:1874, 1999)**, **Steiner (2000)**. Survey:
  **Buhrman, Cleve, Massar & de Wolf, "Nonlocality and communication complexity," Rev. Mod. Phys.
  82:665 (2010)**.
- **Arfaoui & Fraigniaud, "What can be computed without communications?", SIROCCO 2012 (LNCS 7355)
  and ACM SIGACT News 45(3):82–104 (2014)** — **the closest existing prior art to the conversation's
  actual question**, stated in distributed-computing vocabulary rather than physics: characterise the
  distributed tasks solvable with **no communication at all**, using the non-signaling polytope as the
  outer bound (it subsumes quantum and is easier to handle). Notable finding: **apart from CHSH,
  quantum correlations do not help** — for every 2-player game not equivalent to CHSH there is a
  shared-randomness classical protocol at least as good.
- **Gavoille, Kosowski & Markiewicz, "What can be observed locally? Round-based models for quantum
  distributed computing," DISC 2009**, LNCS 5805 (arXiv:0903.1133) — the deflationary companion:
  earlier claims that entanglement solves Leader Election / Consensus are shown to rely on **model
  changes unrelated to quantum processing**; quantum LOCAL still cannot beat known lower bounds for
  e.g. Maximal Independent Set. Cite this whenever someone says entanglement buys consensus.
- Frontier (2025): *"Entanglement improves coordination in distributed systems"* (Phys. Rev. A / ACM
  2025) — worth tracking as the counter-current, and worth reading *against* Gavoille et al. first.

### 1.6 The CALM leg — precise statement, and what it is quantified over

- **Conjecture: Joseph M. Hellerstein, "The declarative imperative," ACM SIGMOD Record 39(1):5–19
  (2010).**
- **Proof: Tom J. Ameloot, Frank Neven & Jan Van den Bussche, "Relational transducers for declarative
  networking," J. ACM 60(2):15 (2013)** (arXiv:1012.2858). **Corollary 13 (the CALM property):** *for
  any query Q the following are equivalent — (1) Q is distributedly computable by a **coordination-
  free** transducer; (2) Q is distributedly computable by an **oblivious** transducer; (3) Q is
  **monotone**.* Where **oblivious** = *"does not use the relations `Id` and `All`"* — the transducer
  cannot see its own node identity or the set of all nodes. Coordination-freeness is the ∃-over-
  partitions definition quoted in §0.
- **Model-relativity — the caveat that kills over-strong readings: Ameloot, Ketsman, Neven & Zinn,
  "Weaker forms of monotonicity for declarative networking: a more fine-grained answer to the
  CALM-conjecture," ACM TODS 40(4):21 (2015)** (arXiv:1202.0242). Give the transducers *more* network
  knowledge and you get *different* monotonicity classes. **"Coordination-free ⟺ monotone" is a
  theorem about a specific machine model, not a law of distributed computing.** Anyone quoting CALM
  as unconditional is over-citing.
- **Restatement for practitioners: Hellerstein & Alvaro, "Keeping CALM: When Distributed Consistency
  is Easy," CACM 63(9):72–81 (2020)** (arXiv:1901.01930).
- **CALM ∘ CRDT, the frontier: Laddad, Power, Milano, Cheung, Crooks & Hellerstein, "Keep CALM and
  CRDT On," PVLDB 16(4):856–863 (2023)** (arXiv:2210.12605). Their premise is *our* counter-example
  in production dress: **CRDT guarantees cover updates, but observations of CRDT state are
  unconstrained and unsafe** — so they bolt a CALM-monotonicity query model onto CRDTs. That is
  precisely the "non-monotone read of a mergeable state" that is local-but-not-coordination-free.
- CRDT roots: **Shapiro, Preguiça, Baquero & Zawirski, "Conflict-free Replicated Data Types," SSS
  2011**, LNCS 6976:386–400 (and INRIA RR-7687, *A comprehensive study of CRDTs*) — state-based CRDTs
  are **join-semilattices**, i.e. ACI (associative, commutative, idempotent).

### 1.7 The fifth and sixth costumes nobody mentioned

Path-independence has more disguises than four, which is itself evidence that the resemblance is
generic rather than deep:

- **Rewriting:** confluence / Church–Rosser. **M. H. A. Newman, "On theories with a combinatorial
  definition of 'equivalence'," Annals of Mathematics 43(2):223–243 (1942)** — Newman's Lemma: local
  confluence + termination ⟹ global confluence. Same local-to-global shape, again with a hypothesis
  (termination) doing the work that acyclicity does in §1.1.
- **Social choice:** **Charles R. Plott, "Path Independence, Rationality, and Social Choice,"
  Econometrica 41(6):1075–1091 (1973)** — "path independence" as a *named formal axiom* on choice
  functions, predating every CS use of the phrase.
- **Vector calculus / thermodynamics:** conservative field ⟺ exact 1-form ⟺ path-independent line
  integral ⟺ zero curl (Poincaré lemma) — the state-function/exact-differential distinction. This is
  the root of which (c) is the manifold-valued generalisation.

Six domains sharing "order doesn't matter" is a strong signal that **commutativity is a widely
instantiated axiom**, and a weak signal that these are the same theorem. Per
`numerology-vs-number-theory.md` §"Too many correlations is a WARNING": the density of resonance
here is the prompt to check independence, and the check comes back *dependent* — (a)(b)(c) are one
mathematical fact (obstruction to gluing a compatible family, in three presentations), and (d), (e),
(f) are separate facts that share a slogan.

---

## 2. Anchors checked, not merely cited — the mis-citations to stop repeating

Per `anchor-to-human-prior-art.md`'s operational half. Each row is a claim that circulates attached
to a paper that does not prove it.

| circulating claim | actual status |
|---|---|
| "van Dam proves the ≈3.266 / 90.8% threshold" | **False.** van Dam 2005 proves triviality for **perfect** PR boxes only. The threshold is **Brassard et al. 2006**. |
| "≈3.266 and 90.8% are two results" | **False.** One result in two units: `S = 8p − 4`. |
| "Brunner–Skrzypczyk 2009 gives 3.266" | **False.** Different class (correlated nonlocal boxes) and a distillation result; Forster–Winkler–Wolf 2009 reach only CHSH 3. |
| "CALM: coordination-free ⟺ monotone, unconditionally" | **Over-cited.** Proved for **queries** over **relational transducer networks**, with coordination-freeness ∃-over-partitions (Ameloot et al. 2013, Cor. 13). Ameloot et al. TODS 2015 show the class moves with the network knowledge granted. |
| "the LP dual gives *the* maximally-violated Bell inequality" | **True with caveats.** Normalisation-dependent; degenerate optima need not be facets; membership is NP-complete (Pitowsky 1991). The operationally sharp version is Pironio 2003. |
| "Bell's theorem shows shared state can't produce these correlations" | **Weaker than available.** The equivalence you want is **Fine 1982**: LHV ⟺ a single global joint distribution ⟺ all Bell inequalities. |
| "CHSH generalises to N parties / d outcomes / k settings" (one family) | **Three different families.** See below. |
| "entanglement helps distributed consensus" | **Contested and largely deflated** by Gavoille–Kosowski–Markiewicz 2009; earlier claims changed the model, not the physics. |

### Generalised Bell inequalities — which axis each one generalises

Asked explicitly; answered explicitly.

| family | generalises in | reference |
|---|---|---|
| **CHSH** | the base case (2 parties, 2 settings, 2 outcomes); **complete** for (2,2,2) | Clauser, Horne, Shimony & Holt, PRL 23:880 (1969); completeness by Fine, PRL 48:291 (1982) |
| **CGLMP** | **outcomes** (2 parties, 2 settings, *d* outcomes) | Collins, Gisin, Linden, Massar & Popescu, PRL 88:040404 (2002). Tight; note maximal violation occurs at **non**-maximally entangled states |
| **MABK** | **parties** (*n* parties, 2 settings, 2 outcomes) | Mermin, PRL 65:1838 (1990); Ardehali, PRA 46:5375 (1992); Belinskii & Klyshko, Phys. Usp. 36:653 (1993) |
| **Svetlichny** | **parties, and the *kind* of locality** — detects **genuine** multipartite nonlocality, excluding hybrid local/nonlocal models | Svetlichny, Phys. Rev. D 35:3066 (1987) |
| **I₃₃₂₂** | **settings** (2 parties, 3 settings, 2 outcomes) — the simplest tight inequality beyond CHSH | Froissart, Nuovo Cimento B 64:241 (1981); Collins & Gisin, J. Phys. A 37:1775 (2004) |
| **Tsirelson bound** | not an inequality — the quantum ceiling `2√2` | Cirel'son, Lett. Math. Phys. 4:93 (1980); PR box `S=4`: Popescu & Rohrlich, Found. Phys. 24:379 (1994) |

---

## 3. The negative result, and the search that backs it

**Claim: no published work states or proves "coordination-free (CALM) ⟺ local-polytope membership,"
and no published work models CRDTs as local hidden variable models or as sheaf-theoretic empirical
models.** A negative result is only credible if the search is stated, so:

Queries run (web, 2026-08-17), all returning no hit on the bridge:

1. `CALM theorem consistency as logical monotonicity Ameloot Neven Van den Bussche coordination-free proof`
2. `Bell inequality nonlocality applied to distributed systems consensus databases CRDT`
3. `CRDT lattice sheaf theoretic contextuality "conflict-free replicated data types" Abramsky global section obstruction`
4. `"coordination-free" OR "CALM theorem" AND "Bell inequality" OR "local hidden variable" distributed computing monotonicity analogy`
5. `"eventual consistency" OR "replicated data" "Bell's theorem" OR "CHSH" analogy monotone convergence distributed systems`
6. `CRDT convergence "path independence" holonomy curvature obstruction eventual consistency geometry differential`
7. `contextuality holonomy parallel transport flat connection curvature obstruction quantum nonlocality gauge`
8. `"local polytope" membership linear program dual "separating hyperplane" optimal Bell inequality maximal violation`
9. `van Dam 2005 nonlocality communication complexity PR box trivial Brassard Buhrman Linden Methot Tapp Unger 3.266`
10. `Barbosa Vorob'ev theorem equivalent acyclicity database schema contextuality`
11. `Arfaoui Fraigniaud "What can be computed without communications?" non-signaling distributed computing Bell`
12. `Gavoille Kosowski Markiewicz "What can be observed locally" DISC 2009`
13. `Fine 1982 theorem joint distribution Bell inequalities equivalent hidden variables Pitowsky correlation polytope NP-complete`
14. `CGLMP / MABK / Svetlichny / I3322` (four sub-queries)
15. `"Keep CALM and CRDT On" Laddad Power Milano Cheung Crooks Hellerstein VLDB 2023`

In-repo prior art also checked (`docs/research/`, `rg -i 'bell|chsh|calm|monoton|coordination|holonom|nonlocal|tsirelson'`, 23 hits). Nearest in-repo relatives, none of which
make this bridge: `2026-07-02-quantum-phase5-two-ledgers-calm-is-ctl-not-adj-landauer-as-cost-contract.md`
(maps CALM-monotone ⟺ "needs no control qubit" — a *different*, and also merely structural, mapping),
`2026-06-08-what-distinguishes-quantum-from-superdeterminism-*`,
`2026-08-10-tsirelson-why-2root2-and-not-4-*`, `2026-06-12-gates-ecc-tsirelson-math-team-REPORT-6-*`.

**Falsification instructions.** This negative result dies if someone produces: (i) a paper stating
CALM in Bell-scenario vocabulary; (ii) a CRDT-as-empirical-model construction; or (iii) any use of
the Abramsky presheaf on *replicated* rather than *partitioned* state. Search terms most likely to
find it if it exists: "*coordination-free*" ∧ "*global section*"; "*join-semilattice*" ∧
"*contextuality*"; "*strong eventual consistency*" ∧ "*sheaf*"; and the author sets
{Abramsky, Barbosa, Mansfield, Kishida} ∩ {Hellerstein, Alvaro, Ameloot, Shapiro}.

**Caution against reading the negative as an opportunity.** The bridge is unwritten partly because
the ⟸ direction is false (§0) and the ⟹ direction is a definitional containment. An unwritten true
thing and an unwritten false thing look identical from the outside; here we can tell them apart, and
this one is the latter. What is *worth* writing — if anything — is the **cost** statement, not the
class statement: Pironio 2003 already prices the classical communication needed to reproduce a
correlation, and the systems-side analogue would be *"how many coordination messages does this
non-monotone query cost,"* which is a measurable quantity and not a biconditional.

---

## 4. What is actually usable in Zeta

Ranked by whether it is a theorem we can lean on or a resonance we should merely index.

1. **Vorob'ev ⟺ acyclicity (Vorob'ev 1962; Beeri–Fagin–Maier–Yannakakis 1983; Barbosa).**
   *Theorem, load-bearing.* Whether local consistency forces global consistency is decided by the
   **shape of the cover**. Directly applicable to how we carve schema/shard boundaries and to the
   DV2.0 hub/link/satellite partition: an acyclic cover is one where compatible local views *always*
   glue. This is a checkable structural criterion, not an analogy.
2. **Fine 1982.** *Theorem.* The correct citation whenever we say "shared state as λ." Replace loose
   Bell-1964 citations with it.
3. **Ameloot et al. 2013 Cor. 13 + Ameloot et al. TODS 2015.** *Theorem, with scope.* Cite CALM with
   its machine model attached. Our in-repo CALM claims should carry the ∃-over-partitions caveat.
4. **Laddad et al. 2023.** *Engineering.* The known-and-named hazard that our CRDT surfaces share:
   merges are safe, **reads are not**. Worth an audit line wherever we read replicated state.
5. **Pironio 2003 / Toner–Bacon 2003.** *Theorem.* Coordination is a **priced** quantity, and the
   price is computable from a violation. This is the shape our `db/uncertainty/` ledger already
   wants: ordinal, witnessed, and derived from a measurement rather than asserted.
6. **Gavoille et al. 2009.** *Guard.* Standing refutation for "quantum/entanglement solves consensus."
7. **Abramsky's Bell < Hardy < GHZ hierarchy.** *Index-only for now.* A graded notion of
   failure-to-glue that we have no use for yet, recorded so it can be promoted if one appears.
8. **Holonomy leg (Montanhano 2021; Ambrose–Singer 1953).** *Index-only.* Real mathematics; no Zeta
   surface currently carries a connection. Do **not** promote to a design claim.

### Triage table (per `numerology-vs-number-theory.md` — store the register with the coincidence)

| connection | register |
|---|---|
| relational databases ↔ Bell scenarios | **verified, published** (Abramsky 2013, read in full) |
| Vorob'ev ⟺ database acyclicity | **verified, published** (Barbosa; Abramsky 2013 §7) |
| LHV ⟺ global joint distribution ⟺ Bell inequalities | **verified, published** (Fine 1982) |
| Bell violation ⟹ classical communication lower bound | **verified, published** (Pironio 2003) |
| contextuality ↔ non-trivial holonomy | **published, and I did not check the proof** — cited on the authors' statement of it |
| coordination-free ⟹ inside the local polytope | **verified, and trivial** — it is the definition of the local polytope |
| coordination-free ⟸ inside the local polytope | **refuted** — non-monotone "is x absent?" is local and needs coordination |
| "path independence" in Plott 1973 / Newman 1942 | **shared slogan, different theorems** — generator-grade resonance only |

---

## 5. Beacon bibliography

**Roots.** Vorob'ev (1962) · Bell, *Physics* 1(3):195 (1964) · Clauser–Horne–Shimony–Holt, PRL 23:880
(1969) · Ambrose–Singer, Trans. AMS 75:428 (1953) · Newman, *Ann. Math.* 43:223 (1942) · Plott,
*Econometrica* 41:1075 (1973) · Cirel'son, LMP 4:93 (1980) · Froissart, *Nuovo Cim. B* 64:241 (1981) ·
Fine, PRL 48:291 (1982) · Beeri–Fagin–Maier–Yannakakis, JACM 30(3):479 (1983) · Svetlichny, PRD
35:3066 (1987) · Pitowsky, LNP 321 (1989) & *Math. Prog.* 50:395 (1991) · Mermin, PRL 65:1838 (1990) ·
Popescu–Rohrlich, *Found. Phys.* 24:379 (1994) · Honeyman–Ladner–Yannakakis, IPL 10:14 (1980).

**Frontier.** Collins–Gisin–Linden–Massar–Popescu, PRL 88:040404 (2002) · Pironio, PRA 68:062102
(2003) · Toner–Bacon, PRL 91:187904 (2003) · Collins–Gisin, J. Phys. A 37:1775 (2004) · van Dam,
*Nat. Comput.* 12:9 (2013 / quant-ph 2005) · Brassard–Buhrman–Linden–Méthot–Tapp–Unger, PRL 96:250401
(2006) · Gavoille–Kosowski–Markiewicz, DISC 2009 · Forster–Winkler–Wolf, PRL 102:120401 (2009) ·
Brunner–Skrzypczyk, PRL 102:160403 (2009) · Buhrman–Cleve–Massar–de Wolf, RMP 82:665 (2010) ·
Hellerstein, SIGMOD Rec. 39:5 (2010) · Shapiro–Preguiça–Baquero–Zawirski, SSS 2011 ·
Abramsky–Brandenburger, NJP 13:113036 (2011) · Abramsky–Mansfield–Barbosa, EPTCS 95:1 (2012) ·
Arfaoui–Fraigniaud, SIROCCO 2012 / SIGACT News 45(3):82 (2014) · Ameloot–Neven–Van den Bussche, JACM
60(2):15 (2013) · **Abramsky, LNCS 8000:13 (2013)** · Abramsky–Gottlob–Kolaitis, IJCAI 2013 ·
Brunner–Cavalcanti–Pironio–Scarani–Wehner, RMP 86:419 (2014) · Abramsky–Barbosa–Kishida–Lal–Mansfield,
CSL 2015 · Ameloot–Ketsman–Neven–Zinn, TODS 40(4):21 (2015) · Hellerstein–Alvaro, CACM 63(9):72
(2020) · Montanhano, arXiv:2105.14132 (2021) · Laddad–Power–Milano–Cheung–Crooks–Hellerstein, PVLDB
16(4):856 (2023) · Kolaitis et al., JACM 2025 (arXiv:2312.02023).

---

## 6. Owned limits of this scout run

- I read **Abramsky 2013 in full** (19pp) and quote it verbatim. Every other paper is anchored on its
  abstract, its published statement, or a review — **cited, and in most cases not entailment-checked
  line by line.** The rows marked "verified" in §4 are the ones where I checked the statement against
  the source text; the holonomy row is explicitly marked as not checked.
- The counter-example in §0 ("is x absent?") is mine, constructed here. It is elementary and I believe
  it is right, but it is **not** drawn from a paper, and it is the load-bearing claim of this
  document — so it is the thing to attack first.
- The negative result in §3 is a **web-and-repo search**, not a database sweep. No ACM DL / DBLP /
  Semantic Scholar citation-graph traversal was run. A citation-graph forward search from Abramsky
  2013 and from Ameloot et al. 2013 would be the next escalation, and could overturn §3.
- I did not compute anything. No LP was solved, no polytope enumerated, no CHSH value produced.
  Everything here is `unmetered` in the sense of `toy-is-free-metered-must-be-earned.md`.

---

## 7. Incidental finding — a CI diagnostic that names the wrong artifact

Shipping this doc tripped it, and a peer had already lost an hour to the same trap, so it is
recorded rather than lost. `.github/workflows/agencysignature-enforcement.yml` invokes
`validate-agencysignature-pr-body.ts` **twice** with different inputs — once piping `$PR_BODY` (the
job named `agencysignature (PR body)`), once piping commit messages from
`gh api .../pulls/<N>/commits`. **Both share one failure message**, and that message says:

> *"this check reads COMMIT MESSAGES, not the PR description — a perfect block in the PR description
> does NOT satisfy it. Fix: append the 10-trailer block at the very bottom of the COMMIT MESSAGE
> (not the PR description)."*

For the `(PR body)` invocation that is **exactly backwards**: it read the description, and obeying
the text sends you to rewrite a commit that was never the problem. The peer who hit it first closed
a PR and rebuilt the branch on that advice; the rebuild failed identically, because the commit was
never the cause.

**Both requirements are real and independent.** Satisfy the contiguous block at the bottom of *each
commit message* **and** the same block at the bottom of the *PR description*. The commit-side rule
carries a genuine trap of its own: a blank line between `Task:` and `Co-authored-by:` makes
`git interpret-trailers --parse` return **only** the `Co-authored-by:` line, silently demoting the
ten fields to prose. This PR's first commit had exactly that defect. The pre-push check:

```
git log -1 --format='%B' | git interpret-trailers --parse   # must print all eleven lines
```

This belongs in *this* document because it is the same failure class the document is about. A
diagnostic that names the wrong artifact is **an output that does not entail its cause** — the
`anchor-to-human-prior-art` entailment discipline, applied to an error message instead of a
citation. And one message shared by two invocations with opposite subjects **cannot be right for
both**, so it is not evidence for either: the vacuity class in CI dress, sitting next to the check
that catches it. Worth a follow-up that gives each invocation its own message naming the artifact
it actually read; not opened here, so as not to displace the deliverable.
