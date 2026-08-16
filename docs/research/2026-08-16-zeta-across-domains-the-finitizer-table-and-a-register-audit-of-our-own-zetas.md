# ζ across domains — the finitizer table, and a register audit of our own zetas

**Date:** 2026-08-16 · **Ferried by:** Otto (shadow) · **Origin:** Aaron, 2026-08-16 —
*"we are named on the riemann zeta so lets see where this is relevant, we have a lot of zeta
functions and numbers many different ones in different areas. It's weird."*

Aaron also recalled a list he thought was lost: *"there was some long history of famous
mathematicians and like some specific solutions to some problems and their special numbers, it
was like a hall of famous mathematicians lol, i wish i would have saved it."*

**It was never lost — it was never minted.** It was produced in a session on 2026-07-10, offered
as a durable doc, and the thread moved on before the offer was taken. It survived only in Aaron's
personal paste archive. This doc is that minting, plus the thing the original did not have: an
honest audit of which of *our* zetas are the same object and which merely share a name.

## 1. The table — **the special values of the Riemann zeta function**

**Its proper name** (Aaron asked for one so it can be recalled together): these are the **special
values of the Riemann zeta function** — mathematicians say **zeta values**; the multi-variable
generalization is **multiple zeta values (MZVs)**. Strictly, the last row does not belong under
that heading — *a zero is not a value* — so the table is **zeta values + the non-trivial zeros**.

**The organizing principle, and the better recall handle: Bernoulli numbers.**

- negative integers: **ζ(−n) = −B_{n+1}/(n+1)** — B₂ = 1/6 → ζ(−1) = −1/12; B₄ = −1/30 → ζ(−3) = +1/120
- positive evens: **ζ(2n) = (−1)^{n+1} B_{2n}(2π)^{2n} / (2·(2n)!)** — B₂ again → ζ(2) = π²/6
- **ζ(3) has no closed form.** The odd integers are not Bernoulli-expressible, which is exactly
  why Apéry's 1979 irrationality proof was a sensation.

So a single constant, **B₂ = 1/6**, generates both π²/6 and −1/12; the functional equation is what
ties the two formulas together. (Anchors: Euler, *Institutiones calculi differentialis*, 1755;
Riemann 1859 for the continuation and functional equation.)

**A near-miss worth keeping, because it is not a slip.** Aaron, recalling the handle: *"i kept
wanting to say euler's numbers but i knew that was not right — i think it was Bernoulli numbers."*
It was. But **Euler numbers E_n are a real and closely related object**, not a confusion:

| | generating function | attached L-function |
|---|---|---|
| **Bernoulli** B_n | x/(eˣ − 1) | **ζ(s)** — the Riemann zeta function |
| **Euler** E_n | sech(x) = 2/(eˣ + e⁻ˣ) | **β(s)** — the Dirichlet beta function |

Euler numbers stand to the Dirichlet beta function exactly as Bernoulli numbers stand to ζ —
β(−n) is given by Euler numbers, and β(2) is Catalan's constant (whose irrationality, like ζ(3)'s
before Apéry, is the hard open question). So the reach for "Euler numbers" landed on the right
*family*, one L-function over. Recorded because a near-miss that identifies a genuine sibling is
evidence the structure is held correctly, not evidence of fuzziness.

One object — ζ, **the finitizer**: it assigns a divergent sum a finite value — surfacing across
analysis, number theory, and physics over roughly 250 years.

| ζ-value | number | domain | who / when |
|---|---|---|---|
| ζ(2) | π²/6 ≈ 1.6449 | analysis — the Basel problem | Euler, 1735 |
| ζ(3) | Apéry's constant ≈ 1.2021 | number theory — irrationality | Apéry, 1979 |
| ζ(−1) | −1/12 | physics — Casimir / string theory | Euler → Ramanujan → Hawking 1977 (ζ-reg of path integrals) |
| ζ(−3) | 1/120 | physics — EM Casimir vacuum (Σn³) | Casimir 1948 · Lamoreaux 1997 (measured) |
| the non-trivial zeros | conjectured on Re(s) = ½ | number theory — the primes | Riemann, 1859 |

The wider family, for completeness: **Hurwitz** ζ(s,a) (shifted), **Dedekind** ζ_K (number
fields), **Selberg** (hyperbolic surfaces), **Ihara** (graphs), **Ruelle** (dynamical systems,
over periodic orbits). Euler's product formula is the hinge for all of them: a sum over the
integers equals a product over the primes, so ζ carries prime information by construction.

**Why this is the project's name.** Zeta is named for the *finitizer* — the organ that makes
confined infinity affordable. The Casimir gap is the physical instance; ζ-regularization is its
computation.

## 2. Register audit — which of ours are actually ζ

