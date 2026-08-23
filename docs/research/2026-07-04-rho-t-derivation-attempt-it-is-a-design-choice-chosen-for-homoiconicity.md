# ρ_T = 1/(3√2): derivation attempt → it is a DESIGN CHOICE, chosen for homoiconicity (Aaron was right)

*Shadow ferry, 2026-07-04. Aaron: "Soraya's leg — derive it or name it a design choice for me; if it can't
be derived it was chosen to be more homoiconic." This is the honest attempt: try the derivation, and where
it stops being forced, name the choice. Result: **it cannot be derived from first principles; it follows
forced from two named modeling choices; those choices were made for homoiconicity — Aaron's hypothesis is
confirmed, and here is the precise reason.** Also corrects the shadow's own earlier "two contradictory
encodings" flag, which was wrong.*

## The two numbers are DIFFERENT quantities (correcting the earlier flag)

The prior register flagged `1/(3√2) ≈ 0.236` (`YinYangEnsemble`) and `(2√2−2)/2 ≈ 0.414` (`BusRegime`) as
"two contradictory encodings of the Tsirelson ρ-threshold." **That was wrong** — they measure different things:

- **`YinYangEnsemble.tsirelsonThreshold = 1/(3√2) ≈ 0.2357`** — a **reseed threshold** on the ensemble
  decorrelation `ρ_proxy`, placed via a linear map of the whole CHSH range `[0,4]` onto `ρ ∈ [0, 1/3]`.
- **`BusRegime.HonestCeilingRho = √2 − 1 ≈ 0.4142`** — the **AntiSybil correlation ceiling**, defined
  *directly in CHSH units* as the normalized coordination bandwidth `(|S| − 2)/2` at `S = 2√2`
  (= `(2√2−2)/2 = √2−1`) — how far Tsirelson exceeds the classical bound, as a fraction of it. No ρ*=1/3
  identification is involved.

Both are Tsirelson-motivated; they answer different questions. So there is no contradiction to resolve —
only the `0.2357` one carries the "is it derived?" question, because only it maps ρ onto S.

## The derivation attempt (ρ_T = 1/(3√2))

`YinYangEnsemble` documents the map (the "Bell inequality triangle"):

| CHSH `S` | regime | ρ landmark |
|---|---|---|
| 4 (PR-box / algebraic max) | superdeterminism / common seed (groupthink) | ρ* = 1/3 |
| 2√2 (Tsirelson) | quantum-like operating point | ρ_T |
| 2 (classical bound) | local realism / decorrelated | ρ < ρ_T |

Pin the two named points and assume the map `ρ(S)` is **linear through the origin**:

```
ρ(S) = (ρ* / 4) · S = (1/3)/4 · S = S / 12
```

Then:

- `S = 4  → ρ = 1/3   = ρ*`     ✓ (groupthink boundary)
- `S = 2√2 → ρ = 2√2/12 = √2/6 = 1/(3√2) ≈ 0.2357 = ρ_T`   ✓
- `S = 2  → ρ = 1/6 ≈ 0.167`   (consistent with "ρ < ρ_T")

So **given two premises, `ρ_T = 1/(3√2)` is forced.** The premises are:

- **(P1) Identify the Condorcet groupthink boundary `ρ* = 1/3` with the CHSH algebraic max `S = 4`.**
  `ρ* = 1/3` comes from Condorcet `N_eff ≥ 3`; `S = 4` is the PR-box maximum. Both are "everything maximally
  correlated / no independent information," so the identification is *natural* — but `ρ ∈ [0,1]` and
  `S ∈ [0,4]` live on different axes; nothing *forces* the numeric identification. **(P1) is a choice.**
- **(P2) Assume `ρ(S)` is linear (affine, origin-fixing).** There is **no first-principles reason** a
  pairwise correlation `ρ` should be linear in `S` — `S` is a specific sum of four correlators at different
  measurement angles, and its relation to any single pairwise correlation is *not* linear in real CHSH.
  **(P2) is a choice** — the simplest one.

**Conclusion: ρ_T = 1/(3√2) is NOT derivable from first principles.** It is forced *by* (P1)+(P2), but
(P1)+(P2) are modeling choices, not theorems. So, per Aaron's instruction, we **name it a design choice.**

## Why that choice — homoiconicity (Aaron's hypothesis, made precise)

Aaron: "if it can't be derived it was chosen to be more homoiconic." Confirmed, and here is the exact reason:

**Among RATIO-PRESERVING maps `ρ(S)` (ρ(S)/ρ(S′) = S/S′ for all S, S′), the linear origin-fixing map is the
unique one — trivially: pointwise ratio-preservation forces ρ(S) = cS, and P1 fixes c = 1/12.**

*(Quantifier corrected 2026-07-04 per Soraya's audit: the first cut said "unique among ALL maps," which is
false — any map agreeing at the three landmarks {2, 2√2, 4} (e.g. `S/12 + ε(S−2)(S−2√2)(S−4)`) produces the
identical three-point diagram. Uniqueness holds only once "same diagram" is strengthened to* pointwise
*ratio-preservation, which is the honest content of the homoiconicity requirement. Her second correction is
also taken: an* affine *map preserves ratios of differences, not ratios — so a nonzero offset already breaks
the ratio-identity, meaning `b = 0` is FORCED by shape-preservation, not selected by Rodney's razor; the
razor aside is dropped.)*

