# Projection integration source-binding roster proposal

Date: 2026-09-08
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Status: source-only proposal; no final source freeze or archive admission

## Observation cut and scope

This census read source imports, entrypoint plumbing and project references in
the coordinator writer at HEAD 2e051e8d0e5715dc3da6aa5176037d25598e74df.
The runner and its test were already modified; source continued changing during
these reads. This is a path/dependency census, not a coherent final source
snapshot, a source acceptance, or a set of final hashes. The independent
reference's corrected source is separately pinned at ae37ac066. No native
numerical output, copied DLL, registered input, solver, test or final runner was
read or executed for this census. No project module was imported by Python.

The [registered contract](2026-09-08-precision-gate-projection-proposed-contract.md)
requires a coordinator-supplied finite flat map, with reserved ProtocolSha256
and repository-relative source paths mapped to uppercase SHA256. The two
admission clarification documents remain separate required keys. Final source
bytes must be collected after the source repairs and independent reviews close.
The map does not generate its own expectation from a producer receipt.

## Finite path proposal

The following is a proposed base roster. Each listed line is one exact key;
there are no globs, directory hashes, inferred latest versions or nested Sources
objects. The final independently prepared map must add the chosen executable
coordinator driver and every new direct import it introduces. That driver has
not been selected in this census, so this proposal is deliberately not ready
for final admission. A source freeze must replace these pending obligations
with one closed, exact, reviewed set, rather than silently accepting additions.

### Python execution and local helpers

```text
src/Interp.Python/zeta_interp/precision_gate_projection_run.py
src/Interp.Python/zeta_interp/precision_gate_projection_cases.py
src/Interp.Python/zeta_interp/precision_gate_projection_comparison.py
src/Interp.Python/zeta_interp/precision_gate_projection_process.py
src/Interp.Python/zeta_interp/precision_gate_projection_reference.py
src/Interp.Python/zeta_interp/precision_gate_projection_intervals.py
src/Interp.Python/zeta_interp/hidden_switch_compiled_admission.py
src/Interp.Python/zeta_interp/hidden_switch_compiled_ieee.py
src/Interp.Python/zeta_interp/hidden_switch_compiled_record_encoding.py
src/Interp.Python/zeta_interp/hidden_switch_compiled_record_store.py
src/Interp.Python/zeta_interp/hidden_switch_compiled_storage.py
src/Interp.Python/zeta_interp/__init__.py
src/Interp.Python/zeta_interp/activations.py
```

The process-module path is required by the current runner's
NativeObservation import but was absent at the read cut. Its final source and
imports must be added before archiving; this note does not invent its contents.
The runner imports admission, bounded result encoding, record store, cases,
criteria and reference. Cases import admission, IEEE and result encoding;
criteria imports admission and cases. Reference imports IEEE and intervals.
The record store imports admission, result encoding and storage; encoding and
storage both import admission. IEEE, intervals and admission add no local
project import in the observed source. These statements describe source import
sites, not a claim that a particular process loaded them.

Ordinary package import first executes __init__.py, which imports activations.py;
activations imports external torch and transformer_lens. Their absence from
numerical formulas does not erase this actual package initialization route.
The two repository files therefore belong in the proposed map. External wheels
and their dependencies belong in the separately recorded installed environment,
not invented repository path entries. If a different bootstrap is later chosen,
its exact source and loaded-package behavior need explicit review; this census
does not authorize an unrecorded package stub or assume reduced dependencies.

The point-valued precision_gate_kernels_reference.py is historical mathematical
lineage, not an import of these interval/reference modules. Likewise the old
hidden-switch policy, stream generator, conformance, Python-identity collector
and replay modules are not brought into this map merely by name similarity.
Any later actual import changes the finite roster before the final freeze.

### Native task sources and direct type/control dependencies

```text
src/Research.FSharp/PrecisionGateProjectionReplay.fsx
src/Bayesian/PrecisionGateProjection.fs
src/Bayesian/PrecisionGateKernels.fs
src/Bayesian/Message.fs
src/Core/Result.fs
src/Core/ProbabilitySemiring.fs
```

Projection calls the unchanged tryProjectionObjective in PrecisionGateKernels.
The latter uses the Gaussian type from Message.fs and the auto-open Core result
computation builder from Result.fs. Projection has its own private flow builder;
that does not remove the original objective's Core dependency. The replay script
selects ProbabilitySemiring.Rational only to identify its containing Core
assembly. This is not a call to the semiring's numerical functions.

### Build, package and validation wiring

```text
Directory.Build.props
Directory.Packages.props
global.json
.mise.toml
Zeta.sln
src/Bayesian/Bayesian.fsproj
src/Core/Core.fsproj
src/Core.Abstractions/Zeta.Core.Abstractions.csproj
src/Core.FSharp.ZetaId/Zeta.Core.FSharp.ZetaId.fsproj
src/Core.FSharp.Yaml/Zeta.Core.FSharp.Yaml.fsproj
src/Core.TypeScript/ace/build-graph.json
src/Interp.Python/pyproject.toml
src/Interp.Python/uv.lock
tests/Bayesian.Tests/Bayesian.Tests.fsproj
tests/Bayesian.Tests/PrecisionGateProjection.Tests.fs
tests/Bayesian.Tests/PrecisionGateKernels.Tests.fs
src/Interp.Python/tests/test_precision_gate_projection_run.py
src/Interp.Python/tests/test_precision_gate_projection_cases.py
src/Interp.Python/tests/test_precision_gate_projection_comparison.py
src/Interp.Python/tests/test_precision_gate_projection_reference.py
src/Interp.Python/tests/test_precision_gate_projection_intervals.py
```

