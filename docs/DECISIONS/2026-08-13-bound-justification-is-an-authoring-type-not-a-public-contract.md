# A bound carries its justification — as an authoring type, not a public contract

**Author:** Ilyana (public-API designer) — 2026-08-13
**Verdict:** **ACCEPT_WITH_CONDITIONS** on the mechanism. **REJECT** on the public
type, on the `Zeta.Core` placement, and on the grandfathering sweep.
**Subject:** the rung-1 candidate named in
`docs/research/2026-08-13-lessons-belong-in-the-harness-not-in-rules-the-externalization-ladder.md`
(PR #10437) — *"make `Bound` a DU carrying a required `Derivation | Measurement |
Assumption(reason)`, so a bound without a derivation is unrepresentable."*
**Worked case:** `src/Bayesian/OrbitalAsymmetryBudget.fs`, per PR #10418.

---

## 0. Verdict table

| Question asked of me | Answer |
|---|---|
| Is this worth a **public** type? | **No.** `internal` to `Zeta.Bayesian`, with `InternalsVisibleTo("Bayesian.Tests")`. Zero public surface added. |
| Narrowest form that catches the `1.2`? | A three-case `Justification`, a `Term`, and a `Bound` that is **a sum of terms with no multiply**. ~40 lines of type. |
| Does it survive the four-oracle byte-lock? | It never reaches the byte-lock. Justification is provenance metadata; the locked artifact is the number. F#-side only, by construction. |
| Migration? | **No sweep.** An `Assumption "pre-dates this type"` pass would relabel the problem and devalue the case that carries the weight. |

The mechanism is right. The proposed *placement* would have cost the substrate a
forever-contract for a benefit that accrues entirely to authors inside one assembly.

---

## 1. Why not public — the asymmetry that decides it

`internal → public` is a widening, available on any future day, breaking nobody.
`public → internal` is a break. So the two errors are not symmetric, and the
conservative move is not a matter of taste:

- **Ship it public today, narrow it later** — every downstream signature that
  mentioned `Justification` changes. Under Hyrum's Law the observable shape of a
  public API is depended on regardless of contract (Winters, Manshreck & Wright,
  *Software Engineering at Google*, ch. 15), and the pre-v1 window makes the cost
  *docs-and-refactor*, not *users* — which is exactly why it should be spent on
  things that need it.
- **Ship it internal today, widen it later** — costs one attribute change on the
  day an external reader actually exists.

**There is no external reader today.** Checked: every consumer of
`OrbitalAsymmetryBudget.deltaMaxMs` is inside `Zeta.Bayesian` itself —
`ReticulumBusMeter.fs` (2 call sites) and `GossipTelemetry.fs` (2 call sites);
each immediately narrows to the `int` of milliseconds that `BusRegime.regimeOf`
takes. Nobody outside the assembly constructs a justification and nobody reads
one. A public `Justification` would be a contract with a consumer we have not met,
serving a use case we cannot name.

And the one caller who *does* need it — the test assembly — is the exact case
GOVERNANCE.md §19 already answers: *"the tests need it"* is never a reason to go
public, it is a reason to use `InternalsVisibleTo`. `Zeta.Bayesian` had no
`AssemblyInfo.fs`; this change adds one with a single entry.

> Note the shape of this argument. It is the same one `src/Core/AssemblyInfo.fs`
> already makes in a comment — *"Zeta.Bayesian is NOT in this list — it uses the
> public `IOperator<'T>` plugin interface, exactly the shape every external plugin
> library uses."* The precedent for refusing a friend-assembly shortcut is in the
> repository already; this decision applies it one level down.

**When this should be promoted.** When a second assembly authors a
soundness-bearing bound, or when an audit surface actually reads justifications
(a CLI verb, a report, a `ZetaDb` fold). Not before. If a second assembly needs
the algebra before that, **copy the forty lines**. Duplication is far cheaper than
the wrong abstraction (Metz) — a shared type extracted from one instance is a
guess about the second.

## 2. The narrowest form that catches the `1.2` — the shape matters more than the DU

The proposal's DU alone would **not** have caught it. `1.2` was a bare literal in
the middle of an arithmetic expression:

```fsharp
abs vProj * rttS / C_KM_S * 1000.0 * 1.2
```

Attaching a `Justification` to the *result* does not prevent that: the author
writes one justification for the whole expression and the multiplier stays
invisible inside it. A type that pairs a float with a reason is decoration.

What catches it is a structural refusal:

> **A bound is the sum of named, justified terms. There is no multiply.**

`Bound`'s union case is `private`, so a total cannot be *authored* — only derived
by summation. There is no `scale`, no operator overload, and no adjustment that is
not a term. To widen a bound you must state *what* you are adding, *how much*, and
*why*. A silent multiplicative margin has nowhere to live.

This is not merely a stricter version of the proposal — it **encodes the finding
instead of recording it**. PR #10418's structural refutation of the `1.2` was that
it is the wrong *shape*: the residuals it was supposed to cover (curvature,
V-sup-over-interval, ephemeris error, Shapiro) are **additive** and do not scale
with `delta_speed`, and a multiplicative margin vanishes exactly where the additive
residuals do not. A type whose only combinator is `+` cannot express the refuted
shape. That is the difference between a type that asks the question and a type that
has already answered it.

### What it does not claim

Leaf magnitudes are still `float`, so `{ Value = x * 1.2; Why = Assumption "..." }`
remains writable. The guarantee is **no unnamed, unjustified contribution to a
total** — not **no wrong arithmetic**. Rung 1 for the *silence*, not for the
*arithmetic*.

Saying so plainly is load-bearing: a check that cannot fail is not a check, and the
defect class this type answers is precisely a constant that claimed more than it
had. Overclaiming the guard would repeat the defect one level up. Register: **rung
1 for silent margins, rung 4 for arithmetic errors.**

## 3. Scope — the criterion, and what the maximal version would cost

**In scope:** a constant that is a *claim about a bound whose being too small
produces a false verdict*. `BusRegime.regimeOf` convicts `OutOfCone` when
`best > deadline + delta_max`; an under-stated `delta_max` is an unsound
conviction. That is a truth-apt claim about the world, and it can be wrong in a
direction that hurts.

**Out of scope:** policy knobs — retry timeouts, batch sizes, backoff exponents,
buffer sizes. A 30-second timeout is not unjustified; it is a chosen operating
point with **no truth value**. There is nothing for `Derivation` or `Measurement`
to say about it.

That exclusion is the whole scope argument, and it is the repo's own discipline:
if the type were applied to every constant in the substrate, `Assumption` would be
the answer for the overwhelming majority — and *a discriminator that returns one
case for most of its inputs discriminates nothing*
(`.claude/rules/numerology-vs-number-theory.md`, "too many correlations is a
warning"). The maximal version does not generalise the guard; it **dilutes it to
zero**, and simultaneously trains every author to type `Assumption "..."`
reflexively — the `no-agent-gate-bypass.test.ts` failure mode, where a guard that
fires on everything gets routed around.

Cost of the maximal version, stated separately as asked: a public `Zeta.Core`
type; a mandatory annotation at every numeric literal in the substrate; a
migration touching hundreds of sites; and a `Justification` distribution that is
~95% `Assumption`, from which no audit can learn anything. A large, permanent
contract bought with the guard's own discriminating power.

## 4. The byte-lock answer

**The type never reaches the byte-locked path, and that is not a workaround — it
is the correct boundary.**

The four-oracle byte-lock pins *computed numeric results*. A justification is
provenance about how a number came to be believed. It enters no hash, crosses no
wire, and participates in no fold. Rust and TypeScript oracles reproducing
`delta_max` must agree on the **number**; whether the F# side records a certificate
path alongside it is invisible to them and must stay so — a metadata field that
crossed into the locked artifact would be a new divergence source bought for
nothing.

Two further facts make this decisive rather than merely convenient:

1. **TypeScript has no DUs.** A tagged-object encoding is convention, not
   exhaustiveness, so the guarantee does not survive the crossing anyway. A type
   whose value evaporates at the boundary should not be *placed* at the boundary.
2. **`deltaMaxMs` is not byte-lockable today regardless.** PR #10418 established
   that `helioVel` differences two ~2.3e8 km positions taken one second apart, and
   `sin`/`cos`/`atan2` are not bit-identical across .NET, Rust, TypeScript and
   Lean. Putting a justification type on the shared surface of a function that
   cannot be locked would commit cross-language contract for a proposition that
   does not hold.

So: F#-side only. If the ephemeris-free constant of PR #10418 §5 is later adopted
— it depends only on `sqrt`, which *is* correctly rounded and therefore lockable —
the locked artifact is still the number.

## 5. Migration — no grandfathering sweep

The proposal floats an `Assumption "pre-dates this type"` sweep so existing
constants are grandfathered *visibly*. **Rejected.** It relabels the problem and
pays for the relabelling with the type's credibility:

- A sweep produces a large diff of zero-information annotations, and its output is
  indistinguishable from a genuine `Assumption` written by someone who thought
  about it. The audit signal is destroyed on the day it is created.
- It teaches the reflex the type exists to prevent: reach for `Assumption "..."` to
  make the compiler quiet.

**The adopted path instead:** the type applies where a bound is *authored or
touched*. An unwrapped `float` is honest — it makes no claim at all. The wrapped
set grows monotonically and every member of it is informative, because every member
was written by someone who had the question in front of them.

The honest limit, named rather than hidden: **this type is not a census
mechanism.** It cannot tell you which constants in the substrate are unjustified —
only that among bounds which *are* wrapped, these are the assumed terms. Finding
unwrapped constants is a different job on a different rung (a checker, rung 3), and
conflating the two is exactly what would drive this type to the maximal version
rejected in §3.

## 6. Applied to the real case — all three registers

The task's test: express the PROVED envelope, the PROPOSED `delta_model`, and the
retired `1.2`. All three, in `tests/Bayesian.Tests/BoundJustification.Tests.fs`.

**PROVED** — `Derivation(theorem, certificate)`, where the certificate is a *path*,
so the claim is followable:

```
Derivation("|tau_AB - tau_BA| <= max(R/(c-V_B) - R/(c+V_A), R/(c-V_A) - R/(c+V_B)), and sharp",
           "tools/Z3Verify/light-time-endpoint-speed-envelope.smt2; src/Core.Lean4/Lean4/LightTimeAsymmetry.lean")
```

BJ-1 re-checks the published sharpness witness **in integers**, so no floating
point enters the certificate: with `c=10, R=1, V_A=2, V_B=3`, each envelope branch
is `R*(V_A+V_B) / D` — numerator `5` for **both** branches, denominators `84` and
`104` — and `tau_AB=1/7, tau_BA=1/12` attains branch 1 exactly. Both branches
carrying the **sum** is the structural fact that makes a projection estimator the
wrong shape. BJ-7 asserts both cited paths resolve on disk: a proof nobody can open
is `AssertedOnly` wearing a citation.

**PROPOSED `delta_model`** — the additive decomposition
`delta_speed + delta_curv + delta_Vsup + delta_ephem + delta_rel`, five terms, each
with its own register. BJ-3 asserts the total is derived from the parts and that
`Bound.assumed` returns exactly `[delta_ephem; delta_rel]` — the two magnitudes
quoted rather than verified, including the Shapiro figure PR #10418 explicitly did
not check. The uncertainty is now enumerable instead of prose.

**The retired `1.2`** — BJ-4. It has no multiplicative form to take; the only way
to express it is a term named `"legacy 20% margin"` with a magnitude and
`Assumption "fudge factor — no derivation in the original code, the review, or the
proposal"`. Exactly the intended outcome: **still permitted, no longer silent.**

### The shipped value did not move

`deltaMaxMs` keeps its signature `string -> string -> float -> float` and its
arithmetic **character for character**. It is now defined as
`Bound.value (deltaMaxBound ...)` over a single term whose register is
`Assumption`, naming both defects (the projection is an estimator, not a bound; the
`1.2` covers nothing the sharp envelope can produce) and pointing at
`081KZYK0Q8Z087G0R0010Z2Z2Q` as the replacement.

Replacing the value is that work-item's job, not this change's. **Moving a number
while retyping it would hide the retyping** — and would bury a numeric regression
in a diff nobody would read numerically.

Verification (**CHECKED**, transcript in the PR): `deltaMaxMs` was dumped at 205
`(pair, JD)` points on this branch and on `origin/main`, at round-trip (`"R"`)
precision; the diff is empty. BJ-5 additionally pins
`deltaMaxMs = Bound.value ∘ deltaMaxBound` bit-for-bit, so a later refactor cannot
silently drift them apart.

## 7. Why a DU rather than an interface

`.claude/rules/interfaces-free-classes-earned-under-rules.md` makes interfaces the
free default and requires a class to be earned. The earning here:

An F# discriminated union is a **sum type** — an immutable value with no instance
state, no captured authority, and nothing to reflect over. It is a free object in
the sense of `only-the-irreducible-is-primitive-generate-the-rest.md`, not a class
in the sense the rule guards against (state ⇒ weight ⇒ capture). The rule's target
is hidden mutable state; a `Justification` has none, is fully enumerable, and is
byte-lockable in principle.

An interface would be strictly worse here: it is *open*, so a fourth register could
be added by any implementer — which defeats the purpose. Closed-world
exhaustiveness is the mechanism. In-repo precedent: `src/Core/DerivationProtocol.fs`
is the same construction for the same reason (`Evidence`, `Coverage`, `Divergence`
are all closed DUs about what is and is not verified).

**Relationship to `DerivationProtocol`:** deliberately not merged. That module is
about *whether a requirement's tests discriminate*; this one is about *whether a
magnitude is believed for a reason*. They share a philosophy and no domain, and one
lives in `Zeta.Core` while this one has earned no cross-assembly life yet. If a
future audit surface wants a single register vocabulary, that is the moment to
unify — with two instances in hand instead of one.

## 8. Anchors (Beacon)

| Anchor | Grounds | Register |
|---|---|---|
| **David L. Parnas (1972)**, "On the Criteria To Be Used in Decomposing Systems into Modules", CACM 15(12) | Information hiding: a module publishes what callers need and hides its design decisions. A justification is a design decision, not a caller need. | **NOT re-opened**; standing knowledge. |
| **Hyrum Wright** (Hyrum's Law) / Winters, Manshreck & Wright (2020), *Software Engineering at Google* ch. 15 | With enough consumers, every observable of a public API becomes depended on regardless of contract — why `internal → public` is the safe direction and not its inverse. | **NOT re-opened.** |
| **Sandi Metz (2016)**, "The Wrong Abstraction" | Duplication is far cheaper than the wrong abstraction — the argument for copying forty lines rather than extracting into `Zeta.Core` on one instance. | **NOT re-opened.** |
| **Joshua Bloch (2006)**, "How to Design a Good API and Why It Matters" | *"When in doubt, leave it out"* — public elements are forever. | **NOT re-opened.** |
| **Tarski (1951)**, **Collins (1975)**, **Cauchy–Bunyakovsky–Schwarz**, **Kepler (1609) / Newton (1687)** | Inherited from PR #10418 for the envelope proof itself, which this decision cites but does not re-derive. | Inherited; see that document's checked-anchor register. |

## 9. Pointers

- `src/Bayesian/BoundJustification.fs` — the type (internal)
- `src/Bayesian/AssemblyInfo.fs` — the one `InternalsVisibleTo` entry
- `src/Bayesian/OrbitalAsymmetryBudget.fs` — `deltaMaxBound` (internal) / `deltaMaxMs` (unchanged public)
- `tests/Bayesian.Tests/BoundJustification.Tests.fs` — BJ-1..BJ-7
- `docs/research/2026-08-13-soraya-light-time-asymmetry-envelope-routing-and-proof.md` — the proof and the refutation (PR #10418)
- `docs/research/2026-08-13-lessons-belong-in-the-harness-not-in-rules-the-externalization-ladder.md` — the ladder (PR #10437)
- `GOVERNANCE.md` §19 — the review this decision discharges
- `memory/ilyana/NOTEBOOK.md` — verdict log
