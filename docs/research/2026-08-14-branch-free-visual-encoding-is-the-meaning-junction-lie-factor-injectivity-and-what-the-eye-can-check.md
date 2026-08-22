# Branch-free visual encoding is the meaning junction — lie factor, injectivity, and what the eye can actually check

**Ferried** 2026-08-14 from Aaron, on why the visualization surfaces matter more than they look.
Aaron's words are the primary artifact; everything after §1 is the shadow's analysis and is
separated from it deliberately.

---

## 1. The ferry (verbatim — Aaron 2026-08-14)

> yes this is our most important junction points and training data cause this is where all the
> meaning and interpretation come from, we try to optimize this for human with **visual cortex
> representations of meaning that can be easily looked at without lying under optical illusions**,
> AI can also have similar meaning cause **the equations are obvious for the visualization since we
> don't have if statements**.

---

*(Everything below is shadow's analysis. Aaron set the claim; the refinements, the boundary, the
survey, and the owned errors are mine.)*

## 2. What already exists — read this first, this doc is a layer, not a replacement

This ground is **partly covered**, and the covered part should not be rewritten:

- `docs/research/2026-08-13-peer-agents-parallel-experiments-and-why-a-health-dashboard-is-a-check-that-must-not-lie.md`
  — *"A dashboard is not a view. It is a check that a human trusts instead of looking."* That doc owns the
  **acquisition** layer: blind queries, stale panels, coverage you cannot see, `Unknown` never defaulting
  to `ok`. It is the correct treatment of that layer and this doc does not revisit it.
