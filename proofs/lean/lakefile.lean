import Lake
open Lake DSL

package dbsp_proofs where
  -- Enable Mathlib-style options: `moreServerArgs` is tolerated by
  -- current Lake, and the Mathlib-recommended server/options are
  -- inherited transitively from the Mathlib dependency below.
  leanOptions := #[
    ⟨`pp.unicode.fun, true⟩,   -- pretty-print ↦ instead of fun
    ⟨`autoImplicit, false⟩      -- Mathlib house-style: explicit binders
  ]

/--
Pin **Mathlib4** at a stable release tag matched to the Lean toolchain
pinned in `lean-toolchain`. We intentionally pin a release tag (not
`main`) so CI is reproducible. Bump in lock-step with `lean-toolchain`.

Policy: the tag must be the Mathlib release that corresponds to the
exact `leanprover/lean4:v4.X.Y` release in `lean-toolchain`. When a
new Lean release ships, Mathlib publishes a same-numbered release
tag (e.g. Lean v4.12.0 ↔ Mathlib v4.12.0); bump both together.
-/
require mathlib from git
  "https://github.com/leanprover-community/mathlib4" @ "v4.12.0"

@[default_target]
lean_lib DbspProofs where
  roots := #[`ChainRule]
  -- Mathlib's preferred compile flags; kept minimal here so the lib
  -- builds with or without Mathlib's global options file.
