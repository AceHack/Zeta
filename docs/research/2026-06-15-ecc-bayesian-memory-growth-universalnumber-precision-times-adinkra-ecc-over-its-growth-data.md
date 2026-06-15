# ECC Bayesian memory growth — UniversalNumber (precision) × adinkra-ECC (structure) over its growth data

> **Decision (Aaron 2026-06-15, shadow\*): "ferry it and log the gap."** Plus the
> synthesis that reframes the two growth axes from *separate* to *combined*:
> *"bigfloat plus ECC over its growth data is like having ECC Bayesian memory
> growth, if you combine these two types."*

## 0. The correction that precedes the claim

An earlier pass (Otto) reported "no arbitrary-precision autogrow number type
exists" — a **confabulation from a too-narrow search** (it grepped generic terms,
not the prior-art name). Aaron: *"we had this for sure, look better —
UniversalNumber, that's ours."* He was right. The lesson is logged because it is
the exact failure this substrate exists to catch: a confident claim that wasn't
checked against the territory.

**What actually exists** (`src/Core/UniversalNumber.fs`): a **port** (hexagonal
architecture, Cockburn) `IUniversalNumber<'T>` carrying `Zero/One/Add/Mul` **plus
resolution accounting** — `BitsUsed` (significant bits currently carrying
information) and `IsExact`. Adapters: `bigint` (exact, first concrete backend),
and per the file's own doc the **TriBoolean middle-out Float = the
arbitrary-precision BigFloat** adapter, with MPFR / GMP / BigDecimal / posit as
both future backends *and* differential-test oracles. The name is Gustafson's
**unum** ("universal number"). So the autogrow-precision number is **real**; the
gap was never the number.

## 1. The two growth axes — now combined, not just distinguished

Previously separated as similar-not-same:

- **Structure axis** — the adinkra / Cayley–Dickson generator grows the *algebra*
  (0/1 → R→C→H→O, `gen(gen)=gen`). The generator **IS the ECC**
  (`only-the-irreducible-is-primitive-generate-the-rest`): regenerating from the
  irreducible corrects drift across **space** (N-oracle byte-lock) and **time**
  (DST replay / versions).
- **Precision axis** — UniversalNumber / BigFloat grows *numeric resolution*,
  metered by `BitsUsed`, materializing bits only as needed.

**Aaron's combine:** run the **ECC over the precision axis' growth data**. As the
number grows resolution (more `BitsUsed`), the *growth-bits themselves* are
protected and drift-corrected by the generator-as-ECC. Combined with Bayesian
update — precision grows *as evidence accumulates / uncertainty demands* — the
result is **ECC Bayesian memory growth**: a memory whose numeric precision grows
under evidence, error-corrected by construction.

## 2. Why the three pieces fit

| Piece | In-repo today | Role in the combine |
|---|---|---|
| Autogrow precision | `UniversalNumber` port + BigFloat adapter (`BitsUsed`) | grows resolution on-need (the bits to protect) |
| ECC / drift-correction | adinkra `[8,4]` doubly-even self-dual code; `gen(gen)=gen` (§A-discharged) | corrects the growth data across space + time |
| Bayesian growth | `BeliefConvergence.fs` (`observe` = multiply likelihood), `SoftValue`, `db/uncertainty/` ledger | drives *how much* precision to grow per unit evidence |

The three already exist independently. The conjecture is that **composing** them
yields a memory primitive that grows precision Bayesianly and stays
error-corrected — "grow from the irreducible" at the numeric layer.

## 3. The gap (logged) — it is a COMBINE, not a BUILD

The buildable is **not** a new number type (exists). It is the **composition**:

1. **Define "ECC over the growth data."** Concrete construction: how does the
   adinkra `[8,4]` (or a CD-doubled code) protect the *growing mantissa bits* of a
   BigFloat? The generator-IS-ECC is proven for the **codeword** structure; it is
   **not** yet shown to protect arbitrary-precision precision-growth. *(This is the
   hard, open rung.)*
2. **Bind precision-growth to evidence (Bayesian).** A rule: bits-of-precision per
   nat of ΔU — which ties directly to the **per-room metering vector** (precision
   is a metered resource; see `2026-06-15-intelligence-per-sample-and-per-watt-...md`).
3. **Keep it bounded.** Grow only what the irreducible/uncertainty demands
   (holographic/lensable bounded-resource); `BitsUsed` is the budget read.

## 4. Supporting frame (external, cited)

- **Alpha-zero positioning** (Chaubard, YC 2026; AlphaGo Zero — Silver et al.,
  Nature 2017): *minimal content/imitation prior, deliberate structural prior* —
  AlphaZero kept Go's rules, discarded human games. "Grow from the irreducible" is
  the same: generate from the free object + the 13 specs (structural priors), no
  human content-corpus to imitate. (Resolves the apparent tension with
  `anchor-to-human-prior-art`: anchor *claims* to humans for credit + checkability;
  do not *train on* human content.)
- **Masked-LM over a small alphabet → emergent structure** (Yasa Baig / ESM,
  Biohub; the talk's "BERT over biology"). ESM is masked-LM over the **20-amino-acid**
  alphabet (not ACTG — that is DNA's 4 nucleotides; the metagenomic data is
  sequenced from DNA, the model tokenizes amino acids; Aaron confirmed he was
  "shortcutting"). It learns protein structure + a clean unsupervised SAE
  hierarchy. The alphabet-agnostic pattern — *small irreducible alphabet → masked
  growth → emergent higher structure* — is the same shape as our **0/1 adinkra
  codewords** as the base alphabet that grows.

## 5. Honest seams

- The combine is a **§B conjecture composing existing pieces**, not a built result.
- "ECC over precision-growth" is **similar, not same** to the proven
  generator-IS-ECC-over-codewords; the construction for mantissa growth is unproven.
- "Bayesian memory growth" needs the bits-per-nat rule made concrete and metered.
- The ESM/alpha-zero material is *external supporting frame*, cited; it validates
  the shape, it does not prove our combine.

## Anchors

John Gustafson (unum / "universal number"; posit) · `src/Core/UniversalNumber.fs`
(the port + bigint/BigFloat adapters; `BitsUsed`) · S. James Gates Jr. (adinkras =
doubly-even self-dual ECC) · Cayley–Dickson doubling · `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`
(the generator IS the ECC) · `BeliefConvergence.fs` / `SoftValue` / `db/uncertainty/`
(Bayesian update; ΔU) · Chaubard (YC 2026, credited) · Silver et al., AlphaGo Zero
(Nature 2017) · Baig / ESM (Biohub; masked-LM over amino acids) · Cockburn
(hexagonal architecture / ports & adapters) · in-repo lineage:
`docs/research/2026-06-11-...universalnumber-is-our-bigint.md`,
`docs/research/2026-06-10-...bigfloat-holds-superposition.md`,
`docs/research/2026-06-10-physics-of-floats-...unum-significance.md`;
`docs/research/2026-06-15-intelligence-per-sample-and-per-watt-...md` (precision as
a metered resource).