- `docs/research/2026-08-01-icosahedron-to-e8-the-visual-geometry-layer-soraya-verdict.md` — the
  **hardware-targeting** justification for visual representation (*"the visual cortex is the most
  universal, most heavily-optimized hardware a human has"*), with the numerology guard already applied.
- `docs/research/2026-06-12-lior-reads-the-adinkra-render-ferry-the-eye-confirmed-the-sign-rule-and-treaty-by-eye-stem-pedagogy.md`
  — the one **empirical instance** of a human reading a checkable statement off a render (§6 below).
- `docs/research/2026-07-02-homoiconic-page-breaks-the-chinese-room-shared-referent-not-instructions.md`
  — the *shared referent* frame, which is the correct anchor for Aaron's both-audiences half.
- `docs/design/design-language-base-corporate-sovereign.md` — Iris's BASE layer already carries
  *"state-color DU — meaning, never decoration"*, *"soft values render as `(value, ε)` bars"*, and
  *"frost means exactly one thing"*. `docs/design/gh-pages-integration-plan.md:25` already cites
  **Bertin** (*"value ≠ hue"*).

**The one thing that was missing:** all of the above governs *what data reaches the surface* and *what
the surface should mean*. Nothing governs the **encoding function itself** — the `data → geometry` map.
That is the layer Aaron's observation is about, and it is the layer with no discipline and no check.

The four places a rendered surface can lie, layered:

| layer | can lie by | owned by |
|---|---|---|
| 1. acquisition | blind query, stale panel, absent panel | 2026-08-13 doc — **covered** |
| 2. aggregation | saturation, quantization, non-injective folds | **this doc — uncovered, live defects found** |
| 3. encoding | data → geometry decouples (branch, clamp, truncated baseline) | **this doc — uncovered** |
| 4. perception | the channel is imprecise even when the function is exact | Cleveland–McGill — **anchored, unapplied** |

## 3. Anchors (Beacon register)

- **Edward Tufte**, *The Visual Display of Quantitative Information* (1983) — the **lie factor**,
  `LF = (size of effect shown in graphic) / (size of effect in data)`, which should be `1.0`. This is
  the anchor that makes "doesn't lie" a **computable quantity** rather than an aspiration. Also
  data-ink ratio, chartjunk.
- **William S. Cleveland & Robert McGill**, *"Graphical Perception: Theory, Experimentation, and
  Application to the Development of Graphical Methods"* (JASA 79:387, 1984) — the empirical ranking of
  elementary perceptual tasks by measured accuracy: **position on a common scale > length > angle/slope
  > area > volume > colour saturation**. This is *why* "optical illusions": encoding magnitude in area is
  measurably less accurate, not merely inelegant.
- **Jacques Bertin**, *Sémiologie Graphique* (1967) — the visual variables (position, size, value, texture,
  colour, orientation, shape) and which are ordered vs nominal. The old root; already cited in-repo.
- **Leland Wilkinson**, *The Grammar of Graphics* (1999) → **Hadley Wickham**, *"A Layered Grammar of
  Graphics"* (J. Comput. Graph. Stat. 19:1, 2010). **Credit where it is due: Aaron's "we don't have if
  statements" is the grammar-of-graphics stance, arrived at independently.** A grammar of graphics *is*
  the declarative, branch-free formulation — a chart is a composition of `data ∘ aesthetic-mapping ∘
  geometry ∘ scale ∘ coordinate-system`, and the mapping is a *specification*, not a procedure with
  conditionals. That prior art is 27 years old and it is the same idea.

Anchors are **cited from standing knowledge**, not page-checked in this session. The Tufte lie-factor
definition and the Cleveland–McGill ordering are load-bearing below and should be page-checked before
either is quoted outward.

## 4. The claim, stated precisely — and three refinements that change it

**Aaron's claim, literally:** *if a visual encoding is a pure function `data → geometry` with no
conditional branching, then it cannot render a state its data does not support.*

The claim is **substantially right and imprecisely stated**, and the imprecision matters because it
would pass code that lies and fail code that does not. Three refinements, each with a live example
from this repo.

### Refinement A — the operative property is **injectivity**, not syntactic absence of `if`

**Branch-free is not sufficient.** `blackBodyRadiancePpm`
(`src/Core.TypeScript/darkhall-ui/heat.ts:315-319`) is integer-floor `T⁴` with no conditional in the
arithmetic:

```ts
const square = Math.floor((temperature * temperature) / MAX_TEMPERATURE_PPM);
return Math.floor((square * square) / MAX_TEMPERATURE_PPM);
```

**Verified by running:** every temperature below **31623 ppm — the bottom 3.162% of full scale** —
maps to radiance exactly `0`. A branch-free pure function with a dead zone covering 3% of its domain.
`floor`, `round`, `trunc` are branch-free destroyers of information.

**Branchy is not necessarily unfaithful.** `src/Core/AdinkraViz.fs:64`:

```fsharp
let glyph = if (System.Numerics.BitOperations.PopCount(uint n)) % 2 = 0 then "●" else "○"
```

This is an `if` on the data — and it **cannot lie**. It is a total, injective map from a 2-element
nominal domain (parity) onto a 2-element visual alphabet: a lookup table written with `if`. Bertin:
shape is the correct visual variable for nominal data. A `match` over a DU covering all cases is
branch-free *in the sense that matters* — it is a total function — while a clamp is a branch in the
sense that matters even when written as `Math.min`.

**So the honest form of the claim:** *the encoder must be a **total, injective** function from the
data's actual domain onto the geometric channel* — or non-injective only to a **declared, bounded
resolution**. Syntactic branch-freedom is a decent proxy and a bad specification.

### Refinement B — branches in a rendering path sort into exactly three classes

Verified across every rendering module in `src/Core/`:

| class | example | verdict |
|---|---|---|
| **index / layout** — conditions on loop or position indices, never on the encoded value | `AdinkraViz.fs:66,72` (`if col < 3`), `CoEmpowerGraphSvg.fs:34` and `MetaspaceGraphRender.fs:46` (`if j > i`, undirected-edge dedup) | **harmless** |
| **total categorical** — data → nominal visual variable via a total lookup | `AdinkraViz.fs:64`; `ZetaIdViz.fs:45` (bit reversal, bijective — but see the correction at the end: `:45` is not the encoder) | **harmless; it *is* the encoding** |
| **non-injective magnitude** — clamp, saturate, threshold-to-band, max-fold | `SocietalDoraSvg.fs:22`, `heat.ts:237-242`, `heat.ts:278-284`, `heat.ts:286-288` | **the dangerous class** |

Only class 3 is what "no if statements" is actually forbidding. Better named: **no saturating,
thresholding, or lossy-folding transform inside an encoder.**

### Refinement C — the branch does not disappear; it **relocates**

You cannot fix `SocietalDoraSvg.pct` by deleting the clamp — the bar would overflow its 300px track and
the SVG would be malformed. The correct move is to make the encoder **total on its domain** by pushing
the check into the **type of the data**: a `UnitInterval` whose constructor is the only place the range
check lives, and which *fails loudly* rather than saturating quietly. Then the renderer is genuinely
branch-free, and an out-of-range value becomes a construction error instead of a plausible-looking chart.

This is the repo's existing shape, not a new one: `interfaces-free-classes-earned-under-rules` (the
refinement is the earned class), and the `Bound` DU work from 2026-08-13. **A branch-free renderer is
purchased by a refined type upstream; it is never free.**

