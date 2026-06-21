# Formal-proof claim ledger — for the asymmetric-critic (Kestrel) pass

**Purpose.** The maintainer is running the asymmetric critic (Kestrel) over all
the math proofs to catch bullshit. This ledger turns "review the proofs" into a
**targeted refutation task**: each proof is mapped to **the code claim it
asserts to verify**, plus the **specific vacuity a reviewer should try to
refute**. Kestrel's job per row: *does this property actually verify THAT claim,
or is it a restatement / tautology / library-guarantee?*

## The bar (the maintainer 2026-06-03)

> only proofs that actually help prove our code correctness, novel proofs, and
> our homeostat chains without heavy consensus … the code we deploy is
> mathematically verified against our claims of what the code does.

A proof must map to a **claim the code makes about its own behaviour** and verify
it. Already self-caught + removed under this bar: the **C13 Tick-monoid** property
(it verified .NET `int` arithmetic via a phantom `[<Measure>]` — the BCL, not
Zeta; #6635).

## Three critic layers (Kestrel is one)

1. **The tools** (Z3 / FsCheck / TLC) — *mechanical* critic; catches **unsound**
   math. Doesn't get tired.
2. **Kestrel** — *reasoning* critic; catches **vacuity / tautology /
   claim-mismatch** (the bullshit class). ← this pass.
3. **claim→proof bar** (authoring) — first line.

**consensus ≠ validation, applied to Kestrel too:** Kestrel *approving* a proof
is a second oracle agreeing, not the proof being right. Validation = it **runs**
(tool) + **maps to a claim** (bar). Kestrel checks the mapping is honest.

⚠️ **CI caveat:** the **Z3 legs self-skip in the gate** (z3 not in `gate.yml` —
081KT2T2J0008QG0R001X9PWKR open). Every Z3 row below was verified **locally** with z3 on PATH
(0 skipped), NOT in CI. TLC runs where the toolchain is provisioned. FsCheck runs
in CI.

## Legend

- **consensus-free?** — ✅ = the proof stands on the math alone (FsCheck/Z3/TLC
  over our code); ✗ = leans on cross-lang/seed agreement (the seed-lineage edge).
- **refute-target** — the specific way this row could be vacuous; what Kestrel
  should attack.

---

## Ledger

| # | Proof (file) | Claim it verifies | Tool | Seed/anchor | consensus-free? | **Kestrel refute-target** |
|---|---|---|---|---|---|---|
| **C1** | Gaussian message group — `Message.Tests.fs` + `Z3.Laws.Tests.fs` | `Message.fs` `( * )`/`( / )`/`One` form a **commutative group** ⇒ the BP combine is order-independent (else order-dependent garbage) | Z3 ∧ FsCheck | — | ✅ | Z3 is over ideal reals — does the FsCheck (real float) tolerance hide a divergence? Is "closure" actually proven or assumed? |
| **C2** | Beta message group — `Message.Tests.fs` + `Z3.Laws.Tests.fs` | group laws on shifted naturals `(α−1,β−1)`; **conjugate** closure (prior×likelihood stays proper) — NOT blanket closure | Z3 ∧ FsCheck | — | ✅ | the closure claim is **guarded** (only prior×likelihood). Is the guard honest, or does it dodge a real improper-product case the code would hit? |
| **C3** | Bernoulli message group — `Message.Tests.fs` + `Z3.Laws.Tests.fs` | group laws via log-odds add; finite only for p∈(0,1) | Z3 ∧ FsCheck | — | ✅ | generator bounds log-odds — does it avoid the p→0/1 regime where the **real** code would break? Is the domain restriction hiding a bug? |
| **C4** | `Message.marginal` monoid homomorphism — `Message.Tests.fs` | `marginal = Seq.fold ( * ) One`: identity-on-empty + `marginal(xs@ys)=marginal xs * marginal ys` + order-independent | FsCheck | — | ✅ | **partly a corollary of C1–C3's monoid.** Does C4 add anything, or just re-derive the monoid? (Defensible: it verifies `marginal` IS the fold — a claim about `marginal`'s code — but attack the independence.) |
| **C5** | BP exact-on-trees + termination — `BpExactOnTree.tla` + `Bp.Tests.fs` | `runToFixpoint` reaches the exact marginal on a tree (KFL 2001) + converges within the cap | TLC ∧ FsCheck | — | ✅ | TLC uses a **set-of-evidence abstraction** of the message (not numeric). Is the abstraction faithful, or does it assume the thing it proves? Non-vacuity was probed (`~converged` violated) — re-check. |
| **C6** | NaN-safe convergence — `Message.Tests.fs` + `Z3.Laws.Tests.fs` | `runToFixpoint`'s `not (d ≤ tol)` ⇒ a NaN/∞ residual counts as MOVED ⇒ divergent never reports "converged" | Z3 (QF_FP) ∧ FsCheck | — | ✅ | the Z3 is IEEE floating-point theory. Does it model the **same** comparison the F# code uses (`not (≤)`, not `>`)? A mismatch would make it prove the wrong operator. |
| **C7** | EP probit moment-match — `Ep.Tests.fs` | `probitProject` (GPML 3.58) matches numerical **quadrature** of `N(m,v)·Φ(x)` over the cavity domain | FsCheck (quadrature oracle) | — | ✅ | the A-S `erf` **cancels** between formula and oracle (both call `Normal.cdf`) — so this isolates the moment-match formula, NOT erf. Is the cavity domain (m∈[-4,4], v∈[0.1,6]) cherry-picked to where quadrature happens to agree? |
| **C10** | MessageBatch round-trip — `MessageBatch.Tests.fs` | `toMessages∘ofMessages = id` per family; **Bernoulli lossy at p→0/1** (honest, generator stays inside (0,1)) | FsCheck | — | ✅ | the Bernoulli generator avoids saturation — is "lossy at p→0/1" an honest scoping or a dodge of a real round-trip failure? |
| **C11** | batch = scalar product — `MessageBatch.Tests.fs` | columnar batch product = scalar product (value-equal; Gaussian bit-exact). **CAUGHT + FIXED** the false "bit-exact, proven" prose | FsCheck | — | ✅ | this row already corrected a bullshit claim — verify the **corrected** prose is now accurate (Gaussian bit-exact; Beta/Bernoulli value-equal, NOT bit). |
| **C12** | codec algebra — `Codec.Tests.fs` + `src/Core/Codec.fs` | codec = invariant functor closed under id/product/sum; `decode∘encode=id`; **injective** | FsCheck | — | ✅ | **injectivity is stated as "a corollary of round-trip" — HIGH-ATTENTION.** Is `(encode a = encode b) = (a = b)` genuinely testing the layout, or does it reduce to a tautology? (Authored to compare encoded bytes directly — verify it's not vacuous.) Also the imap-composition law uses non-bijective maps — confirm that's the structural law, not round-trip. |
| **C13** | DBSP operator algebra — `OperatorAlgebra.Tests.fs` + `Z3.Laws.Tests.fs` | `D∘I=I∘D=id`; `D=1−z⁻¹`; z⁻¹ defining; `I=running sum` (on the real Circuit) + Z3 telescoping inverses | FsCheck ∧ Z3 | — | ✅ | Tick-monoid already dropped. The Z3 telescoping is a 3-tick scalar stream — is 3 ticks enough, or does it miss a longer-stream failure? Does the FsCheck `D=1−z⁻¹` actually exercise distinct ticks? |
| **C14** | Z-set earn-its-keep prune — `ZSet.Tests.fs` | abelian-group laws (pre-existing) + **no zero-weight entry survives** + lookup is an additive homomorphism (prune preserves semantics) | FsCheck | — | ✅ | the abelian-group half pre-existed; C14 adds prune. Is "lookup homomorphism" non-trivial, or does it follow from `(+)`'s definition? Does the key-set (present + sentinels) actually cover the dropped-key case? |
| **DynamicValue** (canonical candidate) | `DynamicValue.Canonical.Tests.fs` | CBOR round-trip (8/8) + JSON round-trip (6/8) + **injective** CBOR + non-finite floats; **seed vectors are fixed points** of encode∘decode | FsCheck + seed | `golden-vectors{,-cbor}.json` | math half ✅ / seed-anchor ✗ | injectivity `(encode a=encode b)=(a=b)` — **same corollary risk as C12**. Float round-trip relies on `.Equals` being NaN-tolerant — is that hiding a real float mismatch? Is the JSON-subset generator (no Float/Bytes) dodging the partial-canonical cases? |
| **ZetaId** (canonical candidate) | `ZetaId/Canonical.Tests.fs` | `unpack∘pack=id` (bijective 128-bit layout) + **env-invariance** (32 random bits don't bleed into fields) + **injectivity** (no field aliasing, same env) | FsCheck | cross-verify seed (cited) | math half ✅ / seed-anchor ✗ (CrossVerifyTests) | injectivity compares **packed ids** (non-tautological — verify). env-invariance: is `mkEnv r1/r2` actually producing different randomness, or constant? The generator uses in-width bytes for enums + named DU cases — does it skip a valid field value the real code accepts (Authority.Raw)? |

---

## Highest-attention rows (where vacuity could hide)

1. **C12 + DynamicValue injectivity** — both stated "corollary of round-trip." Authored to be non-vacuous (compare encoded bytes / packed ids directly, not via decode). **Confirm** they don't reduce to `(a=b)=(a=b)`.
2. **C4** — partly re-derives the C1–C3 monoid. Defensible (verifies `marginal` IS the fold) but the weakest "novelty."
3. **C5 abstraction** — TLC over an evidence-SET model of messages; faithfulness of the abstraction is the thing to attack.
4. **C7 domain** — the cavity band is bounded to where the quadrature oracle is accurate; attack whether that band dodges a real failure regime.

## What is NOT here (honestly)

- **Seed-lineage half (half-b) for the F# Bayesian primitives** — C1–C14 are F#-only proofs; they have the **proof axis** but NO 4-lang byte-lock (consensus axis). Only **DynamicValue** + **ZetaId** have both axes (canonical candidates).
- **Soundness beyond what the tool checks** — Z3 proves the symbolic identity; FsCheck samples (default 100 cases); TLC checks the bounded model. None is a Lean-grade total proof. Kestrel should flag any claim that *implies* more than the tool delivers.
- **Nothing is marked `canonical` in the registry yet** — that's Soraya's ratification step after this pass.

## Composes with

- `.claude/rules/formal-proof-first-proven-by-default-consensus-not-validation-canonical-is-homeostat-proven-from-seed-ace-shields-zeta.md`
- `.claude/rules/asymmetric-critic-with-clarity-first.md` (Kestrel = the asymmetric critic; substrate-check before concern)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` (the compiler/tools as the mechanical critic that doesn't tire)
- `081KT2T2J0008QG0R000YZ3NMY` (the formal-coverage cadence this ledger audits)
- `081KT2T2J0008QG0R001X9PWKR` (z3-in-CI — why the Z3 rows say "verified locally")
