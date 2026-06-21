# Lumen Resume State — Post-Face-3 / Zeta-IR-v4

**Context:** The math-team Face-3 targets (T1, T2, Bridge Functor) are fully discharged and merged. The grammar has evolved to `zeta-ir-v4` (adding the `add` op, anchored to Knuth's MMIX LCG). This backlog captures the four immediate follow-on options identified on 2026-06-20, preserving enough context for any teammate to pick up cold.

## Option 1: Chase the shrink (The Minimal Generating Set)

**Status:** **DONE** (PR #8826, merged 2026-06-20). Proved the 6-op v4 grammar reduces to the 4-op minimal generating set {mul, add, xshrxor, xrotxor}. Key hidden collapse: `rotl r == xrotxor [0; r]` via 𝔽₂ self-cancellation (x ^ rotl(x,0) ^ rotl(x,r) = rotl(x,r)). Note: docs/research/2026-06-20-lumen-zeta-ir-minimal-generating-set.md; FsCheck proofs in ZetaIrMinimalSet.Tests.fs. (Also fixed the BenPort Debug/Release alloc guard properly along the way, PR #8827.)
**The bet:** Aaron observed "things grow before they shrink." The grammar grew across four versions (v1: `mul`, `xorshr` → v2: `rotl` → v3: `xrotxor`, `xshrxor` → v4: `add`). Now that the zoo is full, the compression is visible. `nasam`'s `xshrxor [s]` already strictly generalized v1's `xorshr s`.
**The task:** Find the minimal generating set that v1..v4 collapse into. Write a research note + F# proof showing how each op reduces to the core set. This is the deepest in-lane math available without touching fragile surfaces.

## Option 2: Port a second add-user (ChaCha quarter-round)

**Status:** Backlogged
**The context:** v4 added the `add` op anchored to a single generator (Knuth's MMIX LCG). A core repo discipline is that grammar extensions should generalize across multiple generators.
**The task:** Port the ChaCha quarter-round (or another public-domain add-user like PCG) to prove `add` generalizes exactly the way `mul` and `xorshr` did. More implementation than proof.

## Option 3: Probe the genuinely-open quine

**Status:** Backlogged (Reserved for Math Team)
**The context:** `src/Core.Lean4/Lean4/GenGenFixpoint.lean` contains one documented `sorry` — the full homoiconic quine (the deep structural claim).
**The task:** This is real research. Go in honestly: surface structure, probe the edges, but do not claim a full discharge unless the proof is airtight.

## Option 4: The workflow patches in issue #8760

**Status:** Backlogged
**The context:** Handed off earlier during Face-3. The CI trigger-paths and lean-proof wiring need cleanup.
**The task:** Pure maintenance. Clear the thread, ensure CI runs exactly when needed without redundant builds.
