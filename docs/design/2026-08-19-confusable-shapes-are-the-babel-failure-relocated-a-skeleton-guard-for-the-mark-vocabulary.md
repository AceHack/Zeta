# Confusable shapes are the babel failure relocated — a skeleton guard for the mark vocabulary

**Ferried** 2026-08-19 from Aaron. His words are the primary artifact; everything after §1 is
Iris's analysis, and the errors in it are hers.

---

## 1. The ferry (verbatim — Aaron 2026-08-19)

> for us we try to make things visual shape representable for common agreement without words, we
> just have to make sure to be careful about similar shapes so humans don't see them the same as
> an optical illusion. i've studied magic and optical illusions a lot to try to protect humans
> here.

---

_(Everything below is Iris's analysis.)_

## 2. What already exists — this doc is a layer, not a replacement

Four surfaces already carry most of this ground, and none of them should be rewritten:

- **`docs/design/design-language-base-corporate-sovereign.md`** — BASE: the state-colour DU as
  _meaning, never decoration_; `(value, ε)` bars; frost as the withheld register. The vocabulary
  this doc audits.
- **`docs/design/root-site-iris/_ds/design-system-*/zeta-state.css`** — the DU's definition site,
  and it **already reasons about confusability, by hand, in prose**. Three instances, all correct:
  the model register's strike is _"non-repeating … so it cannot join the withheld register's
  visual family at a glance"_; it is chosen because it is _"a geometry difference, not a hue
  one"_; and the carved sentence **"a distinction carried only by hue is not a distinction."**
- **`src/Core.TypeScript/cluster/state-du.ts`** — the non-visual channel: glyph, ASCII fallback,
  label, sentence, ARIA treatment, per member. Built precisely so the DU survives having its hue
  removed.
- **`docs/research/2026-08-14-branch-free-visual-encoding-is-the-meaning-junction-lie-factor-injectivity-and-what-the-eye-can-check.md`**
  — layers the ways a rendered surface can lie, and its own table names the gap this doc fills:

  | layer            | can lie by                                                   | status in that doc        |
  | ---------------- | ------------------------------------------------------------ | ------------------------- |
  | 1 acquisition    | blind query, stale panel                                     | covered                   |
  | 2 aggregation    | saturation, non-injective folds                              | covered there             |
  | 3 encoding       | `data → geometry` decouples                                  | covered there             |
  | **4 perception** | **the channel is imprecise even when the function is exact** | **"anchored, unapplied"** |

**The one thing that was missing** is layer 4 for the _nominal_ channel. That doc resolved
faithfulness to **injectivity of the encoder** `e : data → geometry`. It is right, and it is only
half the composition. The reader does not receive `e(x)`; they receive `p(e(x))`, where `p` is the
**perceptual quotient** — everything the eye discards at a glance. So the property that actually
protects a reader is:

> **`p ∘ e` must be injective, not `e`.**

An encoder can be perfectly injective and still deliver two distinct meanings as one percept. That
is Aaron's _"humans don't see them the same as an optical illusion"_, stated so it can be checked.

## 3. Why this failure exists at all: shapes trade semantic drift for perceptual collision

The frame this sits in: everyone starts maximally correlated at one seed, decorrelates over time,
and must not hit the **tower of babel** — runaway etymology producing language that cannot be
reconciled. A **shape** resists that, because a mark is a common referent that does not route
through shared etymology. (The in-repo anchor for that half is the _shared referent, not
instructions_ frame —
`docs/research/2026-07-02-homoiconic-page-breaks-the-chinese-room-shared-referent-not-instructions.md`
— not same-seed convergence, which is a different claim.)

**The failure mode does not disappear; it relocates, and it changes character:**

|                    | words                                | marks                                |
| ------------------ | ------------------------------------ | ------------------------------------ |
| drifts by          | etymology, over time                 | nothing — the mark is stable         |
| collides by        | homonymy, slowly                     | **perceptual quotient, instantly**   |
| alphabet capacity  | effectively unbounded                | **small, and fixed by the quotient** |
| failure is felt as | "we are using this word differently" | **nothing at all**                   |

The last row is the dangerous one and it is why this is a security property rather than a
usability note. A word-level divergence _announces itself_: two parties argue, and the argument is
the signal. A confusable mark produces **a confident misread with no hesitation** — the reader is
not aware of having made a choice.

**The third row is the design constraint nobody has stated yet, and it is load-bearing.** Under the
quotient modelled in §5 there are roughly 36 reachable cells (6 base forms × 3 fill classes × struck
or not), and far fewer that are drawable, available in a font, and legible at 12px. **The mark
vocabulary is a scarce resource.** You cannot escape babel by minting more shapes, because minting
more shapes drives you into the quotient. So growth pressure has to go somewhere other than the
shape alphabet, and the alphabet's capacity has to be **spent on the distinctions that must never be
confused** rather than spread evenly over all of them.

That gives the allocation rule in §4, and it is not a preference — it falls out of the capacity
bound.

## 4. The criterion

> **THE CONFUSABILITY CRITERION.** Two marks that mean different things must differ in at least one
> channel that survives the perceptual quotient — and **which** channel is not free. The channel
> must be chosen by the semantic distance it is carrying:
>
> - a difference in **claim class** (observation / model / withheld) must be carried by **base
>   form** — the nominal channel, the one that survives blur, greyscale and low resolution;
> - a difference **within** a claim class may be carried by **fill fraction** — the ordered
>   channel;
> - **hue is never a channel on its own**, in either case;
> - **outline style and fill texture are not channels at all** at mark size, and must never be the
>   only difference between two marks.

The anchor for the nominal/ordered split is **Bertin** (_Sémiologie Graphique_, 1967): shape is a
nominal visual variable and value is an ordered one. That entails the _pairing_ above — carry a
categorical difference on a categorical channel — and it entails nothing about thresholds, which is
the part §5 has to model rather than cite.

Corollary worth stating separately, because it is the one that would have caught all three live
defects: **a check on codepoint identity is not a check on distinguishability.** `state-du.test.ts`
line 128 asserts that every glyph in the DU is unique. It compares strings. `U+25CB` and `U+25CC`
are different strings and the same ring. That test is correct and it is not this test.

## 5. The mechanical guard — a skeleton, in the UTS #39 sense

**This problem already has a standard, in an identity context.** Visually confusable characters
used to spoof identity are **homoglyph / IDN homograph attacks**, and **Unicode UTS #39**
(_Unicode Security Mechanisms_) addresses them with the **skeleton** algorithm: map each candidate
through a table to a canonical prototype, and declare a collision when two prototypes are equal.

```
confusable(x, y)  <=>  skeleton(x) == skeleton(y)
```

A mark-based vocabulary is that attack with the alphabet widened past text, so the construction
transfers directly. What does **not** transfer is the table: `confusables.txt` covers script
homoglyphs and has no useful coverage of the Geometric Shapes block, which is where this vocabulary
actually lives.

So `src/Core.TypeScript/hygiene/visual-skeleton.ts` supplies the table, derived from **Unicode's own
normative character names**, which decompose a geometric mark into (base form, fill) by
construction — `CIRCLE WITH VERTICAL FILL` is a circle, partly filled, and the name says so. Every
row records the normative name it was derived from, so the derivation is auditable rather than
asserted.

**The two quotients are the modelling decisions, and they are where this can be wrong:**

1. **Outline style is quotiented away.** A dotted and a solid ring of the same diameter differ by
   less than a stroke width; low-pass the mark (the designer's squint test) and the dots merge.
2. **Fill texture is quotiented away; fill _fraction_ is not.** Vertical hatching and a solid half
   both read as "partly dark". Fill fraction is Bertin's ordered `value` and survives blur.

A **full-diameter strike** is deliberately _not_ quotiented — it changes the silhouette and survives
blur, which is why `∅` does not collide with `○`, and why the CSS's independent choice of a
non-repeating strike for `unavailable` was already right.

The quotient **over-approximates** deliberately: it merges more than a human does. For a guard,
over-flagging costs a redesign and under-flagging ships a mark that lies, and those costs are not
symmetric.

## 6. What fired — and what landed

> **Status, 2026-08-19.** All three findings below were live on `main` when the guard was written.
> **All three are now closed in this same change**, on Aaron's delegation (_"please try to solve
> all of these without me"_). The guard was mutation-confirmed in both directions: **red on all
> three before the fix, green after**, with the baseline emptied so nothing is suppressed. The
> findings are kept in full below because a doc that erases what it found leaves the reader
> unable to check the guard ever had teeth.

`bun src/Core.TypeScript/hygiene/audit-visual-confusability.ts`, three tiers, weakest first.

### TIER 0 — identity collision: two names, one picture

```
[ERROR] quantum-circuit-bell-coincidence-singlet.svg == quantum-circuit-singlet-chsh.svg
        are byte-identical (sha256 10936a1b…)
```

No perceptual model is needed for this one: **nothing distinguishes them for any observer, machine
included.** Verified at the source — `src/Core.TypeScript/quantum-observable/generate-circuit-svgs.ts`
builds `singletChsh` (lines 31-38) and `bellSinglet` (lines 51-58) from the **identical gate
sequence**: `h(0)`, `cx(0,1)`, `x(1)`, `z(1)`, `ry(0, 0)`, `ry(1, -π/4)`. Two catalog entries, one
circuit.

This is the 2026-08-14 doc's **"agreement by construction"** defect appearing one level up. The
golden lock compares each shape to _its own generator's output_ and never across entries, so a
catalog-wide collision is structurally invisible to it. `ShapeAcceptance.fs` — the genuinely strong
gate, which checks known-answer laws and fails closed — is a **per-shape** law and equally cannot
see a pair. **RESOLVED — and the finding is not the one it looks like.** Not "the generator emitted wrong
bytes", and not "the catalogue had a duplicate row". It is that **a single CHSH corner IS a
coincidence measurement** at those analyzer angles — nothing distinguishes them because there is
nothing to distinguish. Minting a second name for one experiment was the error.

So the repair draws a corner a coincidence measurement _cannot_ be: `singletChsh` now renders
**E(a1, b1)** (`a1 = π/2`, `b1 = −π/4`), the only corner carrying the `−1` coefficient in
`S = E(a0,b0) + E(a0,b1) + E(a1,b0) − E(a1,b1)`, with both analyzers rotated. The angles are the
canonical singlet configuration already pinned in `quantum-observable.test.ts:38`, so the file now
agrees with the oracle's own corner table instead of restating one of its rows twice. Regenerating
changed **only** that golden; the other three came back byte-identical, which is its own small
determinism check.

**Honest residual, and it is not discharged.** Ferry 25 says this SVG is in-tree _"precisely to
draw the gap between Bertlmann's socks and the singlet."_ One corner cannot draw that gap — the gap
is `S = 2` versus `S = 2√2` and exists only across all four settings. The fix makes the picture
honest about being one corner; it does not make it the falsifier ferry 25 claims. Filed:
**`081M0DVFPSK087G0R002CRCV6G`**. (Original: `081M0DN8Y8R087G0R00101VSA2`.)

### TIER 1 — skeleton collision, and both of them cross the claim-class boundary

The DU's eight glyphs, **six of which are circles**:

| member      | claim class | glyph | Unicode name                               | skeleton            |
| ----------- | ----------- | ----- | ------------------------------------------ | ------------------- |
| live        | observation | ●     | BLACK CIRCLE                               | circle/full         |
| stale       | observation | ◐     | CIRCLE WITH LEFT HALF BLACK                | **circle/partial**  |
| cold        | observation | ○     | WHITE CIRCLE                               | **circle/empty**    |
| heat        | observation | ◆     | BLACK DIAMOND                              | diamond/full        |
| unavailable | model       | ∅     | EMPTY SET                                  | circle/empty/struck |
| unobserved  | withheld    | ◌     | DOTTED CIRCLE                              | **circle/empty**    |
| sealed      | withheld    | ◍     | CIRCLE WITH VERTICAL FILL                  | **circle/partial**  |
| frost       | withheld    | ▨     | SQUARE WITH UPPER RIGHT TO LOWER LEFT FILL | square/partial      |

Two collisions:

```
[ERROR] cold "○" and unobserved "◌"   both reduce to [circle/empty]
[ERROR] stale "◐" and sealed "◍"      both reduce to [circle/partial]
```

**Both cross the observation ↔ withheld boundary — and that boundary is the one thing the DU exists
to hold.** `zeta-state.css` says keeping the three claim classes apart _"is the whole job of this
file"_, and `state-du.ts` says the distinction between the withheld members and the others _"is the
whole point"_. The colour channel protects it: violet is a register of its own, declared last so it
outranks. The texture channel protects it: the withheld members hatch. **The glyph channel breaks
it**, on exactly the two pairs that matter, and does so _silently_ because the surviving channels
cover for it everywhere the glyph appears next to its colour — and only there.

The semantic cost is precise, not vague:

- `cold` says **"watched, and nothing is there."** `unobserved` says **"no measurement was written
  here."** Reading one as the other **mints an observation nobody made**, which is the exact defect
  the fail-safe default (`unknown reads cold, never live`) was written to prevent — reintroduced in
  a different channel.
- `stale` says **"aging past its declared cadence."** `sealed` says **"there is nothing operational
  to say here yet."** Reading `sealed` as `stale` reports decay where there is only silence.

**RESOLVED** — see §8, which also records that the landed fix is _better_ than the one this doc
originally proposed. (`081M0DN91RK087G0R002X8MBWM`.)

### TIER 2 — pairs separated by hue alone: **none, and the design earned that**

This tier passes, and it passes non-vacuously — the test suite demonstrates it firing on a control.
The measured luminance separations (WCAG 2.1 relative luminance; a greyscale-separability proxy, not
a model of dichromacy):

| pair                                | contrast ratio | what saves it                                             |
| ----------------------------------- | -------------- | --------------------------------------------------------- |
| heat `#E0746A` / withheld `#9A8CE6` | **1.057**      | texture — the withheld register hatches, heat does not    |
| live `#5EC8C2` / stale `#E8B566`    | **1.068**      | glyph — ● full vs ◐ partial is a fill-fraction difference |
| heat / unavailable `#7F838B`        | 1.245          | the non-repeating strike                                  |
| withheld / unavailable              | 1.316          | hatch vs strike                                           |

`heat` and `withheld` are **1.057** apart — for greyscale purposes the same grey — and the pair
survives only because someone applied the hand rule. That is exactly how a guard that lives as
advice behaves right up until it doesn't.

Two honest caveats on this tier: the `live`/`stale` rescue leans on a **fill-fraction** difference,
which is the _weakest_ separation the criterion permits, and both members are observations so the
criterion does allow it. And `zeta-state.css` has **no `prefers-reduced-motion` block** — the pulse
is a third channel for `live` that a reader who has asked for reduced motion does not get. Neither
is a violation; both are thin, and thin is worth knowing.

## 7. The register — which of these claims are metered

Stated plainly, per `.claude/rules/toy-is-free-metered-must-be-earned.md`:

| claim                                                    | register      | why                                                                                   |
| -------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------- |
| the two singlet circuits are the same picture            | **metered**   | byte-identity, plus the identical gate sequence at the source; a test fails           |
| a new byte-identical pair in the catalog fails the build | **metered**   | Tier 0 fires on a control and stays quiet on a near-miss                              |
| a new cross-claim-class glyph collision fails the build  | **metered**   | Tier 1 fires and grades correctly on controls, given the table                        |
| `heat`/`withheld` = 1.057, `live`/`stale` = 1.068        | **metered**   | WCAG 2.1 is an exact published formula, reproduced against its endpoints in the tests |
| **○ and ◌ are confusable to a human at mark size**       | **unmetered** | this is the _table's_ claim. No perceptual threshold was measured and none is cited   |
| **◐ and ◍ are confusable to a human at mark size**       | **unmetered** | same                                                                                  |
| the ~36-cell capacity bound                              | **unmetered** | a consequence of the modelled quotient, and inherits its register                     |

**The table is the falsifiable part.** An empirical study finding that readers reliably separate
`○` from `◌` at 12px would refute quotient (1) and the file should then change. Nothing downstream
should read a collision as a measured human error rate; read it as _"these two were not separated by
a channel we have any evidence survives a glance."_

## 8. The fix that landed — and why it beats the one this doc first proposed

The capacity argument in §3 says where to spend base-form separation: **on the claim classes.** The
landed assignment gives the withheld register its own base form and then orders it by fill:

| member              | claim       | was   | now           | skeleton                        |
| ------------------- | ----------- | ----- | ------------- | ------------------------------- |
| live · stale · cold | observation | ● ◐ ○ | **unchanged** | circle / full · partial · empty |
| heat                | observation | ◆     | **unchanged** | diamond/full                    |
| unavailable         | model       | ∅     | **unchanged** | circle/empty/**struck**         |
| unobserved          | withheld    | ◌     | **□** U+25A1  | square/**empty**                |
| sealed              | withheld    | ◍     | **▨** U+25A8  | square/**partial**              |
| frost               | withheld    | ▨     | **■** U+25A0  | square/**full**                 |

**The rule, now asserted in a test rather than described in prose:**

> **BASE FORM carries the CLAIM CLASS. FILL FRACTION carries the gradation within a class.**

Circles are observations; the diamond is the alarm, deliberately breaking form because an alarm
should not read as a _degree_ of the others; the struck circle is the model register; squares are
withheld. `unavailable` ∅ is the single permitted cross-class base-form sharing — a full-diameter
strike changes the silhouette and survives blur, which is why it does not collide with `cold` ○.
That exemption is itself pinned by a test.

**Why the withheld register is ordered the way it is.** Fill tracks _how much is actually there_:
nothing was measured (`unobserved`, empty) → something exists with no operational content yet
(`sealed`, partial) → content is present and deliberately withheld (`frost`, full). `frost` is the
most-filled mark in the register because it is the only member with something behind it.

**This is a better fix than the one §8 originally recommended, and the difference is worth
recording.** The first proposal assigned `sealed` ▩ and left `sealed`/`frost` colliding as a
within-class **warning** — defensible, since both are withheld claims and their textures differ.
Ordering the whole register by fill removes that too. The DU now has **zero collisions of any
grade**, not zero errors and one warning. The original proposal is preserved in work-item
`081M0DN91RK087G0R002X8MBWM`; the improvement came from taking the criterion seriously rather than
from new information.

**One regression this change introduced and closed in the same breath.** `renderStateText`'s
unknown-member fallback rendered as `◌` — which, once `unobserved` moved to a square, became
`cold`'s silhouette. A failed map lookup would have drawn itself as the observation _"watched, and
nothing is there."_ It now renders `◇` (diamond/empty), a base form no member uses, and a test pins
that the unknown mark shares no silhouette with any member.

**The surfaces touched** — a partial rename is worse than none, because it produces two
vocabularies where there was one:

- `src/Core.TypeScript/cluster/state-du.ts` — the table, plus `BASE_FORM_CARRIES_THE_CLAIM_CLASS`
  stated at the definition site
- `src/Core.TypeScript/cluster/state-du.test.ts` — the skeleton-uniqueness and base-form
  assertions, **joining** the codepoint assertion at line 128 rather than replacing it
- `src/Core.TypeScript/cluster/state-du-css.test.ts` — now reads `stateMember("sealed").glyph`
  instead of hardcoding a mark, so the next reassignment is a one-file change
- `docs/design/root-site-iris/Settlement.dc.html` — the one shipped occurrence

`zeta-state.css` needed no glyph edit: it carries the _markup pattern_, and the only literal
codepoint in it is `&#x2205;` for `unavailable`, which is unchanged.

**The ASCII channel is now mechanically checked too** (TIER 3), because a reassignment that fixes
the visual and collides the fallback has moved the bug rather than closed it. The shipped fallbacks
`(*) (~) ( ) (!) (x) (?) (#) (/)` pass — a fixed-width frame around a distinct interior character,
injective by construction. They are, ironically, the **better-designed** channel: the constrained
one forced what the rich one did not. The closest shipped pair is `(!)` heat / `(/)` frost; §6 of
the first draft called that _"within tolerance in my judgement"_, and judgement is exactly what a
guard is supposed to replace — the quotient now says they separate (vertical stroke vs diagonal are
distinct monospace-confusable classes), and that claim is the model's, checkable, and `unmetered`
like the rest of the table.

## 9. Adjacent, and reported rather than claimed as this doc's finding

`src/Core/ZetaIdViz.fs:37-47` derives an 8×8 identicon from **the low 32 bits of a 128-bit
ZetaId** (`row in 0..7`, shifting by `row * 4`, covering bits 0-31), with the right half a mirror of
the left. The header calls this _"the id IS the picture."_

The 2026-08-14 survey lists it as _"bijective, harmless"_ — and that verdict is right about the map
it examined (nibble → glyph row, bit-reversed, genuinely bijective) and does not extend to the map
the surface actually exposes. `glyphOf : UInt128 → byte[8]` **discards 96 bits**. Two ZetaIds
sharing their low 32 bits render the identical picture, and the birthday bound puts a collision at
**~2¹⁶ ≈ 65,536 ids** — reachable, not theoretical.

This is a **layer-3 encoder injectivity** defect, not a layer-4 perceptual one, so it belongs to the
2026-08-14 doc's discipline rather than this one. It is reported here because the surface is an
**identity carrier**, which is precisely where a collision stops being a usability wrinkle and
becomes a spoofing surface. Filed: **`081M0DNCXZK087G0R003DEY5KF`**.

## 10. Anchors (Beacon) — with what each does and does NOT entail

Per `.claude/rules/anchor-to-human-prior-art.md`, an anchor must be **checked**, not cited. These are
cited from standing knowledge and were **not page-checked in this session**; the UTS #39 skeleton
construction is the load-bearing one and should be page-checked before it is quoted on any outward
surface.

- **Unicode Consortium, UTS #39 _Unicode Security Mechanisms_, §Confusable Detection.**
  **Entails:** the construction used here (canonicalise through a table, collide on equality), and
  the standing of "visually confusable" as a **security** property rather than a usability note.
  **Does not entail:** any of the geometric quotients in §5 — its table does not cover them, which
  is exactly why one had to be built.
- **Jacques Bertin, _Sémiologie Graphique_ (1967).** **Entails:** shape is nominal, value/fill is
  ordered — the nominal/ordered pairing in §4. **Does not entail:** a threshold.
- **Max Wertheimer (1923), Gestalt grouping by similarity.** **Entails:** marks alike in form are
  perceptually grouped, i.e. individual identity is subordinated to the group — the _mechanism_ by
  which a collision does its damage. **Cited for mechanism only; supplies no metric.**
- **Cleveland & McGill (JASA 79:387, 1984).** **Entails:** the measured accuracy ranking of
  perceptual tasks, and therefore that channel choice is empirical. Already anchored in-repo by the
  2026-08-14 doc; this doc applies it to the **nominal** channel, which that ranking does not cover
  — the ranking is about magnitude.
- **Simons & Chabris (1999), inattentional blindness.** **Entails:** an unattended stimulus can go
  unreported even when fully visible — support for _"under real viewing conditions"_ rather than
  _"under inspection"_. **Does not entail:** a confusability metric.
- **Kuhn, _Experiencing the Impossible_ (2019); Macknik & Martinez-Conde, _Sleights of Mind_
  (2010).** **Entails:** attention and perceptual inference can be **systematically and reliably
  directed by an adversary** — which licenses the framing in §11 and nothing quantitative.

**Refused anchors, named so nobody promotes them later.** _Just-noticeable difference / Weber's law_
is defined on a **magnitude continuum**; a nominal mark alphabet is not one, and applying a JND
threshold to it would be a category error dressed as rigour. _Metamerism_ is a real existence proof
that physically distinct stimuli can be perceptually identical — a good intuition pump for `p` being
non-injective — but it is a fact about **colour matching** and supplies no threshold for shape.
Neither is load-bearing anywhere above.

## 11. Why Aaron's methodology is the right one, stated precisely

_"i've studied magic and optical illusions a lot to try to protect humans here."_ That is
adversarial perceptual research used defensively — the same discipline as studying attacks to build
security, and it belongs to the same family as the repo's existing harsh-critic and
silent-failure-hunter reviewers.

The specific transfer, and it is what makes this a P0 rather than a polish item:

> **A magician's force works because the spectator is certain they chose freely.** The illusion is
> not that the spectator cannot tell; it is that they never notice there was a choice to make.

A confusable mark pair does exactly that. It does not produce hesitation, a squint, or a question.
It produces a **confident misread**, and the reader carries it forward as something they saw. That
is why §3's "failure is felt as nothing at all" row is the dangerous one, and why the correct
response is a mechanical check rather than a style note: **the failure mode is specifically invisible
to the person it happens to**, so it cannot be caught by asking readers whether they were confused.

## 12. Open

1. ~~Land the §8 glyph reassignment~~ — **done**, and improved on the proposal
   (`081M0DN91RK087G0R002X8MBWM`).
2. ~~Decide what `quantum-circuit-singlet-chsh` should depict~~ — **done**: it now draws the
   E(a1,b1) corner (`081M0DN8Y8R087G0R00101VSA2`). The residual is real and open: one corner still
   cannot draw the S=2 vs 2√2 gap ferry 25 claims for it (`081M0DVFPSK087G0R002CRCV6G`).
3. **Extend Tier 0 from byte-identity to a low-pass occupancy skeleton** over the 23-shape vector
   catalog — 21 of 23 goldens are pure `polyline`, so an exact rasteriser is cheap and no
   dependency is needed. Near-miss pairs worth examining first: `braid`/`plait-move` (they share
   literal strand coordinates, which is _intentional_ — one is a move applied to the other — and
   therefore the most likely true confusable in the set), `spiral`/`worldline` (single polyline
   each), `crossing`/`dynamicvalue` (three each). (`081M0DN91SH087G0R003NKKCTB`.)
4. **`glyphOf` discards 96 bits on an identity surface** (`081M0DNCXZK087G0R003DEY5KF`).
5. ~~No check on the ASCII channel~~ — **done** (TIER 3). Still open: **no
   `prefers-reduced-motion` block in `zeta-state.css`**, so a reader who has asked for reduced
   motion loses the third channel separating `live` from `stale` (which are 1.068 apart in
   luminance). Recorded rather than filed — it is thin rather than broken, and filing thin things
   is how a backlog stops being read.
6. **The quotient table wants an empirical falsifier.** Everything in §7's `unmetered` rows becomes
   `metered` the day someone runs even a small forced-choice trial at 12px. Until then the table is
   a declared model and says so at its definition site.

## Pointers

- `src/Core.TypeScript/hygiene/visual-skeleton.ts` — the quotient, the table, the declared threshold
- `src/Core.TypeScript/hygiene/audit-visual-confusability.ts` — the three tiers + the work-item-keyed baseline
- `src/Core.TypeScript/hygiene/audit-visual-confusability.test.ts` — each tier shown firing **and** staying quiet, on controls
- `docs/design/design-language-base-corporate-sovereign.md` — BASE; this criterion belongs to it
- `docs/research/2026-08-14-branch-free-visual-encoding-*.md` — layers 1-3; this doc is layer 4, nominal channel
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `.claude/rules/anchor-to-human-prior-art.md` — §7 and §10 answer to these

**Attribution:** Aaron 2026-08-19 set the observation and the methodology (§1, verbatim, and §11).
Iris wrote §2-§10 and §12, built the guard, ran the measurements, and owns the errors.
