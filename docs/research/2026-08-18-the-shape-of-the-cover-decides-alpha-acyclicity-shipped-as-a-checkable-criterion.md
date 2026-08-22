# The shape of the cover decides — alpha-acyclicity, shipped as a checkable criterion

**Date:** 2026-08-18 · **Work item:** `081M0AH5TQQ087G0R003CNFRAF` · **Register:** Beacon
**Predecessors:** `2026-08-17-path-independence-in-four-costumes-…-literature-scout-verdict.md` (the
scout that found this) and `2026-08-17-path-independence-is-four-properties-refuting-…` (the refuter
that killed the CRDT/Bell identification). This doc ships the one leg that survived both.

---

## 0. What shipped

`src/Core.TypeScript/cover-acyclicity/` — a decision procedure for **alpha-acyclicity of an
attribute cover**, by GYO reduction, with a **certificate on both verdicts**, plus the semantic half
that makes it falsifiable, plus a measurement of the real covers in this repo.

The criterion, stated so it can be acted on:

> **Whether local agreement forces global agreement is a property of the SHAPE OF THE COVER, not of
> the merge operator.** A cover is alpha-acyclic iff every pairwise-consistent instance over it has a
> universal relation. On an acyclic carve, local consistency is enough. On a cyclic one, *no merge
> operator helps* — the counterexample is an instance, not an algorithm.

| file | what it is |
|---|---|
| `gyo.ts` | the decision procedure; join-tree certificate (acyclic) / cyclic-core certificate; independent validators |
| `witness.ts` | the semantic half: pairwise consistency, natural join, global consistency, bounded exhaustive witness search |
| `repo-covers.ts` | extractors — zetaschema JSON, and a narrow `CREATE TABLE` reader with two explicit naming conventions |
| `measure-repo-covers.ts` | the CLI: `bun src/Core.TypeScript/cover-acyclicity/measure-repo-covers.ts` |
| `gyo.test.ts`, `repo-covers.test.ts` | 44 tests, 2773 assertions, ~11s |

**Language: TypeScript, not F#.** The consumers are on that side — the artifacts a cover gets
extracted *from* are JSON/SQL read by TS tooling, the falsifier machinery
(`hygiene/mutation-runner.ts`) is TS, and `fast-check` is already a dependency. Nothing in this
composes with the F# Z-set/DBSP algebra, and pretending otherwise would be the identification the
refuter already killed.

---

## 1. Register — what I CHECKED, what I merely CITE, what I DECLINED

This is the part that matters more than the code
(`.claude/rules/toy-is-free-metered-must-be-earned.md`, `anchor-to-human-prior-art.md`).

### 1.1 CHECKED by entailment (this is the metered part)

**Claim:** *alpha-acyclic (GYO-reducible) ⟺ every pairwise-consistent instance is globally
consistent* — Beeri, Fagin, Maier & Yannakakis, JACM 30(3):479–513 (1983).

**How it was checked, not assumed:** the right-hand side is computed **independently, by exhaustion,
by code that never calls GYO**. For every cover of 2 or 3 nonempty subsets of {A,B,C}, every instance
over a two-value domain is enumerated, tested for pairwise consistency, and tested for global
consistency by computing the natural join and projecting back.

- **382 covers checked, 0 disagreements.** 10 covers refused as too large to exhaust.
- Both outcomes occur in the family (asserted in the test), so the agreement is not vacuous.
- Two sabotage controls are in the suite: an oracle that always answers "acyclic" and one that
  always answers "cyclic" both **fail** the same check. A check a broken procedure passes is not a
  check.

That is the anchor-checking discipline actually performed: the citation is not taken on the paper's
authority, it is *entailed* over a bounded family, and the entailment is re-run on every CI run.

**Honest bounds on that check** — it is a verification, not a proof:

- The domain is `{0,1}`. A cover could in principle require ≥3 values to exhibit a witness; none in
  this family did, and I have not proven none exists.
- Covers are ≤3 elements over ≤3 attributes. Larger covers are covered only by property tests
  (confluence, renaming-invariance, certificate validity), not by the semantic biconditional.
- 10 of 392 covers were **refused**, not searched. `searchGluingWitness` returns `refused` rather
  than `no-witness` when the space exceeds the bound, because a truncated search reported as "none
  found" is the vacuity class in its purest form. A mutant that moved that ceiling is killed by the
  suite.