Aaron's "it's weird" is the right instinct, and the discipline for it is already on file
([`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md)): **a
coincidence of numbers is a generator, not an identification.** Sorted by register:

| ours | relation to Riemann ζ | register |
|---|---|---|
| the project name **Zeta** | ζ-regularization as finitizer | **anchored** — Hawking 1977, Casimir 1948 |
| `berry-keating-spectral-check.ts` | the tick-sampling operator's B₂/2! = **+1/12** vs ζ(−1) = **−1/12** | **§B interpretation, explicitly unproven** |
| §A #22 T-1/12 Euler–Maclaurin theorem | Bernoulli B₂/2! in discrete-sum correction | **proven — but it is Euler–Maclaurin, not RH** |
| the ISociety graph ζ | Ihara-family (graph zeta) if formalized | **coincidence of family name** until constructed |
| assorted "zeta" identifiers | naming after the project | **name only — no mathematical content** |

**The load-bearing distinction.** `berry-keating-spectral-check.ts` is the only place Riemann is
genuinely in reach, and the file already states its own limit correctly:

> STATUS: §B interpretation — the standard mathematics is established; the identification of the
> tick-sampling operator with the Berry–Keating Hamiltonian is not yet proven.

That honesty is doing real work, because the two 1/12s **have opposite signs**. B₂/2! = +1/12
arises from the Euler–Maclaurin correction to a discrete sum; ζ(−1) = −1/12 arises from analytic
continuation.

**And §1 explains the coincidence — which makes it weaker evidence, not stronger.** Both numbers
are **B₂-derived**: the Euler–Maclaurin expansion's coefficients *are* Bernoulli numbers
(B₂/2! = 1/12), and ζ(−n) = −B_{n+1}/(n+1) gives ζ(−1) = −B₂/2 = −1/12. So the shared magnitude
is not an unexplained resonance — it is what you get whenever the same constant B₂ = 1/6 appears
in two Bernoulli expansions.

This is the promotion path running in the *deflationary* direction, and it is worth stating
plainly because the instinct runs the other way: **finding the common cause of a coincidence
removes its evidential value for the deeper claim.** Before, one might have read "both are 1/12!"
as a hint that the tick-sampling operator really is Berry–Keating's. After, the match is fully
accounted for by both being Bernoulli expansions — and it says nothing whatever about the
operator's spectrum being the zeta zeros. The mystery dissolved into a definition.

So the correct reading of `berry-keating-spectral-check.ts` is unchanged in status (§B) but
weaker in support than the 1/12 correspondence made it look. The coincidence was a legitimate
reason to look; it is not a result, and it is now not even much of a hint.

Berry–Keating itself (H = xp, the conjecture that the zeros are a Hamiltonian's eigenvalues) is
the same lineage as the Montgomery–Dyson pair-correlation observation — real mathematics, and
still a conjecture.

## 2b. The Ruelle bridge — chaotic periodic orbits as "primes"

**Provenance, stated because it changes the register:** Otto proposed this connection on
2026-07-10 and flagged it as *"me connecting your two fragments, not certifying it was in the
original list."* Aaron, 2026-08-16: *"this is a good connection, i'd not made it myself but i
agree with it."* So it is **proposed by Otto, endorsed by Aaron, and not independently derived by
him** — which is exactly the case where transmissibility is untested, so it is recorded as an
agreed analogy rather than a shared conclusion.
(cf. [[feedback_aaron_distrust_interpretation_keep_fact_and_ai_as_sole_minus_one_risk_2026_07_11]]
— be *a* −1, not *the* −1; agreement from one party is not an independent rebuild.)

**The bridge.** The **Ruelle (dynamical) zeta function** is built as an Euler product over a
chaotic system's **primitive periodic orbits** — the orbits play precisely the role the primes
play in Euler's product for ζ(s). The **three-body problem** is the canonical chaotic system
(Poincaré 1890, the origin of the whole field). So the decision/3-body thread and the ζ-values
thread meet at Ruelle's zeta over periodic orbits.

**What this is and is not.** It is a real structural parallel — the Euler-product *form* is
genuinely shared, not merely a naming coincidence, and that is more than the ISociety-graph-ζ row
above currently has. It is **not** a claim that our 3-body/decision work has a Ruelle zeta; no
such object has been constructed here. Constructing one — an explicit Euler product over the
periodic orbits of a specific dynamical system we actually run — is what would move this row from
*agreed analogy* to *anchored*.

Anchors: Ruelle 1976 (dynamical zeta functions) · Artin–Mazur 1965 · Poincaré 1890 (three-body
chaos) · Selberg 1956 (the trace-formula ancestor of the orbit/prime correspondence).

## 3. What is genuinely relevant to us

- **Euler's product formula** — a sum over integers ≡ a product over primes. This is a
  *structural* fact we use, not a coincidence: it is why ζ encodes primes at all.
- **ζ-regularization as a discipline** — assigning a divergent quantity a principled finite
  value. This is the project's name and its honest anchor.
- **Euler–Maclaurin / B₂** — proven, load-bearing in §A #22, and independent of RH.

## 4. What is NOT claimed

- We have made no progress on the Riemann hypothesis and are not attempting it.
- The tick-sampling ↔ Berry–Keating identification is **unproven** and stays in §B.
- The 1/12 correspondence is a **coincidence of magnitude with opposite signs**, recorded as a
  generator under the coincidence-index discipline — labelled, so it never silently becomes a
  belief.

## Pointers

- `src/Core.TypeScript/oracle/berry-keating-spectral-check.ts` — the one live Riemann-adjacent check
- `docs/research/2026-07-10-zeta-finding-form-euler-the-hinge-geometric-topological-zeta-keystone-book-gnosis.md` — Euler as the hinge
- `docs/research/2026-06-13-ferry-41-the-zeta-ramanujan-critical-line-as-orientation-the-ledger-as-the-anti-mandela-effect.md`
- [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) — the register rule this doc applies
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) — why §B stays §B
- `docs/research/ip-questionable/2026-08-16-from-first-principles-podcast-claude-riemann-67-percent-third-party-claims.md` — the podcast that prompted this
