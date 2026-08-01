# VOID discharges — quarantined 2026-08-01. **These files are NOT evidence.**

> **Do not cite anything in this directory as proof of anything.**
> Every file here was written to "discharge" a conjecture in
> [`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`](../../FROZEN-CORE-AND-CONJECTURE-REGISTER.md).
> All six discharges were reviewed on 2026-08-01 and **none of them met §A's bar**. The
> conjectures were demoted §A → §B. The code is retained, unexecutable, so the record is
> auditable — not because it demonstrates anything.

## Why they are quarantined rather than deleted

Deleting them would break the register rows that cite them ("Prior claim, RETAINED FOR THE
RECORD"), and the repo's discipline is to **mark NOT IN FORCE rather than delete**. But leaving
them under `src/Core.TypeScript/verify/` was actively harmful:

- `verify/` reads as "this is verification code." It was not verification code.
- Nothing in `gate.yml` ran them, so they were **ungated dead weight that read as proof**.
- Worse: `bun test src/Core.TypeScript/verify/` reported **13 pass, 0 fail**. The
  `test:typescript` script is a bare `bun test`, so any developer running the suite saw
  13 green tests that looked like discharged conjectures. That is **false-green CI** — the
  single most expensive failure mode in a proof portfolio, because it costs nothing to
  produce and is trusted by default.

So: moved out of the source tree, and every extension suffixed **`.void`** so no test runner,
bundler, or type-checker will ever execute or green them again. They are text (per
`no-binary-in-proof-lineage`), diffable, and readable — just not runnable.

## The systemic defect (why all six failed the same way)

**None of the discharge scripts could FAIL.** Each defines its own bound, chooses its own
constants, and writes its own certificate, so success was the only reachable state.

> A run that cannot fail is not a test but a formatted assertion.

In Z-set terms, a verification pipeline that only ever emits `+1` is an **accumulator, not a
fold**: with no retraction capacity it cannot be wrong, and therefore cannot be right.

| File | Why it is not evidence |
|---|---|
| `z2-halsey-amplitude-discharge` | Its own certificate reported `status: OPEN`, `relativeError: 0.9468` against a `0.25` threshold. **The falsifier fired and was overridden by prose** — the register cell was written DISCHARGED anyway. |
| `z4-sle-harmonic-discharge` | A curve fit to `κ = 8(D_f − 1)`. DLA is famously **not known to be conformally invariant / SLE-describable** — that is an open problem, so a fit cannot discharge it. No goodness-of-fit test, no falsifier. |
| `z5-ico-reticulum-discharge` | **Nothing is measured** — `L = 5.0` is a hardcoded default, so no Reticulum transport was exercised. The inference also runs backwards: being *below* a bound is what classical systems do; non-classicality requires *exceeding* a classical bound (CHSH `S > 2`), never falling under a quantum one. And its "Tsirelson bound" `1/(3√2)` is not a Tsirelson bound at all (see below). |
| `z6-fep-attractor-discharge` | **Provably circular.** `F(Df) = 0.5(Df−1)² − (2.42·Df − 0.5·Df²)` simplifies to `Df² − 3.42·Df + 0.5`, a parabola with minimum at `3.42/2 =` **exactly 1.71** — the known DLA value, placed there by the choice of `2.42`. The docstring even contradicts the code, the fingerprint of tuning constants to hit the target. |
| `z7-pearson-discharge` | `r = 0` is an **algebraic identity, not a measurement**: `runDLA(seed)` never receives the `compiler` argument, so every compiler label scores the SAME output, forcing `cov(size, D_f) = 0` by construction. **No WASM module is ever executed.** The row also contradicts its own certificate (row: 4 compilers/40 pairs; certificate: 8 compilers/80 pairs). |

**Z-3** is the sixth. It has no file here because its "certificate" was a *browser React
component* — `demo/identity-dla-site/src/components/Z3DischargePanel.tsx`, retained in place
with a retraction banner. It computed `-ln((κ·TSIRELSON)/κ)`, in which **κ cancels
symbolically before any float is evaluated**: the whole panel is the identity `−ln(1/x) = ln(x)`,
true for every `x`, and therefore silent about Loewner entropy, SLE, or κ. No Loewner equation
is integrated anywhere in it.

## The constant these lean on is also misnamed

`1/(3√2) ≈ 0.2357` appears throughout this work labelled "the Tsirelson bound" or "the quantum
correlation ceiling". **It is neither.** Tsirelson's bound is `S ≤ 2√2 ≈ 2.828` on the CHSH
*correlator* — implemented correctly at [`src/Core/Tsirelson.fs`](../../../src/Core/Tsirelson.fs)
(`S² = 8` in exact integer arithmetic) and `src/Core/BellTest.fs`. There is **no Tsirelson bound
on a correlation coefficient**, and quantum correlations are not capped at 0.2357.

`1/(3√2)` is `ρ*/√2` — the Condorcet limit `ρ* = 1/3` pushed through the **freely chosen** linear
map `ρ = S/12`. This repo's own derivation attempt already concluded it *"cannot be derived from
first principles; it follows forced from two named modeling choices [made] for homoiconicity"*:
[`2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md`](../2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md).

The failure was not that the number was invented — it was declared honestly at its origin. The
failure is that **the name travelled and the caveat did not**: from `YinYangEnsemble` (caveated)
→ the DLA renderers (caveat dropped) → the public demo site and Z-3/Z-5 (read as physics).

## What a re-discharge requires

1. A **falsifier that could have fired** — demonstrate the failing case before claiming the passing one.
2. An **independently-sourced measurement**, not a hardcoded default.
3. **No self-certification** — the artefact that judges may not be the artefact that claims.
4. The **BP-16 second independent tool** (skipped on all six).
5. The independent variable must be **connected to the outcome** (Z-3 and Z-7 both failed this).

## Pointers

- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B — rows Z-2 … Z-7, each retaining its prior claim marked NOT IN FORCE
- `src/Core.TypeScript/hygiene/lint-discharge-certificate-consistency.ts` — the CI guard; hardened 2026-08-01 so a row advertising a `Certificate:` must cite a resolvable `docs/research/*.json` (the hole Z-3 walked through)
- `docs/research/z{2,4,5,6,7}-discharge-certificate.json` — the certificates, marked VOID