### 1.2 CITED, and NOT checked

Stated plainly, because a cited-but-unchecked anchor keeps a claim in `unmetered`:

| citation | status |
|---|---|
| **Vorob'ev (1962) ⟺ database acyclicity** (attributed to **Rui Soares Barbosa** in Abramsky 2013 §7) | **cited, NOT checked.** I did not read Vorob'ev, and I did not read Barbosa's proof. **Nothing in the shipped code depends on it** — every property the module claims is checked against the BFMY/database statement directly. |
| **Abramsky, "Relational Databases and Bell's Theorem"** (LNCS 8000, 2013; arXiv:1208.6416) — the presheaf correspondence, Prop. 2.2, Prop. 5.3 | **cited at SECOND HAND.** The scout read the paper and quoted its §7 table verbatim; I read the scout's report, not the paper. That is a weaker provenance than "checked" and is recorded as such. |
| **Honeyman, Ladner & Yannakakis (1980)** — join consistency is NP-complete | **cited.** Consistent with what the code does (the search is exponential and refuses rather than pretending), but I did not verify the reduction. |
| **Pitowsky (1991)** — correlation-polytope membership is NP-complete | **cited.** Not used by any code here. |
| **Graham 1979 / Yu & Ozsoyoglu 1979** — the GYO reduction and its confluence | **the algorithm is implemented and its confluence is tested** (500 random covers, invariance under element order and under bijective attribute renaming). The *attribution* is cited. |

### 1.3 DECLINED — claims this work does NOT make

- **Nothing about CRDTs.** The identification "a coordination-free/monotone computation IS a local
  hidden variable model" was **refuted** in `2026-08-17-path-independence-is-four-properties-…`. This
  criterion stands on database theory alone and is presented that way. It does not say a CRDT merge
  is safe, unsafe, flat, or curved.
- **Nothing about Bell inequalities or contextuality.** The Vorob'ev bridge is the *reason this was
  interesting*, and it is exactly the leg I did not check. Reading a CYCLIC verdict as "this schema
  is contextual" would be numerology dressed as a result.
- **Nothing about our merge algebra.** No F# type in this repo is claimed to be a presheaf, a sheaf,
  a cover, or a global section.
- **Nothing about coordination cost.** A cyclic verdict says a guarantee is absent; it does not price
  what recovering it costs.
- **No gate.** `measure-repo-covers.ts` exits 0 whatever it finds. A cyclic cover is a *finding*, not
  a build break, and there is no in-repo consumer yet whose correctness depends on a cover being
  acyclic. Wiring this into CI before such a consumer exists would be a check that constrains
  nothing.

---

## 2. The forcing cases

### 2.1 The witness — cyclic, and exhibited

The classic 3-cycle `{A,B}, {B,C}, {C,A}` with each relation asserting "my two attributes differ":

```
R_AB = {(0,1),(1,0)}    R_BC = {(0,1),(1,0)}    R_CA = {(0,1),(1,0)}
```

- **Pairwise consistent** — every single-attribute projection is `{0,1}`. Asserted in the suite.
- **No universal relation** — `A ≠ B` and `B ≠ C` force `A = C` over two values, which `R_CA`
  forbids. The natural join is *empty*, so its projections are empty and cannot equal the relations.
- The suite proves it **by exhaustion** over all 8 tuples, and separately shows the search
  **finds** this witness on its own (1639 instances examined before hitting one).
- And the control that makes it a property of the SHAPE: **drop one element** and the cover becomes
  a chain; the *same local data* then glues.

That witness is why the criterion is not advice. No commutative, associative, idempotent merge
recovers a global section that does not exist.

### 2.2 Alpha-acyclicity is not hereditary

`{A,B}, {B,C}, {C,A}, {A,B,C}` is **acyclic**, though the sub-cover `{A,B},{B,C},{C,A}` is not — the
full edge absorbs the others. Verified both syntactically and by exhaustive search (1,048,576
instances, no witness). This is the alpha/beta-acyclicity distinction, and it is the case that breaks
any implementation that "handles cycles" by looking for a cycle in the intersection graph.

Generalised as a property test: **adding the union of all attributes as one element always makes a
cover acyclic.** True, and it is also why "just materialise the universal relation" is a real escape
hatch with a real price.

