# Lumen Resume State — Post-Face-3 / Zeta-IR-v4

**Context:** The math-team Face-3 targets (T1, T2, Bridge Functor) are fully discharged and merged. The grammar has evolved to `zeta-ir-v4` (adding the `add` op, anchored to Knuth's MMIX LCG). This backlog captures the four immediate follow-on options identified on 2026-06-20, preserving enough context for any teammate to pick up cold.

## Option 1: Chase the shrink (The Minimal Generating Set)

**Status:** **DONE** (PR #8826, merged 2026-06-20). Proved the 6-op v4 grammar reduces to the 4-op minimal generating set {mul, add, xshrxor, xrotxor}. Key hidden collapse: `rotl r == xrotxor [0; r]` via 𝔽₂ self-cancellation (x ^ rotl(x,0) ^ rotl(x,r) = rotl(x,r)). Note: docs/research/2026-06-20-lumen-zeta-ir-minimal-generating-set.md; FsCheck proofs in ZetaIrMinimalSet.Tests.fs. (Also fixed the BenPort Debug/Release alloc guard properly along the way, PR #8827.)
**The bet:** Aaron observed "things grow before they shrink." The grammar grew across four versions (v1: `mul`, `xorshr` → v2: `rotl` → v3: `xrotxor`, `xshrxor` → v4: `add`). Now that the zoo is full, the compression is visible. `nasam`'s `xshrxor [s]` already strictly generalized v1's `xorshr s`.
**The task:** Find the minimal generating set that v1..v4 collapse into. Write a research note + F# proof showing how each op reduces to the core set. This is the deepest in-lane math available without touching fragile surfaces.

## Option 2: Port a second add-user (ChaCha quarter-round)

**Status:** **DONE** (PR #8855, merged 2026-06-20). Ported MurmurHash3's 32-bit block mix tail (`h = rotl(h, 13); h = h * 5 + 0xe6546b64`) as the second `add`-anchor generator under `zeta-ir-v4`. This proves the `add` op generalizes across multiple independent algorithms, rather than being a single-generator special case. Crucially, it combines `add` with `rotl` and `mul`, giving the minimal-set proof (the shrink) a real witness in the generator registry. Fully F# tested, cross-verified with the generic TS N-way harness, and golden byte-locked.
**The context:** v4 added the `add` op anchored to a single generator (Knuth's MMIX LCG). A core repo discipline is that grammar extensions should generalize across multiple generators.
**The task:** Port the ChaCha quarter-round (or another public-domain add-user like PCG) to prove `add` generalizes exactly the way `mul` and `xorshr` did. More implementation than proof.

## Option 3: Probe the genuinely-open quine

**Status:** **DONE** (math team, issue #8867, 2026-06-21; verified by Lumen on main). The lone `sorry` in `gen_self_application` is discharged sorry-free. Sharper than this brief predicted: the ∀-codec form is **vacuously true** (NOT false) — `decode ∘ encode = id` is unsatisfiable because `IrTerm` is infinite and `UInt64` finite (pigeonhole `no_total_uint64_codec`, self-contained `no_bounded_injection`, no Mathlib). So the obstruction is UPSTREAM of the op grammar — v4 `add` does NOT unlock it; the wall is the finite register. The genuinely non-vacuous quine is `gen_self_application_exists_codec` (concrete encode/decode/selfCode on `gen`'s fixed-point set), axioms `[propext, Quot.sound]` — no `Classical.choice`, no `sorryAx`. Verified independently: `lean Lean4/GenGenFixpoint.lean` clean, axiom audit confirmed.
**The context:** `src/Core.Lean4/Lean4/GenGenFixpoint.lean` contains one documented `sorry` — the full homoiconic quine (the deep structural claim).
**The task:** This is real research. Go in honestly: surface structure, probe the edges, but do not claim a full discharge unless the proof is airtight.

## Option 4: The workflow patches in issue #8760

**Status:** **PARTIALLY DONE / BLOCKED ON HUMAN PUSH** (2026-06-21). Two patches: (1) `lean-proof.yml` type-check + axiom-audit wiring for the Face-3 proofs — ALREADY LANDED by Aaron in commit `c94b3802f` (covers GenGenFixpoint, CayleyDicksonDoublyEven, AND BridgeFunctor). (2) `build-ai-cluster-iso.yml` trigger-path fix (add `.mise.toml`, `tools/setup/**`, `src/Core.TypeScript/observe/**`) — I prepared + applied it locally but CANNOT push: the sandbox `gh` token is the same automation-app tier that lacks `workflows` scope (`refusing to allow a GitHub App to create or update workflow ... without workflows permission`). Posted the ready-to-apply diff as a comment on issue #8760 (comment 4761070769) for a human maintainer with `workflows` scope to apply + push. This is the ONLY remaining Face-3 backlog item, and it is a hard permission boundary, not a work gap.
**The context:** Handed off earlier during Face-3. The CI trigger-paths and lean-proof wiring need cleanup.
**The task:** Pure maintenance. Clear the thread, ensure CI runs exactly when needed without redundant builds.
