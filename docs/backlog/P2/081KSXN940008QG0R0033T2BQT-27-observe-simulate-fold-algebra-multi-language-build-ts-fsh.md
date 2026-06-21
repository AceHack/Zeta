---
id: 081KSXN940008QG0R0033T2BQT
title: observe/simulate/fold algebra — multi-language build (TS/F#/C#/Rust) + cross-language compiler-parity (= non-Byzantine BFT per 081KSV2WD0008QG0R00051XS0N)
status: open
priority: P2
created: 2026-05-31
attribution: aaron-2026-05-31
depends_on:
  - 081KSKBP80008QG0R000B3Y19A.5
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSXN940008QG0R000ZAQT3W
  - 081KSV2WD0008QG0R00051XS0N
  - 081KS3X9Y0008QG0R00218150M
tags:
  - workflow-engine
  - cross-language-parity
  - event-sourcing
  - multi-language
  - bft
  - deterministic-simulation
---

# 081KSXN940008QG0R0033T2BQT — observe/simulate/fold algebra in TS/F#/C#/Rust, made to agree

## The ask (operator 2026-05-31)

> *"can we do this in cs fs ts and rust and make them agree make sure we follow
> the deterministic simulation and all the other active diciplines and like the
> extra stuff in the manifesto or whatever we call our building codes now."*

Implement the **observe→act event algebra** (the `tools/observe` substrate:
`World` + `NextAction` event union + `simulate` reducer + `fold`/`replay`
projection) in **all four framework languages — TS, F#, C#, Rust — and make them
agree.** The TS reference impl landed in #6245 (`fold`/`replay` event-sourcing
foundation). This row tracks porting it to F#/C#/Rust with cross-language parity.

## The pattern already exists — 081KSV2WD0008QG0R00051XS0N (don't reinvent)

[081KSV2WD0008QG0R00051XS0N](../P1/081KSV2WD0008QG0R00051XS0N-tri-boolean-core-primitives-digital-qubit-floating-point-multi-language-build-compiler-parity-non-byzantine-bft-aaron-2026-05-30.md)
established the cross-language-parity pattern for TriBoolean (TS/F#/C#/Rust already
built: `src/Core.{CSharp,FSharp,Rust}.TriBoolean`). Its core insight:

> **Cross-language compiler-parity = non-Byzantine BFT consensus.** *"the
> compilers don't lie."* The spec emits the same shape in each language; the
> compilers verify the invariants hold (it compiles or it does not);
> **4-of-4 parity = consensus** (agreement-by-construction, not vote-on-a-value).
> Disagreement = a real spec ambiguity surfaced — the honest oracle.

This row applies that exact pattern to the observe-algebra primitive. Composes
with `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md`
(same shape across languages) + 081KS3X9Y0008QG0R00218150M (multi-oracle BFT) + 081KSV2WD0008QG0R00051XS0N (the parity
discipline).

## What "make them agree" means here (two layers)

1. **Compiler-parity (081KSV2WD0008QG0R00051XS0N layer):** each language implements the same algebra
   shape — `NextAction`/event as a closed sum type (F# DU / Rust enum / C# sealed
   record hierarchy / TS discriminated union), `simulate` as the exhaustive
   reducer, `fold` as the left-fold projection. 4-of-4 compile = the shape is
   right; a non-exhaustive match / missing variant fails the build in that lang =
   surfaced spec ambiguity.
2. **Runtime golden-vector parity (DST layer):** a **language-neutral fixture** —
   `{ initialWorld, events[], expectedFinalState, expectedReplayStates }` — that
   every impl replays and must reproduce **identically**. Same event log over the
   same initial world → byte-identical projected state in all four. This is
   deterministic-simulation (DST) across languages: the log is the seed; the
   projection is the deterministic output; parity is the cross-language replay
   check.

## Active disciplines (the "building codes") this build follows

The framework's building codes = the alignment floor ([`docs/ALIGNMENT.md`](../../ALIGNMENT.md)
HC/SD/DIR) + the **6 always-active disciplines** (per
`.claude/rules/dv2-data-split-discipline-activated.md`) + the rules. Map for this build:

| Discipline | How the multi-lang fold algebra honors it |
|---|---|
| **DST** | the golden-vector parity IS deterministic replay across languages — same log → same state, every lang |
| **Scale-free** | the algebra is the same at single-event and full-log scale (fold = repeated simulate); same shape per-tick and per-trajectory |
| **Lock-free / wait-free** | `simulate`/`fold` are pure functions — no shared mutable state, no locks; trivially concurrency-safe |
| **Weight-free** | the event union carries no implicit weighting; each variant is explicit |
| **DV2.0** | events (fast-changing log) vs projected state (derived) — the ledger/projection change-rate split |
| **Idempotency** | replaying the same log is idempotent at the projection level (fold is a pure function of the log); composes with the event-sourcing "state is a projection" property |
| **Alignment floor** | no metaphysical claims; pure operational algebra; the parity-as-BFT claim is operationally checkable (compilers + golden vectors) |

## Plan (multi-PR; TS reference exists)

1. **TS reference** — `tools/observe/observe.ts` `fold`/`replay` (#6245) ✅ DONE.
2. **Language-neutral golden-vector fixture** — a JSON fixture
   (`{initialWorld, events[], expectedFinalState, expectedReplayStates}`) emitted
   from the TS reference; the cross-language conformance spec.
3. **F# impl** — `src/Core.FSharp.Observe` (DU + reducer + fold) + parity test vs
   the fixture. (Core language; do first after the fixture.)
4. **C# impl** — `src/Core.CSharp.Observe` (sealed-record union + reducer + fold) + parity test.
5. **Rust impl** — `src/Core.Rust.Observe` (enum + reducer + fold) + parity test.
6. **Parity harness** — all four run the golden vectors; 4-of-4 byte-identical =
   consensus (081KSV2WD0008QG0R00051XS0N). Wire into the build matrix.

Sequence + exact crate/proj layout to mirror the `Core.*.TriBoolean` precedent.

## Acceptance

- [ ] Language-neutral golden-vector fixture defined (emitted from the TS reference).
- [ ] F#/C#/Rust impls of `World`/`NextAction`/`simulate`/`fold`/`replay` — each
      compiles clean (dotnet 0-warnings; `cargo build` clean).
- [ ] Each impl replays the golden vectors → byte-identical final + per-event states.
- [ ] 4-of-4 parity green in the build matrix (the BFT-by-compiler-parity property).
- [ ] Any disagreement triaged as a surfaced spec ambiguity (081KSV2WD0008QG0R00051XS0N discipline),
      not patched-over.
- [ ] DST + the other 5 disciplines verified per the table above.

## Composes with

- 081KSV2WD0008QG0R00051XS0N — the cross-language-parity = compiler-BFT pattern (this row applies it)
- 081KSKBP80008QG0R000B3Y19A / 081KSKBP80008QG0R000B3Y19A.5 — the workflow-engine + PoC the observe-algebra belongs to
- 081KSXN940008QG0R000ZAQT3W — GrammarPatch events live in this same algebra (multi-lang too, eventually)
- 081KS3X9Y0008QG0R00218150M — multi-oracle BFT (the consensus frame)
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md` — same-shape-across-languages
- `.claude/rules/dv2-data-split-discipline-activated.md` — the 6 always-active disciplines
- #6245 — the TS reference impl (`fold`/`replay`)
- `src/Core.{CSharp,FSharp,Rust}.TriBoolean` — the multi-lang layout precedent to mirror