### 2.3 The convention that is load-bearing

Two elements sharing **no** attributes are *not* trivially consistent. Projection onto the empty
attribute set gives one empty tuple for a nonempty relation and nothing for an empty one — so they
agree iff both are empty or both are not. Skip that and the **acyclic** cover `{A}, {B}` with
`R1 = {(0)}, R2 = {}` reads as locally consistent with no universal relation, and BFMY reads as
false. The theorem is fine; the convention was the thing that had to be right. Found by writing the
check, and now pinned by four tests and a mutant.

---

## 3. Mutation results

Mutants applied one at a time to `gyo.ts` / `witness.ts`; suite run; source restored.

**11 killed / 14 applied. 3 survivors, all demonstrated equivalent.**

| id | mutation | outcome |
|---|---|---|
| M1 | rule (E) ear removal never fires | killed |
| M2 | rule (C) containment removal never fires | killed |
| M3 | ear condition widened to "occurs in ≤ 2 elements" | killed |
| M4 | accept on residue of ≤ 1 element instead of 0 | **survived — equivalent** |
| M5 | containment direction reversed | killed |
| M6 | equal-set tie-break inverted | **survived — equivalent** |
| M7 | `isSubsetOf` always true | killed |
| M8 | terminal state retires the last element regardless of its attributes | **survived — equivalent** |
| M9 | `validateJoinTree` never reports a running-intersection violation | killed |
| M10 | `validateCyclicCore` drops the rule-(E) fixed-point check | **killed after healing** (see below) |
| M11 | disjoint pairs treated as trivially consistent | **killed after healing** |
| M12 | global consistency asserted without checking projections | killed |
| M13 | the per-element tuple ceiling moved, silently shrinking the search | killed |
| M14 | the witness search short-circuits to "no-witness" | killed |

**Two genuine test gaps, found and healed.** M10 and M11 survived the first run. Both were real:
nothing exercised `validateCyclicCore`'s rule-(E) check, and nothing exercised the disjoint-pair
convention above. Tests were added for each — including a regression test for the bug in §4 — and
both mutants now die. That is the mutation runner working as designed: the finding is about the
tests, not the code.

**Three survivors, and why they are equivalent rather than gaps.** M4, M6 and M8 all concern states
the reduction cannot reach or choices that cannot change the answer:

- a residue of *exactly one* element is unreachable — with one element left, every attribute occurs
  once, so rule (E) strips them and the terminal rule retires it;
- the equal-set tie-break only decides *which* of two identical elements survives, never whether one
  does.

Argument is not evidence, so it was measured: each mutant was applied and both versions run over
**200,000 pseudo-random covers** (up to 5 elements over 5 attributes; 175,908 acyclic).
**0 differing verdicts for all three.** They are equivalent mutants — no test could kill them — and
that is reported rather than papered over with a contrived assertion.

---

## 4. A bug this work found in itself

The first cyclic-core certificate reported the elements' **original** attributes, so it looked like a
literal sub-cover of the input. It is not a fixed point: on `{A,B}, {B,C}, {A,C,D}` the reduction
strips `D` (it occurs once) and then sticks on a 3-cycle — but the core-as-reported still carried
`D`, and rule (E) fires on it, so the independent validator rejected GYO's own certificate. Caught by
the property test "whenever GYO emits a certificate, the certificate validates," on a cover
`fast-check` found in 51 runs.

The fix reports the ear-stripped attributes — the hypergraph the reduction actually got stuck on —
keeping element *names* so a reader can still find the tables in their schema. A regression test pins
both directions.

**And an asymmetry worth naming rather than hiding:** the *acyclic* certificate is genuinely
independent (a join tree is checkable against the cover with no reference to how it was found). The
*cyclic* certificate is not — it confirms the reduction stopped somewhere it legitimately could stop,
not that stopping was forced. The independent check for a cyclic verdict is **semantic**: produce the
witness instance. That is what the test suite does, and the module says so in its own docstring.

---

## 5. MEASURED — real covers in this repo

`bun src/Core.TypeScript/cover-acyclicity/measure-repo-covers.ts`