The first thirteen are declared build/environment inputs. The remaining eight
retain the reviewed validation source/wiring; they do not become production
imports or a test-assembly execution dependency. The process adapter's dedicated
test path, when chosen, also belongs in the final validation-source archive.
Bayesian orders Message, Kernels and Projection and references Core. Core also
references Core.Abstractions, Core.FSharp.ZetaId and Core.FSharp.Yaml. Including
these project declarations records their explicit references; it does not bind
all source files compiled into all those assemblies. The reviewed full checkout
commit/tree and actual build record remain separate evidence.

There is no Research.FSharp.fsproj at this cut. The production entry is an FSI
script. Bayesian.Tests links that script under a non-INTERACTIVE branch for
source tests; successful test compilation does not establish the INTERACTIVE
entrypoint or its runtime resolution. There is no Directory.Build.targets at
this cut. Do not synthesize conventional filenames as admitted inputs.

### Frozen behavioral documents

```text
docs/research/2026-09-08-precision-gate-projection-proposed-contract.md
docs/research/2026-09-08-precision-gate-projection-decimal-admission-clarification.md
docs/research/2026-09-08-precision-gate-projection-rendered-zero-clarification.md
docs/DECISIONS/2026-09-08-density-consistent-precision-gate-kernels.md
```

ProtocolSha256 duplicates the frozen contract's content identity under its
reserved semantic key. Registration/co-claim/review/source-history documents
remain indexed archival authority rather than recursively self-hashed output.
This proposal itself need not be hashed into generated receipts. The archived
Cstar input occurrence and every rendered input retain their separate complete
byte identities; a source-map hash does not substitute for those input hashes.

The base list above contains 44 repository paths plus ProtocolSha256. Two named
obligations remain before freeze: finalize the currently missing process module
and choose/archive the actual executable coordinator driver (including its new
imports and validation path). Use the common numerical admission bounds: at most
256 map keys, bounded canonical relative paths and actual encoded bindings JSON
within 64 KiB. The criteria helper's broader map allowance cannot override a
stricter downstream reader. Store the exact bindings JSON bytes/hash separately
and supply the independently expected same map to every service.

## Three DLL copies, two producer observations

The script's three exact #r paths, relative to its own location, are:

```text
../Core/bin/Release/net10.0/Zeta.Core.dll
../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll
../Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll
```

The process adapter should retain all three actual copied DLL byte identities,
copy destinations and before/after observations under the owned launch layout.
It must also bind the copied script's exact bytes and path resolution. A script
copied to a different directory can resolve the same #r strings differently;
an unchanged string or source digest alone does not admit the resulting files.
The native producer separately observes two assembly files, in source order:
NativeReceipt's Bayesian assembly, then Rational's Core assembly. These use
actual Assembly.Location and exact observed file bytes before the numeric call.

Compare those two actual producer observations with the independently retained
Bayesian/Core copies. Do not describe the third Core.Abstractions copy as a
producer-observed assembly: this script does not collect that observation.
Do not relabel copied files as a complete loaded-image census. Additional
assembly dependencies, FSharp.Core, FSI-generated code, framework code and JIT
code remain outside that two-file claim. Before/after file equality is an
observation under the declared stable owned-filesystem premise, not a theorem
that loaded machine instructions came from those bytes.

## Entrypoint and execution obligations still to close

The current run_comparison API takes three callbacks. reference_services fixes
the two Python callbacks to the reviewed public reference APIs; the native
callback still belongs to the external process adapter. Callback callability,
receipt-schema equality or caller-supplied hash strings do not establish the
actual implementation. The final driver must bind its own file, the exact
native preparation/launch closure, actual argv/cwd/environment and the selected
Python package root. Archive it before any final invocation; a mutable inline
command or an unarchived .git script is not a source-bound driver.

Record actual Python executable/version/cache tag and .NET host/SDK/runtime
observations, command exit/timeout, stdout/stderr, input/binding paths and raw
bytes, exclusive output path and complete native side report. No unperformed
collector can be inferred from these proposed fields. The side report's Runtime
is only a framework description. The .mise/global pins and uv.lock are declared
inputs, not evidence that the invoked host or installed wheels match them.
Capture the actual selected environment and any overrides used by the final
process. Source/module path observations, if used, have a separately reviewed
scope; no source-to-bytecode or hostile-interpreter proof is claimed.

A final archive therefore needs independently expected source bytes, actual
copied artifacts, actual process observations and complete per-call receipts as
distinct linked evidence. None of the four alone proves full transitive runtime
closure or source-to-machine correspondence. Final hashes, source acceptance,
implementation-archive admission and the registered 40/88 evaluation remain
pending. This note authorizes no extra solver, benchmark or training work.

Signed: Vera, OpenAI Codex using GPT-6 Astra.