Homoiconicity = the representation has the same structure as the thing represented (code = data; the map =
the mapped). The three CHSH landmarks `{2, 2√2, 4}` and the three ρ landmarks `{1/6, 1/(3√2), 1/3}` are
related by a single scale factor `1/12`, so the **ordering, the ratios, and the regime boundaries are
identical in both domains** — the ρ-regime code *is* the CHSH-regime physics, read in ρ-units, provided the
map is taken ratio-preserving *everywhere* (not just at the landmarks) — that is the precise sense in which
homoiconicity picks the linear map.

So the honest, complete answer: **ρ_T = 1/(3√2) is a design choice — the homoiconic linear identification of
the Condorcet ρ-regimes with the CHSH S-regimes — not a first-principles derivation.** It is an excellent
choice (shape-preserving, minimal, and it puts the reseed trigger safely below the groupthink horizon), and
it should be *named* as such rather than described as "Derived," which overclaims.

## Actions

1. **Code comment corrected:** `YinYangEnsemble.tsirelsonThreshold` said *"Derived from the Bell inequality
   triangle."* Changed to name it a **design choice** (the homoiconic linear identification), pointing here.
2. **Register corrected:** the "two contradictory encodings" flag is withdrawn (0.236 and 0.414 are
   different quantities, §1).
3. **Open for the formal team (optional):** if a *non-linear* ρ(S) were ever motivated (e.g., from an actual
   derivation of `ρ` as a function of the amp-emu CHSH correlators), ρ_T would move off `1/(3√2)`. The
   current value is correct *for the homoiconic linear model*; that model is the thing on file.

## Follow-up 2026-08-23 — the prose sweep was the wrong shape of fix (Soraya)

Aaron, reading a `1/(3√2)` in passing: *"i hear tsirelson and hear 2sqrt2, why do you hear
1/(3sqrt2)? this threshold and limit different thresholds, most 1/(3sqrt2) have turned out to be
bugs."* He is right about the track record — **Z-3 and Z-5 were both DEMOTED §A→§B and the
Zeta-Conjecture keystone claim was REFUTED**, all over this one constant wearing a physicist's name.

The fact was not in dispute; this document had already established it on 2026-07-04, and the
2026-08-01 audit had already propagated a caveat banner to the files someone thought of at the time.
**The remediation is what failed, and it failed structurally rather than through carelessness:**

- **A prose sweep is not idempotent.** Running it again does not converge on the same tree; it
  converges on whatever the sweeper happened to grep for that day.
- **It does not survive new files.** Every document written after the sweep starts uncaveated, and
  nothing anywhere notices.
- **Measured consequence.** By 2026-08-23 the two 2026-07-16 sibling documents had drifted into
  *disagreeing with each other* — `2026-07-16-austrian-economics-money-velocity-and-the-rho-formula.md`
  carried the banner and `2026-07-16-echolocation-debounce-and-the-real-sensor-fusion-proof.md` did
  not, so the repo asserted and denied the same identification in two files written the same day.
  Neither file could know, because nothing was comparing them.
- **A second-order instance in the same file.** The echolocation doc also asserted the number was
  *"derived from the 4-directional Grover coin on a 2D lattice."* It was not derived from anything —
  that is this document's whole finding. An uncaveated claim does not merely omit a caveat; it keeps
  generating new claims that inherit the error.

So the durable fix is not more prose. It is
**`src/Core.TypeScript/hygiene/lint-tsirelson-constant-caveat.ts`**, which fails when a live surface
writes the constant within a few lines of the name "Tsirelson" without a caveat. It refuses the
**name**, never the **number**: `ρ_T = 1/(3√2)` remains a design threshold in good standing and no
value or behaviour is in the guard's scope.

Its caveat markers are **derived from this document** — the citation of its own path, the verdict
vocabulary of its emphasized sentences, the map `ρ = S/12` it derives, and the negation it licenses —
and it **discovers this file by shape rather than hardcoding the path**, so renaming this document
reddens every stale citation in the tree instead of silently disabling the guard. That is deliberate:
a hand-maintained list of caveated places is exactly the artifact whose drift caused the problem, so
the guard is built to have none.

Two of the guard's own markers had to be **measured and thrown away** for being vacuous — each
green-lit the very file it was written for. A bare `/homoiconic/i` passed
`src/Core.TypeScript/bayesian/sensor-fusion-oracle.ts`, which carries the defect and merely uses the
word elsewhere; a "negation near the number" marker passed
`docs/research/cpt-symmetry-emergent-c-rho-lightcone.md`, the worst offender in the tree, on the
unrelated sentence *"not ρ\* = 1/3 … but ρ_T ≈ 0.236"*. Both are pinned as regression tests. **The
general lesson is the repo's own doctrine turned on its own correction: prose rots, a check does not
— and a check nobody has watched fail is still prose.**

## Cross-links

- `src/Bayesian/YinYangEnsemble.fs` (`tsirelsonThreshold`) — the ρ_T this answers; comment corrected.
- `src/Bayesian/BusRegime.fs` (`HonestCeilingRho = √2−1`) — the *other* quantity (coordination bandwidth), not the same threshold.
- `docs/research/2026-07-04-braided-monoid-amplitude-emulation-more-than-bayesian-aaron-corrects-the-bell-peel.md` — the quantum-ISA grounding; this doc answers its one remaining open line.
- `src/Core/AmplitudeEmu.fs` · `src/Core.QSharp.ReferenceOracle/ZSetISA.qs` — where an actual ρ↔S derivation (if wanted) would come from.
- Anchors: Condorcet 1785 (`ρ*=1/3` via `N_eff≥3`); Tsirelson 1980 / CHSH 1969 (`S = 2, 2√2, 4`); PR-box (Popescu–Rohrlich, the algebraic max); homoiconicity (Kay/McCarthy — code=data; here representation=represented); Rodney's razor (minimal encoding).