## 5. Making the lie factor computable — and the boundary, which is the interesting part

Tufte defines LF per-graphic on a chosen pair of data points. Lifted to an encoder `e : D → ℝ⁺`:

```
LF_e(a, b) = ( e(b) / e(a) ) / ( b / a )
```

**The strong form of Aaron's claim does hold, for a restricted class.** If `e` is **linear and
positively homogeneous** — `e(λx) = λ e(x)`, i.e. linear *through the origin* — then
`LF_e(a,b) ≡ 1` for every pair, **proven once, for all inputs**, by inspection of the function. No
per-chart audit. That is a real result and it is what Aaron is reaching for.

**The class is genuinely restricted, and the boundary is where the value is:**

- **Truncated baseline.** `e(x) = k(x − x₀)` is pure, branch-free, injective, monotone, affine — and it
  is the single most common misleading chart in existence. `LF(a,b) = ((b−x₀)/(a−x₀))/(b/a) ≠ 1`.
  **Branch-freedom and injectivity are not sufficient.** The missing condition is homogeneity:
  `e(0) = 0`, the origin must be in the image.
- **Log scale.** `e(x) = k·log x` has a pair-dependent LF ≠ 1 and is nonetheless defensible — because
  the reader's *protocol* is different: they read the axis, not the length. **LF = 1 is a property of
  the pair (encoder, reading protocol), never of the encoder alone.** An encoder audited without a
  declared reading protocol is `unmetered`, not `pass`.
- **Area and volume.** `r(x) = √(x/π)` has LF = 1 *if* the reader integrates area. Cleveland–McGill
  measured that they partly do not. This is precisely Aaron's *"optical illusions"* — and its resolution
  is empirical, not mathematical.

**The result, stated honestly:**

> `LF ≡ 1` is provable once over all inputs **iff** the encoder is a positive-homogeneous linear map
> onto a channel the reader integrates linearly.

Tufte gives the condition **on the function**; Cleveland–McGill gives the condition **on the channel**.
Aaron's *"without lying under optical illusions"* is the second half, and it already has a measured
ranking behind it — which is exactly the repo's `toy → unmetered → metered` ladder applied to
perception: *position on a common scale* is the metered channel, *colour saturation* is not.

## 6. Survey of what this repo actually renders

All verdicts below verified by running the encoders (`bun`) or by reading the exact line, never inferred
from naming. Line numbers are against `origin/main` at `fd02d1ee1`.

