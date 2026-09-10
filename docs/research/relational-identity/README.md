# Relational identity research

This lane distinguishes the additive per-identity entropy/source floor from
the pairwise cross-consistency multiplier, and names the causal receipt
structure preserved between skewed local memories on a declared disclosed cut.
It is separate from ARC and rendered-signal prediction.

- [Shipped component-interpretation correction](2026-09-06-component-interpretation-correction.md):
  shared-state recoding at detector/quorum boundaries, exact graph semantics,
  and limits on progress and time-reversal claims.
- [2026-09-06 results](2026-09-06-results.md): exact native/Python replay,
  retained collusion and entropy counterexamples, all mutation outcomes, and
  workload-accounting limits.
- [2026-09-06 preregistration](2026-09-06-protocol.md): assumptions, explicit
  functor, workload accounting, attack controls, independent replay, and
  promotion limits.
- [Pre-result clarification](2026-09-06-clarification.md): Actor-bound
  authentication, replay positions, exact fixtures and first review defects.
- [Parent handoff](../../handoffs/2026-09-06-vera-to-vera-predictive-state-research-and-arc3-bridge.md):
  source history and the broader research agenda.

No result in this lane currently proves physical-source distinctness, Sybil
soundness, personhood, a Lorentz metric, or a CQM/Clifford equivalence.

## Executable source

The original source is `archive/relational-identity-20260906-source-v1`; the
[repaired source](2026-09-06-source-repairs.md) is
`archive/relational-identity-20260906-source-v4` (v2 and v3 are also retained).
The repaired archive pins the kernel, exact
fixture panel, and independent Python implementation before execution.

- [F# kernel](../../../src/Research.FSharp/RelationalIdentity.fs)
- [Frozen native fixtures](../../../src/Research.FSharp/RelationalIdentityExperiment.fs)
- [Independent Python regenerator](../../../src/Interp.Python/zeta_interp/relational_identity.py)

From the archive checkout, build Core and run the native runner to a new
output path, then replay it independently. Both commands refuse overwriting
an existing output:

```sh
dotnet build src/Core/Core.fsproj -c Release
dotnet fsi --warnaserror src/Research.FSharp/run-relational-identity.fsx /tmp/relational-native.json
uv run --project src/Interp.Python python -m zeta_interp.relational_identity /tmp/relational-native.json /tmp/relational-python.json
```

The native runner and strict replay resolve the immutable archive and verify
every registered source hash against both its commit and the supplied checkout.
The native receipt identifies the loaded Core assembly by SHA256 and MVID. Current-tree regression tests compare the complete semantic panel
and hash schema, so historical source pins do not prohibit unrelated future
source edits. A separate temporary-snapshot test checks hash rejection.

For the lane's lint/typecheck gate, run from `src/Interp.Python` exactly as CI
does. `uv --project` selects an environment but does not change Ruff's working
directory or first-party import discovery:

```sh
cd src/Interp.Python
uv run ruff check .
uv run ruff format --check .
uv run mypy zeta_interp/ tests/
```
