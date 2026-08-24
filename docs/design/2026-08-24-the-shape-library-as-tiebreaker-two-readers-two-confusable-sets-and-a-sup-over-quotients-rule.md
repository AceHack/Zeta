# The shape library as tiebreaker: two readers, two confusable sets, and a sup-over-quotients rule

**Ferried** 2026-08-24 from Aaron. His words are the primary artifact; everything after §1 is
Iris's analysis, and the errors in it are hers.

---

## 1. The ferry (verbatim - Aaron 2026-08-24)

> We have a **shape library to disambiguate shapes based on visual representation as the ultimate
> tiebreaker** - and a space where humans can be fooled by certain evolutionary tricks on the eyes,
> because of what our brains are trained to ignore or generate. This is well studied, and **AI is
> good at avoiding these overlaps in perception**, from my experience so far.

---

_(Everything below is Iris's analysis.)_

## 2. Why "tiebreaker" changes the requirement

`.claude/rules/anti-babel-preserve-reconcilability.md` lists _"shape/visual agreement"_ as a carrier
that **does not route through words at all**. That is the load-bearing sentence. A shape is not a
nicer way to say a thing; it is what is consulted **after** vocabulary has stopped being reliable.

That gives shape confusability a property no other UX defect has:

> **A tiebreaker that is itself ambiguous is worse than no tiebreaker, because it is consulted
> exactly when every other channel has already failed.**

Ordinary ambiguity is caught downstream - context, a follow-up question, a second reading. A
tiebreaker has no downstream. It is the last resort by construction, so an error there is not
merely uncaught, it is **structurally uncatchable**. And per the 2026-08-19 doc, a confusable mark
produces a **confident misread**, not a hesitation, so the reader will not report it either.

This is why the sections below treat confusability as a correctness property and measure it,
rather than describing it.

## 3. What exists - built, stated, and aspiration, measured not assumed

| surface | status | what it actually covers |
|---|---|---|
| `db/shapes/golden/*.svg` - 23 vector cartridges | **built** | the shape library Aaron is describing |
| `db/shapes/cartridges/*.lines` - their sources | **built** | with per-oracle ratification treaties |
| `src/Core.TypeScript/cluster/state-du.ts` - 8 glyphs | **built** | the state DU's mark vocabulary |
| `visual-skeleton.ts` - UTS #39 skeleton over glyphs | **built** | **glyphs only**; table-driven on Unicode names |
| `audit-visual-confusability.ts` TIER 1/2/3 | **built, gating** | **glyphs only** - skeleton, hue-alone, ASCII |
| `audit-visual-confusability.ts` TIER 0 over the catalog | **built, gating, near-vacuous** | **SHA-256 byte identity** and nothing else |
| a perceptual check over the 23 vector shapes | **was aspiration** | filed 2026-08-19 as `081M0DN91SH087G0R003NKKCTB`, §12.3 |

**So the finding is not "the library was never checked" - it is narrower and worse.** The _glyph_
alphabet is genuinely guarded, in three tiers, with controls. The **vector shape library - the
thing Aaron calls the ultimate tiebreaker - was guarded only by byte identity.** That check fires
only when two entries are the _same file_. One differing coordinate and it is silent, for any
pair, however identical they look. §7's sabotage test demonstrates exactly that.

This doc closes the measurement half. It does **not** land a gate; see §8.

## 4. The human failure modes, with what each anchor does and does not establish

Aaron's _"well studied"_ is correct, so these are cited specifically rather than gestured at.
**Cited from standing knowledge and not page-checked in this session** - the same honest limit the
2026-08-19 doc declared. Two of them do real work below; the rest bound the problem.

- **Amodal completion (Michotte 1964) and illusory contours (Kanizsa 1955).** **Entails:** the
  visual system _generates_ structure that is not in the stimulus - a contour interrupted by an
  occlusion cue is perceived as continuing behind it, and edges are seen where no luminance step
  exists. **Does not entail:** any threshold. **This is the load-bearing anchor for §6's headline
  finding**, and it is the sharpest form of Aaron's _"what our brains are trained to ignore or
  generate"_ - his two verbs are exactly the two mechanisms.
- **Crowding (Bouma 1970; Pelli, Palomares & Majaj 2004; Levi 2008).** **Entails:** in peripheral
  vision a flanked target becomes **unidentifiable while remaining detectable**, with critical
  spacing about 0.5x eccentricity (Bouma's law). **This is the one anchor here that supplies a
  quantity**, and it applies to _identification of nominal items_, which is precisely our channel.
  Note this **admits** a metric the 2026-08-19 doc was right to refuse in its other form: Weber's
  law was refused as a category error because a mark alphabet is not a magnitude continuum, and
  that refusal stands - Bouma's law is a _spacing_ law on nominal identification, not a JND on
  magnitude, so it is admissible where Weber was not. **Consequence:** a mark read out of the
  corner of the eye in a dense dashboard is subject to a constraint no side-by-side inspection
  reveals, and every check in this repo is a side-by-side inspection.
- **Mirror-invariance (Corballis & Beale 1976; Rollenhagen & Olson 2000; Dehaene et al. 2010).**
  **Entails:** human and primate vision generalises across **left-right** reflection specifically -
  it must be _unlearned_ during literacy, which is why `b`/`d` is hard and `b`/`p` less so.
  **Does not entail:** invariance to arbitrary rotation. **Consequence:** left-right reflection is
  a member of the quotient family, not a separate concern. Measured in §6.
- **Gestalt grouping - good continuation and closure (Wertheimer 1923).** **Entails:** elements are
  grouped into the smoothest continuous path, and near-closed forms are completed. **Cited for
  mechanism only; supplies no metric.** It is the reason an X reads as two straight lines rather
  than four rays meeting - which is what makes §6's pair collide in the first place.
- **Change blindness (Rensink, O'Regan & Clark 1997; Simons & Levin 1998).** **Entails:** large
  changes go undetected when the transient that normally flags them is masked. **Consequence,
  and it is not the one it looks like:** the risk is not two marks side by side, it is **one mark
  re-rendered**. A live dashboard that repaints can change a mark's meaning across the repaint and
  the reader will not see the change. No check in this repo looks at that axis.
- **Inattentional blindness (Mack & Rock 1998; Simons & Chabris 1999).** **Entails:** an
  unattended stimulus goes unreported though fully visible. Supports evaluating marks _under real
  viewing conditions_ rather than under inspection. **Does not entail:** a confusability metric.
  Already anchored in the 2026-08-19 doc.
- **Muller-Lyer (1889); Ebbinghaus/Titchener.** **Entails:** judged **length and size are distorted
  by surrounding context**. **Does not entail:** anything about shape identity - so these are
  _not_ anchors for the mark vocabulary, and using them there would be padding. They anchor a
  different finding, §6.4.

## 5. The asymmetry, tested rather than assumed - there are THREE readers, not two

Aaron framed his claim honestly as _"from my experience so far"_. Taken as a hypothesis it does not
survive contact with the obvious counter-case, and the repair is more useful than the claim.

The error is that "AI" is not one reader. Splitting it is what makes the picture coherent:

| reader | mechanism | its confusable set | is it what consults the tiebreaker? |
|---|---|---|---|
| **exact** | SHA-256 / codepoint equality | **measure zero** - byte identity only | only in a build gate |
| **human glance** | low-pass, completion, crowding, mirror-invariance | **large** - see §6 | yes |
| **learned** | learned visual features (VLM / CNN) | **different again** - see below | **yes, and increasingly** |

**Aaron's claim is TRUE of the exact reader and NOT ESTABLISHED for the learned one.** A hash never
confuses circle-with-a-gap with circle-without; that is real and it is the reader he has been
watching. But an agent that _looks at a rendered diagram_ is the learned reader, and three
established results say its confusable set is neither empty nor the human's:

- **Szegedy et al. 2014; Goodfellow, Shlens & Szegedy 2015.** **Entails:** imperceptible
  perturbations flip classification - so the learned reader's confusable set contains pairs that
  are far apart for **both** the exact and the human metric. **Does not entail:** that this
  happens on clean, non-adversarial inputs like our SVGs.
- **Ilyas et al. 2019, _Adversarial Examples Are Not Bugs, They Are Features_.** **Entails:** those
  are genuinely predictive non-robust features, not noise - so the machine metric is **a different
  metric, not a degraded copy of the human one.** This is the strongest support for two sets rather
  than one.
- **Geirhos et al. 2019, texture-vs-shape bias.** **Entails:** ImageNet-trained CNNs classify by
  **texture** where humans classify by **shape**. **Does not entail:** that current VLMs do, which
  is why the consequence below is `unmetered`.

**That last one inverts a rule we already shipped, and it is the finding I did not expect.** The
2026-08-19 criterion says _base form_ carries the claim class and _fill texture is not a channel at
all_. For a human that is correct and measured. For a texture-biased reader it is **exactly
backwards**: we would be spending our capacity on the channel it discounts and discarding the one
it uses. The two readers may weight our channels **inversely**.

So the honest conclusion is not Aaron's and not its negation:

> **Human-confusable and machine-confusable are different sets, and a tiebreaker serving both must
> clear the UNION.** The exact reader contributes almost nothing to the union, which is why relying
> on it - as TIER 0 does - looks like coverage and is not.

## 6. What fired - the measurements

`bun src/Core.TypeScript/hygiene/report-shape-confusability.ts`. Occupancy grid with square cells
(640x320 rasters to 64x32), mean-centred correlation, box-blur radius `r` as the declared quotient
parameter. 19 of 23 goldens are pure `<polyline>` and rasterise exactly; 4 do not and are reported
UNAUDITED. Across 171 pairs the sup is: **min -0.108, median 0.227, p90 0.509, max 0.819.**

```
   sup   slope  mirror |   r=0    r=1    r=2    r=3    r=4  |  r=6    r=8   pair
  0.819 +0.754  0.804 | 0.172  0.594  0.723  0.781  0.819 | 0.882  0.926  crossing ~ lightcone
  0.778 +0.191  0.731 | 0.681  0.699  0.727  0.753  0.778 | 0.827  0.871  braid ~ plait-move
  0.735 +0.733  0.669 | 0.144  0.417  0.568  0.646  0.735 | 0.841  0.877  spiral ~ sybil-verdict
```

### 6.1 `crossing` ~ `lightcone` - the glance-only class, and the mechanism is precise

Both marks are **an X centred on the identical point (325,165)** in the identical 640x320 frame.
Everything that separates them:

| channel | `crossing` | `lightcone` | survives a glance? |
|---|---|---|---|
| arm slope | 51.3 deg | 45 deg | a 6.3 deg difference, absent a side-by-side: no |
| hue assignment | red NW-SE strand, blue NE-SW | blue arms up, red arms down | **hue alone is not a distinction** |
| **an occlusion gap** | **51 px break in one arm** | none | **§4 says this is the one thing vision erases** |

**The gap is the entire semantic payload, and it is the one feature the visual system is built to
remove.** `crossing` means _"who crossed OVER whom is remembered"_ - the braid generator, where
sign is the meaning. That over/under fact is encoded as **a break in the under-strand**, and the
break is drawn _as an occlusion cue_ - which is an explicit invitation to amodal completion, whose
entire function is to continue a contour behind an occluder. The mark asks the visual system to do
the thing that destroys its content. Complete the gap and `crossing` **is** `lightcone`: a
continuous X.

`lightcone` means causal structure - past and future cones. The two meanings share nothing. Reading
one as the other substitutes a **causal** claim for a **braid-order** claim.

The curve is the signature: **0.172 at exact geometry, 0.819 under a glance.** An exact reader sees
two unrelated pictures. A human sees one. **This is the class TIER 0 is structurally blind to**, and
it is the majority of the flagged pairs - which is empirical support for Aaron's direction even
though his claim needed splitting.

### 6.2 `braid` ~ `plait-move` - the both-readers class

**0.681 at r=0**, against a catalog median of 0.227 - a large outlier at _exact_ resolution, and
nearly flat across the family (slope +0.191). Both readers confuse these. They share literal strand
coordinates, which the 2026-08-19 doc predicted and which is **intentional**: `plait-move` is the
unit move and `braid` is that move repeated to its period.

The intent does not settle it. Their own cartridges say the distinction is **gate versus memory,
operation versus storage** - so confusing them is confusing an operation with the thing it operates
on. Whether a deliberately-similar pair is acceptable is a design decision, not a measurement, and
it is Kenji's. What the measurement supplies is that the similarity is real and is the largest in
the catalog at exact resolution.

### 6.3 The unaudited four, and why they are the worst place to have a hole

The 4 `quantum-circuit-*.svg` use `<path>/<rect>/<text>` and this metric cannot parse them. They
are **reported** as UNAUDITED, never counted as passing. But note what they are: the
`bell-coincidence-singlet` / `singlet-chsh` pair is **TIER 0's only real catch ever** - two
byte-identical circuits, found 2026-08-19. So the sub-catalog with the one demonstrated collision
history is precisely the sub-catalog the stronger metric cannot see. They are now covered by the
weakest check alone.

### 6.4 A separate gap, in the design language rather than the catalog

`docs/design/design-language-base-corporate-sovereign.md:42` says soft values render as
`(value, epsilon)` bars, fill = value. It states **no shared-baseline discipline**. Two anchors bear
on this and neither is about shape: **Cleveland & McGill (1984)** measured position-along-a-common-scale
as more accurate than length-without-a-common-baseline, and **Muller-Lyer / Ebbinghaus** establish
that judged length and size are distorted by surrounding context. Together: **bars floated in
different surrounds are not comparable, and the language does not say so.** Flagged for Kenji;
this is a one-sentence addition, not a redesign, and it is not mine to make.

### 6.5 Mirror

The `mirror` column is correlation against the left-right reflection at the sup radius. For the top
pairs it tracks the direct value closely (0.804 vs 0.819 for `crossing`~`lightcone`), so reflection
adds no _new_ collision at the top of the ranking. It matters elsewhere: `adinkra` is perfectly
bilaterally symmetric (self-mirror 1.000) so reflection costs it nothing, while `gc` (0.000) and
`worldline` (0.191) are strongly chiral - **for those, a renderer that ever flips the frame changes
the picture silently.** Recorded, not filed.

## 7. The design rule

> **THE TWO-READER TIEBREAKER RULE.** Two marks that mean different things must be separated for
> **every reader that may consult them** and under **every quotient in the declared family** - so
> the guarded quantity is the **supremum of similarity over the family**, never the value at one
> coarseness. Specifically:
>
> 1. **Sup, not a point.** A pair passing at exact geometry and failing under a low-pass has not
>    passed. `crossing`~`lightcone` is 0.172 at r=0 and 0.819 at r=4; a single-coarseness check
>    picked at r=0 would report it clean.
> 2. **The slope names the reader at risk.** A steep rise across the family is a **glance-only**
>    defect, invisible to exact comparison. A flat, high curve is a **both-readers** defect. These
>    require different repairs and sup alone cannot tell them apart.
> 3. **Left-right reflection is a member of the family**, not a separate check - human vision
>    generalises across it (§4).
> 4. **Meaning must never rest on a feature the visual system completes.** A gap, a dotted outline,
>    a near-closure: all are erased by the mechanisms in §4. `crossing`'s occlusion gap is this
>    violation live. The 2026-08-19 corollary that a full-diameter _strike_ survives blur is the
>    same rule with the sign flipped - **added ink survives, removed ink is filled in.**
> 5. **Where the two readers weight channels inversely (§5), the difference must be carried on
>    BOTH channels.** You do not get to choose which reader consults the tiebreaker.
> 6. **Unparseable is UNAUDITED, never PASS.** A check that silently skips what it cannot see is
>    the defect it exists to catch.

**How it is checked:** `report-shape-confusability.ts` computes the full matrix; a pair above the
p90 of the sup distribution with slope > 0.4 is a glance-only candidate, above p90 with a flat
curve is a both-readers candidate. The falsifier that this is not redundant with the existing
TIER 0 is in `shape-occupancy-skeleton.test.ts`: **a one-coordinate edit changes the SHA-256
completely (TIER 0 goes silent) and moves this metric by less than 0.01.**

## 8. Why this ships as a report and not a gate

Making it a gate would fail `main` today and force a redesign of `crossing` or `lightcone`.
Choosing the threshold and choosing which shape moves are architect decisions. Iris is advisory on
landing (`docs/EXPERT-REGISTRY.md`), so this ships as: the metric, its falsifiers, the matrix, and
the rule. **Kenji decides** whether the threshold gates, and **whoever owns `crossing`** decides how
it separates - the obvious repair is to move the over/under information off the gap and onto added
ink, per rule 7.4, but that is a proposal, not a change made here.

## 9. The register - which claims are metered

| claim | register | why |
|---|---|---|
| TIER 0 is blind to a one-coordinate edit | **metered** | sabotage test: SHA differs, metric moves < 0.01 |
| `crossing`/`lightcone` are 0.172 at r=0 and 0.819 at r=4 | **metered** | exact arithmetic over committed files; reproducible |
| the two defect signatures are separable by slope | **metered** | pinned by a test that fails if sup alone is used |
| the metric is non-vacuous | **metered** | 3 mutations (blur no-op, no centring, aspect ignored) all go red |
| **a human confuses `crossing` and `lightcone` at size** | **unmetered** | **the model's claim. No forced-choice trial was run.** |
| the blur family bounded at r=4 | **unmetered** | a modelling choice; the likeliest thing here to be wrong |
| **AI avoids these overlaps** (Aaron's asymmetry) | **unmetered** | an honest observation, framed as such by him; §5 splits it |
| the learned reader is texture-biased on OUR marks | **unmetered** | Geirhos is ImageNet CNNs; not measured on VLMs or on SVGs |

**The empirical falsifier for the whole §6 table is cheap and was not run:** a forced-choice trial
at mark size would move the `unmetered` rows either way. Until then, read a high correlation as
_"these two were not separated by a channel we have evidence survives a glance"_ - never as an
error rate.

## 10. Open

1. **Decide whether the sup threshold gates**, and at what value (`p90 = 0.509` is the natural
   candidate from the distribution, not a principled number). Kenji.
2. **Repair `crossing`.** Its meaning rests on a gap, and §4 says gaps are erased. Added ink is the
   direction. Owner's call.
3. **Extend the rasteriser to `<path>/<rect>/<text>`** so the 4 quantum-circuit goldens stop being
   unaudited (§6.3) - the sub-catalog with the only demonstrated collision.
4. **The crowding constraint is unapplied.** Bouma's law gives a real spacing bound for marks read
   peripherally in dense tables, and nothing in the repo checks spacing at all (§4).
5. **The change-blindness axis is unexamined**: a repainting dashboard can change a mark's meaning
   across a repaint unnoticed. No check looks at re-renders (§4).
6. **State the `(value, epsilon)` bar's shared-baseline discipline** in the design language (§6.4).
   Samir/Kenji - one sentence.
7. **Measure the learned reader** rather than citing it. Feeding the 19 goldens to a VLM and asking
   for pairwise same/different would move §5's last row out of `unmetered` in an afternoon.

## Pointers

- `src/Core.TypeScript/hygiene/shape-occupancy-skeleton.ts` - the metric, the quotient family, the limits
- `src/Core.TypeScript/hygiene/report-shape-confusability.ts` - the matrix (report-only, exits 0)
- `src/Core.TypeScript/hygiene/shape-occupancy-skeleton.test.ts` - controls + the TIER 0 sabotage
- `docs/design/2026-08-19-confusable-shapes-are-the-babel-failure-relocated-*.md` - the glyph half; this doc is its §12.3
- `db/shapes/README.md` - the catalog and its Poincare/Thom/Arnold lineage
- `.claude/rules/anti-babel-preserve-reconcilability.md` - shape as the carrier that skips words
- `.claude/rules/toy-is-free-metered-must-be-earned.md` - §9 answers to this

**Attribution:** Aaron 2026-08-24 set the observation, the asymmetry hypothesis, and the
tiebreaker framing (§1, verbatim). Iris wrote §2-§10, built the metric, ran the measurements, and
owns the errors - including the split of his claim in §5, which is a correction to it and may
itself be wrong.