| cover | source | verdict |
|---|---|---|
| IMDb zetaschema | `schemas/imdb/*.zetaschema.json` | **ALPHA-ACYCLIC** (join tree: `ImdbTitle → ImdbPrincipal ← ImdbName`) |
| FactoryDemo, raw column names | `samples/FactoryDemo.Db/schema.sql` | **ALPHA-ACYCLIC** |
| FactoryDemo, role-qualified (URA) | same | **ALPHA-ACYCLIC** |

Both real covers carry the guarantee. Three notes, because the verdicts are less interesting than
what they expose:

1. **The FactoryDemo entity-relationship graph is a TRIANGLE and the cover is still acyclic.**
   `customers ← opportunities`, `customers ← activities`, `opportunities ← activities`. A loop in the
   ER drawing is not a cyclic cover: `activities` carries *both* keys, so the hypergraph has an ear
   where the diagram has a cycle. This is the concrete reason the criterion has to be computed on the
   **attribute hypergraph** and cannot be eyeballed off an ER diagram — which is exactly the sort of
   thing a "structural criterion" is worth having code for.

2. **The naming convention is a modelling choice, and both were run.** Under "raw", `id` and
   `created_at` are shared attributes across tables, which is false to the schema's meaning; under
   "role-qualified" each table's primary key is renamed to the column name other tables use to
   *reference* it — derived from the declared FOREIGN KEYS, not guessed from a pluralisation rule —
   and non-key columns are table-qualified (the universal-relation-assumption discipline, Fagin,
   Mendelzon & Ullman, TODS 7(3):343, 1982). The two conventions **agree** here. Had they disagreed,
   the disagreement would have been the finding.

3. **What I looked for and did NOT find: a concrete DV2.0 hub/link/satellite cover.** The scout's
   note says this criterion applies to the DV2.0 partition. There is no relational Data Vault schema
   in this repo to point it at — `db/` is a directory tree, not a schema, and `SchemaZ.fs` models
   schema *evolution*, not a hub/satellite carve. So the DV2.0 application remains **unmeasured**.
   Saying "it applies to DV2.0" without a cover to measure would be exactly the unfalsifiable claim
   this module exists to avoid.

The verdicts are **pinned in `repo-covers.test.ts`**. If someone adds a table that turns the
factory-demo cover cyclic, the suite goes red and names it. Losing a guarantee is fine; losing one
silently is not.

---

## 6. What this is for

The usable form, and the only design consequence claimed:

> When carving a schema, a shard boundary, or a set of local views, **compute the cover's
> acyclicity**. Acyclic means pairwise agreement between neighbours is sufficient — you need no
> global coordinator to know the local views glue. Cyclic means that guarantee is simply absent, and
> the fix is a different carve (add an element containing the keys that close the cycle) or an
> explicit coordination protocol — never a better merge function.

Note what is *not* claimed: that this is cheap in general. Deciding join consistency for a given
instance is NP-complete (Honeyman–Ladner–Yannakakis 1980). What is cheap is deciding the
**cover's shape** — GYO is polynomial — and the shape is what you control at design time.

---

## 7. Anchors

**Roots.** Codd, CACM 13(6):377 (1970) · Vorob'ev, *Theory Probab. Appl.* 7:147 (1962) ·
Honeyman, Ladner & Yannakakis, IPL 10(1):14 (1980) · Graham (1979) / Yu & Ozsoyoglu (1979) — the GYO
reduction · Fagin, Mendelzon & Ullman, TODS 7(3):343 (1982) — the universal relation assumption ·
Beeri, Fagin, Maier & Yannakakis, JACM 30(3):479 (1983) — **the theorem this module implements**.

**Frontier.** Abramsky, LNCS 8000:13 (2013) — the presheaf correspondence · Barbosa (Oxford) — the
Vorob'ev ⟺ acyclicity attribution · Kolaitis et al., *Consistency of Relations over Monoids*, JACM
2025 (arXiv:2312.02023).

**In-repo.** `docs/PRIOR-ART-LIST.md` already carries the Vorob'ev/BFMY and Abramsky entries (added
by the scout) · `.claude/rules/toy-is-free-metered-must-be-earned.md` ·
`.claude/rules/numerology-vs-number-theory.md` · `.claude/rules/anchor-to-human-prior-art.md` ·
`.claude/rules/dv2-data-split-discipline-activated.md` (§5 DV2.0 — the application that remains
unmeasured, per §5.3 above).
