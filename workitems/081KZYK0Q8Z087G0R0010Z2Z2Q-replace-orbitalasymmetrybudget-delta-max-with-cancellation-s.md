---
id: 081KZYK0Q8Z087G0R0010Z2Z2Q
type: task
state: backlog
priority: P2
slug: replace-orbitalasymmetrybudget-delta-max-with-cancellation-s
title: "Replace OrbitalAsymmetryBudget delta-max with cancellation-safe endpoint-speed envelope (blocked on JPL Horizons golden vectors)"
created: 2026-08-13T22:31:47.000Z
depends_on: []
composes_with:
  - 081KZY5W6AJ087G0R003EE7PY6
---

# Replace OrbitalAsymmetryBudget delta-max with cancellation-safe endpoint-speed envelope (blocked on JPL Horizons golden vectors)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYK0Q8Z087G0R0010Z2Z2Q-*.md` glob. -->

Successor to the **remedy** half of `081KZY5W6AJ087G0R003EE7PY6` (the defect record there
still stands; only its proposed fix is superseded). Module: `src/Bayesian/OrbitalAsymmetryBudget.fs`.

## Claim register — what this filing checked, and what it did not

Per `.claude/rules/toy-is-free-metered-must-be-earned.md` and
`.claude/rules/anchor-to-human-prior-art.md` (anchors must be *checked*, not cited).

