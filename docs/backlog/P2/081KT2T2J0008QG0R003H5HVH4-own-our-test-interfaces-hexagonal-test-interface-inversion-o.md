---
id: 081KT2T2J0008QG0R003H5HVH4
priority: P2
status: open
title: "Own our TEST interfaces — hexagonal/dependency-inversion on the test frameworks (test-interface-inversion OR reflection); xUnit / FsCheck / Z3 / Rust-test / TS-runner become swappable adapters behind our test-contract ports; no vendor test-interface in the core (Aaron 2026-06-02)"
tier: substrate-quality
effort: L
created: 2026-06-02
last_updated: 2026-06-02
depends_on: []
composes_with: [081KT2T2J0008QG0R000S7GHQ8, 081KT2T2J0008QG0R0008TFHJT, 081KT2T2J0008QG0R000YZ3NMY, 081KT07NV0008QG0R0032MCYER, 081KRFA460008QG0R0018SN61J]
tags: [hexagonal, own-your-interfaces, test-interface-inversion, reflection, ports-and-adapters, dependency-inversion, fscheck, xunit, z3, sat-solver, rust-test, ts-runner, cross-language, bcl-interface-boundary, formal-proof-first, test-contract-port, property-engine, proof-engine, infer-net, aaron]
type: feature
---

# Own our TEST interfaces — hexagonal on the test frameworks

## Ask (Aaron 2026-06-02)

> *"we want hexangonal interaces on our test too we have backlog but if things like
> z3 or sat solvers are easy we should try it"* + *"yes test interface inverstion or
> reflection would be great."*

Apply the [`bcl-interface-boundary`](../../../.claude/rules/bcl-interface-boundary-own-your-interfaces-hexagonal.md)
rule (own-your-interfaces; depend on a 3rd-party *implementation*, never its
*interface*) to the **test frameworks** themselves. Today every test depends on
**FsCheck / xUnit / Z3 directly** — the SOFT path (they're provenance-vetted,
widely-used de-facto standards, so direct dependence is the acceptable *starting
place*). This row is the **HARD path**: define **our** test-contract ports and make
the frameworks **swappable adapters**.

## Why

- **No vendor test-interface in the core.** A property/proof in the engine should
  name *our* `IPropertyEngine` / `IProofEngine` / `ITestContract`, not
  `FsCheck.Property` / `Microsoft.Z3` / `xUnit.Fact` directly — so swapping a
  framework is an adapter change, not a test rewrite (the migration is free *once a
  port exists*; not free if we keep depending on the vendor interface — per the rule).
- **Cross-language test parity.** The same test-contract expressed in F# / C# / Rust /
  TS lets the four-oracle byte-lock (081KT07NV0008QG0R0032MCYER) cover *tests*, not just values — one
  contract, four adapters, same golden vectors.
- **Formal-proof-first leverage.** 081KT2T2J0008QG0R000YZ3NMY's proofs (C1 landed; C2–C14 owed) currently
  bind to FsCheck/Z3 idioms. Behind a `IProofEngine` port, "prove this group law"
  becomes substrate-portable: Z3 today, a different SMT/SAT backend tomorrow, without
  touching the proof statements. (Aaron's "if z3/sat is easy, try it" — C1 already
  proved it's easy; the port makes the *next* solver a drop-in.)

## Two candidate mechanisms (Aaron named both — design sub-question)

| Mechanism | Shape | Trade |
|---|---|---|
| **Test-interface inversion** (explicit ports) | Define `ITestContract`/`IPropertyEngine`/`IProofEngine`; hand-write an adapter per framework (FsCheck→property, Z3→proof, xUnit→fact). | Explicit, type-checked, no magic; more boilerplate per adapter. |
| **Reflection** | A reflection-based layer that discovers/binds test methods + maps our contract onto the framework's discovery at runtime. | Less boilerplate; the magic is the cost (harder to type-check; reflection is itself a vendor-coupling unless wrapped). |

Default-to-both until prototyped: inversion is the conservative HARD-rule form;
reflection may reduce per-adapter boilerplate but must not re-introduce vendor
coupling. The PoC compares them on the C1 proof.

## Per-framework adapters (the swappable set)

- **Property**: FsCheck (F#/C#) · Hedgehog (alt) · `proptest`/`quickcheck` (Rust) · `fast-check` (TS)
- **Proof / SAT-SMT**: Z3 (`z3ScriptHolds` today) · CVC5 / other SMT (drop-in via the port)
- **Fact/unit**: xUnit (today) · the per-language native runners (Rust `#[test]`, TS test runner)

## Scope / acceptance

1. Define the test-contract port(s) — `ITestContract` + `IPropertyEngine` +
   `IProofEngine` (F# first, the engine's language).
2. ≥1 adapter each: **FsCheck → IPropertyEngine**, **Z3 → IProofEngine**.
3. **Migrate the C1 proof** (081KT2T2J0008QG0R000YZ3NMY, the first landed proof) behind the ports as the
   PoC — same proof, now naming our interface not FsCheck/Z3 directly. Prove the
   migration is an adapter swap.
4. Prototype the **inversion vs reflection** mechanisms on (3); pick the default; record why.
5. Cross-language stub: the same contract shape in one other language (Rust or C#) to
   prove portability (composes 081KT07NV0008QG0R0032MCYER byte-lock at test scope).
6. Contribute-upstream check (per the rule): if wrapping surfaces a framework
   improvement, file it upstream.

## Composes with

- **081KT2T2J0008QG0R000S7GHQ8** (the engine whose tests this re-homes) · **081KT2T2J0008QG0R0008TFHJT** (registry/BCL — test
  primitives are primitives too; this is the BCL boundary at test scope) · **081KT2T2J0008QG0R000YZ3NMY**
  (the proofs that sit behind `IProofEngine`) · **081KT07NV0008QG0R0032MCYER** (four-oracle byte-lock —
  extends to test contracts) · **081KRFA460008QG0R0018SN61J** (F# HKT — the port types)
- rules: [`bcl-interface-boundary-own-your-interfaces-hexagonal`](../../../.claude/rules/bcl-interface-boundary-own-your-interfaces-hexagonal.md)
  (the HARD/SOFT discriminator this row is the HARD path of), `formal-proof-first-...`
  (proofs behind a portable proof-engine), `monad-propagation-pattern-...`
  (the port is a Kleisli arrow), `numerical-algebra-shaped-into-the-generic-math-interface-...`
  (same own-the-interface discipline at numeric scope).

## Substrate-honest framing

NOT urgent (P2) — the SOFT path (direct dependence on de-facto-standard test
frameworks) is the correct *starting place* and is what C1 + every current test uses.
This row is the HARD-path migration, valuable when cross-language test parity or
solver-swappability earns its keep. Do NOT block landing proofs on this; land proofs
against the deps now, migrate behind ports when this lands.