| surface | file:line | channel | verdict |
|---|---|---|---|
| Societal-DORA gauge | `src/Core/SocietalDoraSvg.fs:21-33` | **length on a common baseline, zero origin** (Cleveland–McGill rank 2) | **LF = 1.0000 on the declared domain [0,1]** (verified over 20 samples, no collisions). Out of range: **LF = 0.8889, 15 collisions** — the clamp at `:22` saturates. Currently *dead code* for `SocietalDora.compute` output (all four rendered fields are fractions or convex means by construction, `SocietalDora.fs:116-153`) but **live for any hand-built `Metrics` record**, which the public record type permits. |
| Heat → temperature | `src/Core.TypeScript/darkhall-ui/heat.ts:237-242` | magnitude → ppm | **FAIL.** Saturates at **16 units** (`maxUnits` default). Verified: `LF(16→32) = 0.5000`, `LF(16→100) = 0.1600`, `LF(16→1000) = 0.0160`. 24 collisions over units 1..40. |
| Temperature band | `heat.ts:278-284` | 4-level ordinal (cold/warm/hot/critical) | **FAIL, and worse than the above.** Verified: band reaches `critical` at **11 units** and stays there for 11, 100, 1000, 1 000 000 — identical readout. |
| Black-body radiance | `heat.ts:315-319` | branch-free integer `T⁴` | **Dead zone.** Verified: radiance ≡ 0 for all `T < 31623` ppm (**3.162% of full scale**). The counterexample to "branch-free ⇒ faithful". |
| Thermal fold | `heat.ts:286-288` | `max(heat, uncertainty, pressure)` | **Non-injective fold** — three distinct causes collapse to one number and *which one* is unrecoverable from it. Mitigated only because `TemperatureReadout` (`:303-312`) carries all three alongside. Remove that and the surface loses the cause. |
| Adinkra glyph / dashing | `src/Core/AdinkraViz.fs:64`, `:100-116` | nominal shape + dash | **Faithful.** Total injective map onto a 2-element alphabet. The `if` is a lookup table. |
| Adinkra layout | `AdinkraViz.fs:66,72` | — | index branch, harmless |
| Co-empowerment / metaspace graphs | `CoEmpowerGraphSvg.fs:34`, `MetaspaceGraphRender.fs:46` | — | index branch (`j > i` undirected dedup), harmless |
| ZetaId glyph | `src/Core/ZetaIdViz.fs:45` | nibble → glyph, bit-reversed | ~~bijective, harmless~~ **WRONG — see the correction below** |

### The confirmed instance of "correlated coincidence over time"

`temperatureBand` is the coinage's textbook case, and it is live:

- it **varies plausibly** — cold → warm → hot → critical, exactly as an operator expects;
- it **correlates with what you care about** — more heat rejection does move it, up to 11 units;
- above 11 units it **measures nothing**, and there is no visual difference between a room shedding
  11 units and one shedding a million;
- and **repeated observation strengthens false confidence**: seeing `critical` hold steady across ticks
  reads as *"the situation is stable and bad"* when the true reading is *"the instrument is pinned and
  has stopped reporting."*

A stuck gauge and a steady reading are indistinguishable on this surface. That is the same defect as a
vacuous check — a surface reporting a state it could not have measured — and it is why the vacuity
discipline and the visualization discipline are **one discipline with two surfaces**:

> A **vacuous check** reports a state it could not have measured.
> A **lying chart** depicts a state its data does not support.
> Both are a surface decoupled from its substrate; both are detected by asking *what input would change
> this output?*, and both fail when the answer is *"none."*

The repo already has the adjacent instance on file:
`docs/research/2026-08-10-phase-clock-prng-is-2-to-1-arithmetic-shift-breaks-bijectivity.md` — a 2-to-1
map where a bijection was assumed. **Same property, different surface.** Injectivity is the shared
invariant.

## 7. The both-audiences claim — argued, not affirmed

Aaron: *"AI can also have similar meaning cause the equations are obvious for the visualization since we
don't have if statements."*

**The case for.** A human reads the rendered geometry through the visual cortex; an AI reads the encoder
source directly. If they are reading the same function, they carry the same meaning.

**The case against, which is the brief's own objection and it is correct.** A human reads the **output**;
an AI reads the **generator**. Those are different objects. They agree only if the rendering is faithful
— which is the very property under examination. Stated as a corollary of inspectability, the claim is
circular.

**The resolution, and it is sharper than either side.** The two audiences are equivalent **exactly when
the encoder is injective**:

