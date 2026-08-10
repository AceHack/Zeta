/-
  ImaginaryStack.lean — the library root.

  `lakefile.toml` has declared `[[lean_lib]] name = "ImaginaryStack"` for as long as
  the directory has existed, but this root module was never written. A Lake
  `lean_lib` maps its name to a root file; without one, `lake build ImaginaryStack`
  fails with "no such file or directory: ImaginaryStack.lean", and because the lib
  is also absent from `defaultTargets = ["Lean4"]`, a bare `lake build` never
  reaches it either.

  The consequence was silent and load-bearing: nothing could `import
  ImaginaryStack.ErasureDistance` through the package, so `PhaseClockErasure.lean`
  — which does exactly that — was unimportable and therefore untestable in CI. It
  sat outside every check while carrying a `sorry` on a theorem later shown false
  (see `docs/letters/to-soraya-xorshift-mod17-in-rscode-is-false-not-merely-unproven.md`).
  ToyModel and ErasureDistance escaped the hole only because the workflow invokes
  `lake env lean` on them by explicit path.

  So this file is the prerequisite for auditing the library at all, not a
  convenience: it is what makes the modules addressable as modules.

  NOT imported here: `ImaginaryStack.ToyModel`. It and `ErasureDistance` each
  declare a top-level `abbrev F`, so importing both into one module fails with
  "environment already contains 'F' from ImaginaryStack.ToyModel". That collision
  is a real latent defect — two sibling modules claiming the same unqualified name
  — but repairing it means editing a proof that is currently sound and CI-gated,
  so it is recorded here rather than fixed in passing. ToyModel keeps its own
  explicit `lake env lean` step in `.github/workflows/lean-proof.yml`, which is how
  it has always been checked.

  Importing `PhaseClockErasure` transitively pulls in `ErasureDistance`, so this
  root makes both buildable and importable.
-/

import ImaginaryStack.PhaseClockErasure