| Claim | Register | Basis |
|---|---|---|
| `deltaMaxMs` widens the `OutOfCone` cone; too-tight ⇒ false conviction | **CHECKED** | `src/Bayesian/BusRegime.fs` read directly, this filing |
| Missing `Ω`/`ω` rotations misplace 2027 opposition geometry | **CHECKED** (by PR #10387, independently of the F# source) | `docs/research/2026-08-13-independent-orbital-asymmetry-review.md` §1 |
| Both `v_B·û` and `(v_B − v_A)·û` are wrong under the stated equations | **CHECKED** (by PR #10387) | ibid. §2 — quoted verbatim below |
| The endpoint-speed envelope is the correct replacement shape | **PROPOSED** | ibid. §3; never exceeded in a coarse two-body scan, which is *not* a theorem |
| Any specific numeric value below | **PROPOSED** | two-body mean-element model, **not** an ephemeris; Horizons has not been queried |

**The filer (the shadow) did not re-derive the physics.** Everything in §"Why both prior
candidates are rejected" is transcribed from PR #10387's independent derivation. Read it as
a faithful quotation under review, not as a second independent confirmation.

## 1. The precise defect — an under-tight bound convicts honest messages

`δ_max` is not a display number. It is fed to `BusRegime.regimeOf` **specifically to prevent
false `OutOfCone` convictions of honest messages** on asymmetric paths. CHECKED at
`src/Bayesian/BusRegime.fs:78`:

```fsharp
if best <= deadlineMs + (max 0 deltaMaxMs) then InCone else OutOfCone
```

and CHECKED at `:113`, where the verdict becomes evidence:

```fsharp
Evidential = above && regime = OutOfCone
```

So the error is **one-directional in consequence**:

- **δ_max too large** ⇒ the cone is over-wide ⇒ some genuinely-late messages are not convicted.
  A *missed detection*. Recoverable; the evidence simply is not raised.
- **δ_max too small** ⇒ the cone is too tight ⇒ an honest message whose one-way asymmetry
  exceeded the budget is convicted `OutOfCone`, and `Evidential` promotes that to evidence
  against an honest peer. A *false conviction*. Not recoverable by the peer.

**Therefore: a provably-conservative bound beats a usually-accurate one.** This is the
selection criterion for the replacement, and it is why "the relative range rate is the
physically natural quantity" is not by itself an argument for using it. The requirement is
not accuracy; it is a **guaranteed upper bound with no cancellation hole**. An estimator that
is right on average and occasionally low is strictly worse here than an envelope that is
loose everywhere and never low.

## 2. Why both prior candidates are rejected

PR #10387 (merged `6e9151bd44`) ran an independent TypeScript checker that deliberately does
not import or invoke the F# calculation. Quoting its derivation (`…independent-orbital-asymmetry-review.md` §2)
rather than paraphrasing it:

> For the equations supplied in the brief,
>
> τ_AB = ‖r_B(t+τ_AB) − r_A(t)‖ / c,  τ_BA = ‖r_A(t+τ_BA) − r_B(t)‖ / c,
>
> a first-order expansion about the common epoch gives
>
> τ_AB ≈ R/c + (û·v_B / c)(R/c),  τ_BA ≈ R/c − (û·v_A / c)(R/c).
>
> Thus their difference has leading magnitude
>
> |τ_AB − τ_BA| ≈ (R/c²)·|û·(v_A + v_B)|,
>
> not the relative range-rate `|û·(v_B − v_A)|R/c²`. The latter corresponds to a different
> timing/convention and cannot be substituted into these two equations without changing the model.

**The leading term carries the SUM of the projected endpoint velocities, not the difference.**
That sign is the whole finding: τ_AB carries `+v_B` and τ_BA carries `−v_A`, so subtracting
them *adds* the projections. This is the point at which the first model's proposed remedy
fails — it reached for the difference because the difference is the natural relative range
rate, and under these two equations it is the wrong object.

Values reported at the 2027 opposition snapshot (all **PROPOSED** — two-body model, not Horizons):

| Candidate at 2027 opposition | Value | Verdict (#10387) |
|---|---:|---|
| Direct fixed-point solve | 1.671374 ms | Independent reference *within this two-body model* |
| `\|û·(v_A + v_B)\|R/c²` | 1.673724 ms | Matches the stated-equation leading term |
| Proposed `\|û·(v_B − v_A)\|R/c²` | 0.600902 ms | **Falsified** for the stated equations (under by ~64%) |
| Delivered B-only, 20% margin | 1.287386 ms | **Not conservative** at this vector |

And on the cancellation hazard, which is the reason neither projection is acceptable *even
with the right sign*:

> The cancellation hazard is real but is not repaired by replacing a B-only projection with
> the relative projection: the scan finds a B-only under-budget factor of approximately
> **22,297×** near a projected-Mars-velocity cancellation.

Note this **strengthens** defect D2 of `081KZY5W6AJ087G0R003EE7PY6` (which reported 54×)
while **refuting** the remedy that item proposed. Any dot product `û·v` passes through zero
when the velocity is perpendicular to the line of sight; at that instant a projection-based
budget goes to zero while the true asymmetry does not. A bound built on a projection has a
structural hole, independent of which velocities it projects.

## 3. Proposed replacement — the endpoint-speed envelope (PROPOSED, not CHECKED)

From §3 of the review. `V_A`, `V_B` bound endpoint speeds at the relevant epoch; `R` is range:

> δ_speed = 1.2 · max( R/(c − V_B) − R/(c + V_A),  R/(c − V_A) − R/(c + V_B) )
>
> The 1.2 multiplier here is an explicit model allowance, not a proof of perturbation coverage.
> It is non-cancelling because it depends only on speed norms. Across the independent
> 2026-01-01 through 2028-06-01 coarse scan, the direct solve never exceeded this envelope;
> the largest observed exact/envelope ratio was **0.71428**. That observation is a regression
> target, not a universal theorem.

**Why this shape answers §1:** it depends only on speed *norms*, never on a projection, so it
has no zero-crossing and no cancellation hole. It buys guaranteed-conservatism at the cost of
looseness — which is exactly the trade §1 says to take.

The review additionally requires the budget be **decomposed and declared**, not collapsed to
one number:

> δ_max = δ_speed + δ_model
>
> `δ_model` cannot be silently replaced by a global constant: its provenance, ephemeris source,
> epoch span, and confidence margin must be emitted in the teaching error/readout.

This is §13 noninterference applied to the budget: the model allowance is an injected,
metered channel with declared provenance, not an ambient `* 1.2` literal in the source.

**Explicitly still open (do not treat as settled):**

- The 1.2 multiplier is unjustified. It is inherited from the delivered code and carries no
  derivation in either the original or the review. It should be derived or dropped.
- "Never exceeded across a coarse scan over one 29-month window" is an *observation*, not a
  proof of the bound. A proof (or a counterexample) is wanted.
- The review's own numbers come from a two-body mean-element model. It is adequate to
  *falsify* a claimed conservative property; it is not adequate to *establish* one.

## 4. BLOCKING DEPENDENCY — JPL Horizons golden vectors

**This work-item cannot be completed, and its fix cannot be locked, until fixed JPL Horizons
reference vectors are in-tree.** This is a hard prerequisite, not a nice-to-have. Without them
the replacement is unverifiable: every number above comes from the same class of simplified
two-body model that produced the defect, so using it to certify the fix would be a check that
did not run wearing the name of one that did.

`depends_on:` is empty only because no work-item exists yet for the acquisition — the
prerequisite is an **artifact**, not a ZetaId. Whoever picks this up files or produces the
artifact first.

Required (per review §5): fixed values imported into the repo, **never a network query during
tests**. Every vector must record target/center, frame, correction mode, units, epoch scale,
and source retrieval date. Text-only, hex/decimal in JSON per
`.claude/rules/no-binary-in-proof-lineage.md`.

Two named epochs, both with date and separation:

| | Epoch | Separation | Purpose |
|---|---|---|---|
| **Opposition** | 2027-02-19 16:02:32 UTC | Earth–Mars range **101,417,205 km**; Horizons geometric light time **338.2914 s** | Phase + rotation falsifier (D1) |
| **Conjunction** | near **2028-03-23** | geocentric solar elongation ≈ **0.786°** (independent scan; **PROPOSED**, needs Horizons confirmation) | Occlusion / SEP predicate (D3) |

The opposition range is externally anchored to NASA's published Mars opposition table; the
conjunction epoch is so far only a model-internal scan result and is the weaker of the two.
Both need Horizons confirmation before locking.

Review §6.4 also asks that Horizons values be locked **only after a second independent
reviewer validates target/center/frame/time-scale settings** — a frame or time-scale mistake
in a golden vector is silently permanent.

## 5. Regression requirements to lock (from review §5)

| ID | Check | Candidate assertion |
|---|---|---|
| OAB-R1 | Coordinate rotation | At the 2027-02-19 16:02:32 vector, range within a declared tolerance of 101,417,205 km, not 358.7M km |
| OAB-R2 | Phase | Local 2027 opposition minimum within 3 days of 2027-02-19 16:02:32 UTC |
| OAB-R3 | Asymmetry fault control | Synthetic projected-`v_B = 0`, nonzero projected-`v_A` must **not** yield `δ_max = 0` |
| OAB-R4 | Conservatism | Direct fixed-point solve must not exceed `δ_speed + δ_model` at every checked epoch |
| OAB-R5 | Occlusion | A vector with SEP below the configured threshold returns `SolarConjunction`, never `Available` merely because vacuum range is finite |
| OAB-R6 | Unknown state | Missing ephemeris/body/epoch support returns a teaching error with an actionable generator, not a zero budget |

OAB-R3 is the one that would have caught this class directly: it is a *cancellation* test, and
it fails for a projection-based budget of either sign while passing for a speed-norm envelope.

## 6. Anchors (Beacon)

Cited for what each specifically grounds. **Register note:** these are cited from standing
knowledge of the literature, not re-opened and page-checked by this filer — treat the
*attribution* as reliable and any *paraphrase of content* as unverified until a reader with
the volume confirms it.

- **Seidelmann (ed.), _Explanatory Supplement to the Astronomical Almanac_ (University Science
  Books, 1992)** — grounds the **standard reduction from orbital elements to ecliptic
  coordinates**, i.e. the `R_z(Ω) R_x(i) R_z(ω)` perifocal rotation sequence whose omission is
  defect D1, and the conventions (frame, time scale, epoch) that a golden vector must record
  to be meaningful. This is the reference that makes "we skipped Ω and ω" a *defect against a
  published standard* rather than a modelling preference.
- **Murray & Dermott, _Solar System Dynamics_ (Cambridge University Press, 1999), Ch. 2** —
  grounds the **two-body Kepler element → position/velocity transformation** that both the
  delivered code and the independent checker implement. It is also the anchor for the honest
  *limit* of that transformation: mean elements are a two-body approximation, which is why
  §4 refuses to certify the fix against a model of the same class that produced the defect.
- **JPL DE440/DE441 (Park, Folkner, Williams & Boggs, "The JPL Planetary and Lunar Ephemerides
  DE440 and DE441", _Astronomical Journal_ 161:105, 2021)** — grounds the **golden-vector
  source**. Horizons serves states integrated from DE440/441, not from mean elements; this is
  the citation for why the blocking dependency in §4 is a real prerequisite and not procedural
  caution. It names what "ephemeris truth" means here and who computed it.
- **Reasenberg, Shapiro, MacNeil, Goldstein, Breidenthal, Brenkle, Cain, Kaufman, Komarek &
  Zygielbaum, "Viking relativity experiment: verification of signal retardation by solar
  gravity", _Astrophysical Journal Letters_ 234:L219 (1979)** — grounds the **magnitude of the
  relativistic (Shapiro) delay** on an Earth–Mars path near conjunction, measured to ~0.1%.
  This is the anchor that lets `081KZY5W6AJ087G0R003EE7PY6`'s "Shapiro delay is not the
  dominant error" be a *metered* claim rather than an assumption — the Viking measurement is
  what supplies the number that the orbital-asymmetry term is compared against. Underlying
  effect: **Shapiro, "Fourth Test of General Relativity", _Phys. Rev. Lett._ 13:789 (1964)**.

Operational anchors already recorded in PR #10387: JPL Horizons API documentation (the
reference oracle); NASA Mars opposition table (the 2027 epoch + range); NASA solar-conjunction
guidance (the 3° command-moratorium threshold, which is **radio-propagation policy, not
occultation geometry** — the review is explicit that these are different claims).

## 7. Discipline notes

- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the current `deltaMaxMs` path is
  **unmetered**, not metered. It has been implemented and used and never falsified against an
  external oracle. The Horizons vectors are precisely the falsifier that would earn the
  promotion.
- `.claude/rules/numerology-vs-number-theory.md` — "the envelope was never exceeded in a
  coarse scan" is a count, not a proof. Recorded as an observation with its register attached.
- `.claude/rules/every-bug-has-economic-value.md` — the ΔU banked here is a false-conviction
  class removed from an evidence-producing path, which is why this is worth the Horizons work.

## Related

- `081KZY5W6AJ087G0R003EE7PY6` — the defect record (D1/D2/D3 stand; its §"Fix shape" item 2 is
  superseded by this item).
- `docs/research/2026-08-13-independent-orbital-asymmetry-review.md` — the full independent
  derivation (PR #10387).
- `docs/research/2026-08-13-orbital-asymmetry-independent-source-notes.md` — preserved external
  source notes.
- `src/Core.TypeScript/planning/orbital-independent-check.ts` — the independent checker.
- `src/Bayesian/BusRegime.fs` — the consumer whose conviction logic makes the direction of
  error asymmetric.