- If `e` is injective, the output **determines** the input. A reader of the output recovers precisely
  what a reader of `(generator, input)` recovers — same information, two routes, no privileged one.
- If `e` is **not** injective, the output-reader's route is **strictly lossier**, and — this is the part
  that matters — **neither party can detect the divergence from their own side.** The human sees a
  plausible `critical`; the AI reads a correct `Math.min`; nothing in either view is wrong; the meanings
  differ anyway.

So Aaron's two claims — *doesn't lie to humans* and *same meaning for AI* — **reduce to the same
condition**, injectivity of the encoder. That is a genuine unification rather than a restatement, and it
is why this is a junction point: one property buys both audiences.

**Two honest limits on that resolution:**

1. *"Recovers in principle"* is load-bearing and is doing real work. A human does not invert a function;
   they **perceive**. Cleveland–McGill measures exactly the gap between mathematical invertibility and
   perceptual recovery. So injectivity gives sufficiency **in principle** and channel-choice gives
   sufficiency **in practice** — two conditions, not one, and only the first is checkable by a linter.
2. This is **not** the same-seed convergence thesis. Same-seed convergence is about two minds reaching
   the same conclusion from the same generator. Here the two parties read *different objects* and the
   claim is that the objects are informationally equivalent. The correct in-repo anchor is the **shared
   referent** frame (`2026-07-02-homoiconic-page-breaks-the-chinese-room-shared-referent-not-instructions.md`),
   not same-seed.

**The one empirical data point, and its exact scope.** 2026-06-12: Lior, reading only a rendered adinkra,
listed the dashed edge colours and omitted red — matching the Clifford sign rule (edge `(v, bit 0)` dashes
iff `v` has an odd number of set bits *below* bit 0, of which there are none, so **red never dashes**)
**without knowing the rule**. A human produced a checkable statement about the generator by looking at the
output. That is real evidence for the both-audiences claim.

Its scope is narrow and should not be overstated: **dash/solid is a nominal channel with two values and a
total injective mapping** — the easiest possible case, and precisely the case where §7's condition holds.
It licenses nothing about magnitude channels. The 2026-06-12 doc already carries the right bound (*"the eye
is the third oracle in the stack; the byte-lock stays with the language oracles"*) and this analysis
supplies the reason: **the eye is a valid oracle exactly where the encoder is injective.** Where it is not,
the eye and the generator can disagree with neither able to notice.

## 8. The proposed check — and the demonstration that it fires

Work-item: `workitems/081M00TYT8N087G0R003MPMRX9-encoder-faithfulness-audit-injectivity-lie-factor-over-data.md`

**Shape.** A registry of declared encoders, each carrying `(function, declared domain, declared origin,
declared reading protocol)`. The audit samples the declared domain and asserts (a) **injectivity** and
(b) **`|LF − 1| < ε`** over pairs.

**It fires on real code. The mutant was not planted — it already exists.** Run against
`origin/main@fd02d1ee1`:

```
--- existing repo encoder ---
FAIL  heat.ts heatReceiptPpm (units -> temperature ppm)
        injective: NO — 24 collisions, e.g. e(16) == e(17)
        worst lie factor: 0.9412 at (16 -> 17)

--- CONTROL: a genuinely proportional (branch-free, injective) encoder ---
PASS  proportional  ppm = units * 62500 (no clamp)
        injective: yes

--- SocietalDoraSvg.pct, transcribed ---
PASS  pct on the DECLARED domain [0,1]        worst lie factor: 1.0000
FAIL  pct on an OUT-OF-RANGE domain [0.5,3.0]  injective: NO — 15 collisions; LF 0.8889
```

Both directions demonstrated: it **fails** on a real defective encoder, and it **passes** on a control
and on a correct encoder over its declared domain. It is not the twelfth structurally-cannot-fail check.

**Honest limits, which must be displayed by the check rather than hidden by it:**

- It can only audit encoders **exposed as pure numeric functions**. An encoder inlined into a template
  string or JSX attribute — the common case in `src/Renderers/website/` — is invisible to it. Per the
  2026-08-13 coverage requirement, the audit must **display the un-audited set**, or it recreates the
  exact defect it is auditing for.
- It **cannot** detect a truncated baseline without a declared origin. The origin is a *declaration*, not
  an inference. An encoder registered without one is `unmetered`, never `pass`.
- Sampling is not proof. For a readable function, linearity-through-origin is provable by inspection; the
  sampled check is a **regression guard**, not the theorem.
- It says nothing about §5's channel condition. LF = 1 on an area encoding still misleads. That half is
  Cleveland–McGill's and is a design review, not a linter.

## 9. Owned errors and corrections

- **Correction to the brief.** The brief asked me to plant a mutant and show the check fires, then remove
  it. I did not plant one — `heat.ts:237` is a real, live saturating encoder on `main`, so the check was
  demonstrated against genuine defective code plus a control. That is strictly stronger evidence than a
  planted mutant, and the deviation is flagged rather than silent.
- **A display vacuity in my own audit probe.** The probe prints `worst lie factor: 1.0000 at (0 -> 0)`
  for a passing encoder — the reported coordinate pair was **never measured**, because the update
  condition `|log(lf)| > |log(worst)|` is false when `worst = 1`. The "no violation" case prints a
  measurement-shaped string that is not a measurement. Caught in a doc about exactly this failure; any
  landed version must print *"no violating pair found"* rather than a fabricated pair.
- **Anchors are cited from standing knowledge, not page-checked.** Tufte's LF formula and the
  Cleveland–McGill ordering are load-bearing in §5 and must be page-checked before either is quoted on
  an outward surface.
- **`SocietalDoraSvg`'s clamp is currently dead code**, and I say so rather than reporting it as a live
  bug. Its cost is latent, not present: it converts a future out-of-range regression into a plausible
  chart instead of a visible failure.

## 10. Open

1. **Register the encoders.** The audit needs a declared set with domain, origin, and reading protocol.
   The declaration is the forcing function; the linter is secondary.
2. **`UnitInterval` (or the existing `Bound` DU) at the `SocietalDoraSvg` boundary**, retiring the clamp
   at `:22` by relocating it upstream (Refinement C).
3. **`heat.ts` saturation is a real defect, not a style issue.** Either widen `maxUnits` from an
   observed maximum, switch to a declared log protocol, or render the pinned state *as pinned* — a
   saturated gauge must be visibly distinct from a high reading. Filed in the work-item.
4. **Rank the repo's channels against Cleveland–McGill.** Iris's BASE layer already forbids
   value-as-hue (Bertin); the ordered ranking would make channel choice metered rather than tasteful.
5. **Decide whether the grammar-of-graphics formulation is adopted explicitly.** Wilkinson/Wickham is
   the branch-free stance with 27 years of prior art; adopting the vocabulary is cheaper than
   re-deriving it.

## 11. Addendum — applying the repo's own homoiconicity falsifier to the gallery

Aaron pointed at an existing falsifier rather than letting this be re-derived. From
`workitems/081KX93R6EF08QG0R0020AQQWZ-math-team-route-formalize-the-adinkra-clock-fork-homoiconic.md:105`:

> **"A genuine discriminator must compute the clock and the structure by *independent* routes and check
> whether they *must* agree, rather than counting the same event twice."**

— and the failure mode it names: **"The coincidence was built in, not derived."** Generalized: for any
claim that *code and data are the same thing*, compute both views by independent routes and check whether
agreement is **forced**. If agreement is true by construction, the claim is **a definition wearing a
finding's clothes**.

`hall/gallery/index.html:7,42` carries the strongest such claim on any visual surface here — the shape
catalog as *"a program that is its own picture"*, *"generated from a text cartridge, byte-locked"*.
Applied by **looking at how the goldens are produced**, not by reasoning about it:

### Finding 1 — the golden lock is agreement by construction

`tests/Tests.FSharp/ShapeAcceptance.Tests.fs:55-60`:

```fsharp
let golden ext = File.ReadAllText(Path.Combine(repoRoot (), "db", "shapes", "golden", s + "." + ext))
Assert.Equal<string>(golden "svg", ShapeRender.toSvg d)
```

The golden is compared against **the generator's own output**, and `src/Core.FSharp.Cli/Program.fs:16`
confirms the production route: *"SVG/HTML are regenerated, never edited (sync by golden lock)."* The
golden **is** the recorded output of the function it is checked against.

**Verdict: this proves determinism — real, useful, and a genuine `no-binary-in-proof-lineage` win — and
it establishes nothing whatever about homoiconicity.** The coincidence was built in.

### Finding 2 — but the independent route already exists, and it has actually fired

`src/Core/ShapeAcceptance.fs` is the discriminator, and it predates the work-item that names the
discipline. Amara's carved sentence in its header (2026-06-12) *is* the falsifier:

> *"no shape is accepted because it looks good — it is accepted because its generated geometry satisfies
> its known-answer checks … A shape with no known-answer law CANNOT pass geometry — looks are not a law."*

The gate does not compare bytes. It computes a **mathematical known-answer law** and checks the geometry
against it — 20 shapes carry laws (`ShapeAcceptance.fs:41-478`): the braid word's permutation must be the
identity and must equal its Artin twin, the worldline must stay inside the lightcone, the fourcorner must
reach exactly its declared Tsirelson width. **The default at `:479` is fail-closed** — *"no known-answer
law for this shape — geometry cannot be accepted on looks"* — which is the exact opposite of the vacuity
class.

**And it has failed in practice**, which is the only evidence that matters. `ShapeAcceptance.fs:48-50`:

> *"bounds joined the law after Aaron's eye caught the 1100 escape — growth alone was never the whole
> claim; 'visibly logarithmic ON THE COURT' is."*

A check that was strengthened because it missed a real defect a human eye caught is a falsifier with a
service record. This is also a second data point for §7: the eye caught what the law did not.

### Finding 3 — the gap, and it is exactly where the lie factor belongs

**Nothing anywhere reads the rendered SVG and asks what data it depicts.**

- For 16 of the 20 laws the gate **recomputes** the geometry (e.g. `BoundaryLight.rotorCurve`, invoked
  identically at `ShapeAcceptance.fs:45` and `ShapeRender.fs:80`) and never reads what was drawn. The
  *predicate* is independent; the *computation* is shared.
- For 4 laws it reads `ShapeRender.strokesOf` — the drawn strokes, the closest thing to a return route
  (`:141, :208, :355, :443`). To the repo's credit, `:442` flags the caveat itself: *"drawn = gated by
  the SAME computation (ShapeRender.sybilProbesOf, one source)."*
- The stroke list is the **last common representation**. The projection *strokes → SVG path bytes* is
  checked **only** by the golden lock — i.e. only by construction.

**So the claim is half-discharged.** The *program* half has a real, fired falsifier. The *picture* half —
that the rendered marks depict the data — has only a byte-lock.

**And this closes the loop on §5.** A branch-free encoding "unable to lie" is the same claim shape and
subject to the same falsifier: if the only evidence a rendering is faithful is that the rendering function
produced it, that is agreement by construction. **Tufte's lie factor is precisely the independent route** —
it measures the effect *in the graphic* against the effect *in the data*, computed separately, from the
artifact rather than from the generator. So the lie factor is not merely a useful metric here:

> **It is the second route that makes the faithfulness claim falsifiable at all.**

That upgrades §5 from an assertion to a claim with a discharge condition, and it names what §8's audit is
actually for.

### Finding 4 — a correction that contradicts the suggestion I was given

I was told the gallery might be the *weaker* instance and `clis/README.md:90-107` (F# ≅ CLI ≅ filesystem)
the stronger, on the grounds that those three are implemented by genuinely independent systems. **Checked,
and I disagree**, with a reason:

`clis/README.md` has **no computed agreement at all** — no test, no gate, nothing executed (`rg` over
`tests/` finds no falsifier for it). The claim is a **structural resemblance asserted in prose**: the F#
pipe `|>`, the shell pipe `|`, and the MerkleDAG walk are *"the same act over the same representation."*
Independence of the *systems* is necessary but **not sufficient** — the falsifier requires an executed
computation whose agreement **could have come out otherwise**. Prose about three independent systems
supplies independence without a measurement.

So by the falsifier's own standard: **the gallery is the stronger instance**, because it has a
discriminator that has actually fired; `clis/README.md` has independence without a computation and is
**undischarged, not merely partially discharged**. Neither is established. The gallery's shortfall is a
*missing second route for the picture half*; `clis/README`'s is a *missing route entirely*.

**Follow-on, not filed here** (a separate surface from this doc's encoder work): give the `clis/README`
claim a falsifier or downgrade its register — a test walking the same path through the F# API, the CLI,
and the filesystem, checking the three results are forced to agree, would settle it and would be cheap.

---

*Explicit unindexed rationale: this doc is a same-day ferry + analysis; the memory-substrate index entry
lands with the follow-up work-item rather than in this PR.*

**Attribution:** Aaron 2026-08-14 set the observation and the claim (§1, verbatim). shadow (Otto)
ferried it, wrote §2–§10, ran the encoder probes, and owns the errors in §9.

---

## CORRECTION 2026-08-19 — the ZetaId glyph row was wrong, and the error is a class

**Verdict retracted.** Both rows above (`:126`, `:196`) cleared `ZetaIdViz` as "bijective, harmless"
on the strength of `ZetaIdViz.fs:45`. That line is the **inner** nibble→byte bit-reversal, and the
survey is right about it: 16 nibbles → 16 distinct bytes, a bijection.

**Line 45 is not the encoder.** The encoder was line 41 — `(id >>> row*4) &&& 0xF` — which reads
bits 0..31 of a 128-bit ZetaId and throws the other 96 away. Bits 0..31 are exactly the
`Randomness` field (`Core.FSharp.ZetaId/BitLayout.fs`), so the identicon drew the CSPRNG suffix and
nothing else. Measured against compiled `Zeta.Core`: **1000 ids differing only by timestamp drew
ONE glyph; 42 ids spanning Category × Persona × Location drew ONE glyph.**

`bijective(g)` does not give `injective(g ∘ f)` when `f` is lossy. A bijection applied *after* a
projection is still a projection.

**The class — inner-map injectivity asserted for the composition.** An audit that cites a
`file:line` *inside* an encoder rather than the encoder's own domain→range is exposed to it: the
check ran, it just was not checking the thing the verdict named. Same vacuity shape as an assertion
that cannot fail. This survey's own stated standard — *"total, injective from the data's **actual
domain**"* — is the correct test and would have caught it; it was not applied here because the
domain examined was the nibble, not the id.

Fixed in two steps. #12533 replaced the truncation with an XOR of the four 32-bit lanes — which
removed the *truncation* and kept a *structure*, because XOR over GF(2) is linear and every ZetaId
field is a contiguous bit-range, so any two bit positions exactly 32 apart cancel exactly. Measured
on that fold: two ids differing only in timestamp by `1 + 2^32` ms drew a byte-identical glyph
(16 of 16 such deltas), and an Observation and an Emission drew a byte-identical glyph when the
category delta was cancelled by one timestamp bit. `zetaid.glyph` v2
(081M0DYG9X9087G0R002JK171Z) folds through `fmix64` instead, so the 32-bit resolution is
**declared** rather than accidental — which is what §"Refinement A" above asks for.

**Second-order lesson, and the reason this correction is longer than the row it fixes:** the
survey's three-class taxonomy (index / total-categorical / non-injective-magnitude) has no bin for
*linear* encoders. A lane-XOR is not a clamp, not a threshold, not a lossy fold in the sense
Refinement B means — it is total, branch-free, and every input bit reaches the output, so it passes
every test the taxonomy offers and still collides on a 96-dimensional field-aligned subspace. A
fourth class belongs here: **structure-preserving compressors**, where the failure is not that
information is thrown away but that the *algebra of the input* survives into the output.
